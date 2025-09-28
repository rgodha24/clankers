use std::collections::HashMap;
use std::sync::{
    Arc,
    atomic::{AtomicU16, Ordering},
};
use std::time::Duration;

use futures::{SinkExt, StreamExt, TryStreamExt};
use serde::{Deserialize, Serialize};
use serde_jsonlines::{AsyncBufReadJsonLines, AsyncWriteJsonLines};
use tokio::io::{self, BufReader, BufWriter};
use tokio::net::{UnixListener, UnixStream};
use tokio::sync::{Mutex, broadcast, mpsc};

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type", content = "payload")]
pub enum Message {
    /// incoming & outgoing
    Ping,
    /// HTTP proxy messages for OpenCode servers
    HttpRequest {
        id: String, // Frontend-assigned ID
        project: String,
        clanker_id: u32,
        method: String,                  // "GET", "POST", etc.
        path: String,                    // "/session", "/event", "/config", etc.
        query: Option<String>,           // URL query parameters
        body: Option<serde_json::Value>, // Request body for POST/PUT
    },
    HttpResponse {
        id: String,  // Same as request ID
        status: u16, // HTTP status code
        body: serde_json::Value, // Response body
                     // For SSE: multiple responses sent with same ID
    },
    /// incoming
    DataRequest { project: String },
    /// outgoing
    DataResponse { data: ProjectState, project: String },
    /// incoming
    OpenProject { name: String, upstream: String },
    /// incoming
    StartClanker { project: String, prompt: String },
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct State {
    pub projects: HashMap<String, ProjectState>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProjectState {
    pub clankers: HashMap<u32, ClankerState>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
enum ClankerStatus {
    Running,
    Waiting,
    Merged,
    Deleted,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ClankerState {
    status: ClankerStatus,
    port: Option<u16>, // Port where OpenCode server is running
    #[serde(skip)]
    http_tx: Option<mpsc::Sender<HttpRequestMessage>>, // Channel to server task
}

#[derive(Debug, Clone)]
struct HttpRequestMessage {
    id: String,
    method: String,
    path: String,
    query: Option<String>,
    body: Option<serde_json::Value>,
}

struct PortAllocator {
    next_port: Arc<AtomicU16>,
}

impl PortAllocator {
    fn new() -> Self {
        Self {
            next_port: Arc::new(AtomicU16::new(8000)), // Start at port 8000
        }
    }

    fn allocate(&self) -> u16 {
        self.next_port.fetch_add(1, Ordering::Relaxed)
    }
}

impl Default for State {
    fn default() -> Self {
        Self {
            projects: HashMap::new(),
        }
    }
}

impl ProjectState {
    fn get_or_create_clanker(&mut self, id: u32) -> &mut ClankerState {
        self.clankers.entry(id).or_insert_with(|| ClankerState {
            status: ClankerStatus::Waiting,
            port: None,
            http_tx: None,
        })
    }
}

// OpenCode server task - spawns and manages one OpenCode server process
async fn run_opencode_server(
    port: u16,
    project: String,
    clanker_id: u32,
    mut http_rx: mpsc::Receiver<HttpRequestMessage>,
    fanout_tx: broadcast::Sender<Message>,
) -> anyhow::Result<()> {
    // 1. Spawn OpenCode process
    let mut process = tokio::process::Command::new("opencode")
        .args(&["serve", "-p", &port.to_string()])
        .stdin(std::process::Stdio::null())
        .stdout(std::process::Stdio::null())
        .stderr(std::process::Stdio::null())
        .spawn()?;

    eprintln!(
        "Started OpenCode server for project {} clanker {} on port {}",
        project, clanker_id, port
    );

    // 2. Wait for server to start
    tokio::time::sleep(Duration::from_millis(1000)).await;

    // 3. Create HTTP client
    let client = reqwest::Client::new();
    let base_url = format!("http://localhost:{}", port);

    // 4. Handle requests
    loop {
        tokio::select! {
            Some(req) = http_rx.recv() => {
                if let Err(e) = handle_http_request(&client, &base_url, req, &fanout_tx).await {
                    eprintln!("HTTP request error: {}", e);
                }
            }
            status = process.wait() => {
                eprintln!("OpenCode server {} exited: {:?}", port, status);
                break;
            }
        }
    }

    Ok(())
}

// Handle individual HTTP requests - differentiates between SSE and regular requests
async fn handle_http_request(
    client: &reqwest::Client,
    base_url: &str,
    req: HttpRequestMessage,
    fanout_tx: &broadcast::Sender<Message>,
) -> anyhow::Result<()> {
    let url = if let Some(query) = &req.query {
        format!("{}{}?{}", base_url, req.path, query)
    } else {
        format!("{}{}", base_url, req.path)
    };

    // CRITICAL: Handle SSE vs regular requests differently
    if req.path == "/event" {
        // SSE Request - stream multiple responses with same ID
        handle_sse_request(client, &url, &req.id, fanout_tx).await?;
    } else {
        // Regular HTTP request - single response
        let mut http_req = client.request(req.method.parse()?, &url);
        if let Some(body) = &req.body {
            http_req = http_req.json(body);
        }

        let response = http_req.send().await?;
        let status = response.status().as_u16();
        let body: serde_json::Value = response.json().await.unwrap_or(serde_json::Value::Null);

        let _ = fanout_tx.send(Message::HttpResponse {
            id: req.id,
            status,
            body,
        });
    }

    Ok(())
}

// SSE stream handler - sends multiple responses with same request ID
async fn handle_sse_request(
    client: &reqwest::Client,
    url: &str,
    request_id: &str,
    fanout_tx: &broadcast::Sender<Message>,
) -> anyhow::Result<()> {
    let response = client.get(url).send().await?;
    let mut stream = response.bytes_stream();

    // Parse SSE stream and send multiple HttpResponse messages
    while let Some(chunk) = stream.next().await {
        let chunk = chunk?;
        let text = String::from_utf8_lossy(&chunk);

        // Parse SSE format: "data: {...}\n\n"
        for line in text.lines() {
            if line.starts_with("data: ") {
                let json_str = &line[6..]; // Remove "data: " prefix
                if let Ok(event_data) = serde_json::from_str::<serde_json::Value>(json_str) {
                    // Send each SSE event as separate HttpResponse with SAME ID
                    let _ = fanout_tx.send(Message::HttpResponse {
                        id: request_id.to_string(),
                        status: 200,
                        body: event_data,
                    });
                }
            }
        }
    }

    Ok(())
}

// TODO: this should go in /run and have some diff permissions?
const SOCKET_PATH: &str = "/tmp/clanker.sock";

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    let args: Vec<String> = std::env::args().collect();
    if args.contains(&"--stdio".to_string()) {
        let sock = UnixStream::connect(SOCKET_PATH).await?;
        let (sr, sw) = sock.into_split();
        let stdin = io::stdin();
        let stdout = io::stdout();

        let mut socket_reader = BufReader::new(sr).json_lines::<Message>();
        let mut socket_writer = BufWriter::new(sw).into_json_lines_sink();
        let mut stdin_reader = BufReader::new(stdin).json_lines::<Message>();
        let mut stdout_writer = BufWriter::new(stdout).into_json_lines_sink();

        // stdin -> socket (only forward valid messages)
        let a = tokio::spawn(async move {
            loop {
                match stdin_reader.try_next().await {
                    Ok(Some(msg)) => {
                        if let Err(e) = socket_writer.send(msg).await {
                            eprintln!("Failed to send to socket: {}", e);
                            break;
                        }
                    }
                    Ok(None) => break, // EOF
                    Err(e) => {
                        eprintln!("Failed to parse message from stdin: {}", e);
                        // Continue to next message instead of breaking
                        continue;
                    }
                }
            }
            Ok::<_, anyhow::Error>(())
        });

        // socket -> stdout (only forward valid messages)
        let b = tokio::spawn(async move {
            loop {
                match socket_reader.try_next().await {
                    Ok(Some(msg)) => {
                        if let Err(e) = stdout_writer.send(msg).await {
                            eprintln!("Failed to send to stdout: {}", e);
                            break;
                        }
                    }
                    Ok(None) => break, // EOF
                    Err(e) => {
                        eprintln!("Failed to parse message from socket: {}", e);
                        // Continue to next message instead of breaking
                        continue;
                    }
                }
            }
            Ok::<_, anyhow::Error>(())
        });

        let _ = tokio::try_join!(a, b)?;
        return Ok(());
    }

    // daemon
    let _ = std::fs::remove_file(SOCKET_PATH);
    let listener = UnixListener::bind(SOCKET_PATH)?;

    // Set up central aggregator system
    let state = Arc::new(Mutex::new(State::default()));
    let port_allocator = Arc::new(PortAllocator::new());
    // we dont need the rx here because we can get it out of tx
    let (fanout_tx, _) = broadcast::channel::<Message>(1024);
    let (ingest_tx, mut ingest_rx) = mpsc::channel::<Message>(256);

    // Central aggregator task - simplified for HTTP proxy mode
    {
        let fanout_tx = fanout_tx.clone();
        tokio::spawn(async move {
            while let Some(msg) = ingest_rx.recv().await {
                // Just fan out messages, no special processing needed for HTTP proxy
                let _ = fanout_tx.send(msg);
            }
        });
    }

    loop {
        let (stream, _addr) = listener.accept().await?;
        let state = Arc::clone(&state);
        let port_allocator = Arc::clone(&port_allocator);
        let fanout_tx = fanout_tx.clone();
        let ingest_tx = ingest_tx.clone();
        tokio::spawn(async move {
            if let Err(e) = handle_client(stream, state, port_allocator, fanout_tx, ingest_tx).await
            {
                eprintln!("error: {}", e);
            }
        });
    }
}

async fn handle_client(
    stream: UnixStream,
    state: Arc<Mutex<State>>,
    port_allocator: Arc<PortAllocator>,
    fanout_tx: broadcast::Sender<Message>,
    _ingest_tx: mpsc::Sender<Message>,
) -> anyhow::Result<()> {
    let (r, w) = stream.into_split();
    let mut reader = BufReader::new(r).json_lines::<Message>();
    let mut jsonl_writer = BufWriter::new(w).into_json_lines_sink::<Message>();

    // Per-connection writer queue
    let (out_tx, mut out_rx) = mpsc::channel::<Message>(256);
    let writer_task = tokio::spawn(async move {
        while let Some(m) = out_rx.recv().await {
            if let Err(e) = jsonl_writer.send(m).await {
                eprintln!("socket write error: {e}");
                break;
            }
        }
    });

    // Live stream forwarder (subscribe to everything)
    let mut live_rx = fanout_tx.subscribe();
    let out_tx_live = out_tx.clone();
    tokio::spawn(async move {
        while let Ok(m) = live_rx.recv().await {
            if out_tx_live.send(m).await.is_err() {
                break;
            }
        }
    });
    let _ = out_tx.send(Message::Ping).await;

    // Handle inbound commands
    while let Ok(opt) = reader.try_next().await {
        let Some(msg) = opt else { break };
        match msg {
            Message::HttpRequest {
                id,
                project,
                clanker_id,
                method,
                path,
                query,
                body,
            } => {
                // Look up the server for this (project, clanker_id)
                let http_tx = {
                    let st = state.lock().await;
                    st.projects
                        .get(&project)
                        .and_then(|p| p.clankers.get(&clanker_id))
                        .and_then(|c| c.http_tx.clone())
                };

                if let Some(tx) = http_tx {
                    let _ = tx
                        .send(HttpRequestMessage {
                            id,
                            method,
                            path,
                            query,
                            body,
                        })
                        .await;
                } else {
                    // Server not found - send error response
                    let _ = out_tx
                        .send(Message::HttpResponse {
                            id,
                            status: 404,
                            body: serde_json::json!({"error": "Clanker not found"}),
                        })
                        .await;
                }
            }
            Message::DataRequest { project } => {
                // Simple data response - just return the current clankers
                let data_response = {
                    let st = state.lock().await;
                    if let Some(p) = st.projects.get(&project) {
                        Message::DataResponse {
                            data: p.clone(),
                            project: project.clone(),
                        }
                    } else {
                        Message::DataResponse {
                            data: ProjectState {
                                clankers: HashMap::new(),
                            },
                            project: project.clone(),
                        }
                    }
                };
                let _ = out_tx.send(data_response).await;
            }
            Message::OpenProject { name, upstream } => {
                todo!("TODO: implement OpenProject for {} from {}", name, upstream);
                // TODO: implement project creation/cloning logic
            }
            Message::StartClanker { project, prompt } => {
                eprintln!(
                    "Starting clanker for project {} with prompt: {}",
                    project, prompt
                );

                // 1. Allocate port
                let port = port_allocator.allocate();

                // 2. Create channel for HTTP requests
                let (http_tx, http_rx) = mpsc::channel::<HttpRequestMessage>(256);

                // 3. Update state
                let clanker_id = {
                    let mut st = state.lock().await;
                    let proj = st.projects.entry(project.clone()).or_insert(ProjectState {
                        clankers: HashMap::new(),
                    });
                    let clanker_id = proj.clankers.len() as u32;
                    let clanker = proj.get_or_create_clanker(clanker_id);
                    clanker.port = Some(port);
                    clanker.http_tx = Some(http_tx);
                    clanker.status = ClankerStatus::Running;
                    clanker_id
                };

                // 4. Spawn OpenCode server task
                let project_clone = project.clone();
                let fanout_tx_clone = fanout_tx.clone();
                tokio::spawn(async move {
                    if let Err(e) = run_opencode_server(
                        port,
                        project_clone,
                        clanker_id,
                        http_rx,
                        fanout_tx_clone,
                    )
                    .await
                    {
                        eprintln!("OpenCode server error: {}", e);
                    }
                });

                // 5. Send back the updated data immediately
                let data_response = {
                    let st = state.lock().await;
                    if let Some(p) = st.projects.get(&project) {
                        Message::DataResponse {
                            data: p.clone(),
                            project: project.clone(),
                        }
                    } else {
                        Message::DataResponse {
                            data: ProjectState {
                                clankers: HashMap::new(),
                            },
                            project: project.clone(),
                        }
                    }
                };
                let _ = out_tx.send(data_response).await;
            }
            Message::Ping => {
                let _ = out_tx.send(Message::Ping).await;
            }
            msg => {
                panic!("Unhandled message: {:?}", msg);
            }
        }
    }

    writer_task.abort();
    Ok(())
}

