use std::collections::{HashMap, VecDeque};
use std::sync::Arc;

use futures::{SinkExt, TryStreamExt};
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
    /// sent from the server to the client. this could be the first message that we send in the
    /// specified clanker_id+project combo (e.g. if they just started the clanker.)
    /// just outgoing
    ClaudeCodeMsg {
        project: String,
        clanker_id: u32,
        msg: serde_json::Value,
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
    #[serde(skip)]
    pub stdin_tx: Option<mpsc::Sender<serde_json::Value>>,
    #[serde(skip)]
    pub history: VecDeque<serde_json::Value>,
    // Keep the old messages field for serialization compatibility
    messages: Vec<serde_json::Value>,
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
            stdin_tx: None,
            history: VecDeque::new(),
            messages: Vec::new(),
        })
    }
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
    let (fanout_tx, mut fanout_rx0) = broadcast::channel::<Message>(1024);
    let (ingest_tx, mut ingest_rx) = mpsc::channel::<Message>(256);

    // Consume the initial receiver to prevent channel from filling up
    tokio::spawn(async move {
        while let Ok(_msg) = fanout_rx0.recv().await {
            // Drop messages - clients have their own subscribers
        }
    });

    // Central aggregator task
    {
        let state = Arc::clone(&state);
        let fanout_tx = fanout_tx.clone();
        tokio::spawn(async move {
            while let Some(msg) = ingest_rx.recv().await {
                if let Message::ClaudeCodeMsg {
                    project,
                    clanker_id,
                    msg: val,
                } = &msg
                {
                    let mut st = state.lock().await;
                    let proj = st.projects.entry(project.clone()).or_insert(ProjectState {
                        clankers: HashMap::new(),
                    });
                    let cl = proj.get_or_create_clanker(*clanker_id);
                    cl.history.push_back(val.clone());
                }
                // Fan out to all subscribers
                let _ = fanout_tx.send(msg);
            }
        });
    }

    loop {
        let (stream, _addr) = listener.accept().await?;
        let state = Arc::clone(&state);
        let fanout_tx = fanout_tx.clone();
        let ingest_tx = ingest_tx.clone();
        tokio::spawn(async move {
            if let Err(e) = handle_client(stream, state, fanout_tx, ingest_tx).await {
                eprintln!("error: {}", e);
            }
        });
    }
}

async fn handle_client(
    stream: UnixStream,
    state: Arc<Mutex<State>>,
    fanout_tx: broadcast::Sender<Message>,
    ingest_tx: mpsc::Sender<Message>,
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

    // Optional: greet
    let _ = out_tx.send(Message::Ping).await;

    // Handle inbound commands
    while let Ok(opt) = reader.try_next().await {
        let Some(msg) = opt else { break };
        match msg {
            Message::DataRequest { project } => {
                // Send both a DataResponse and individual ClaudeCodeMsg messages for history
                let (data_response, individual_messages): (Option<Message>, Vec<Message>) = {
                    let st = state.lock().await;
                    if let Some(p) = st.projects.get(&project) {
                        // Create a serializable version of ProjectState for DataResponse
                        let serializable_project = ProjectState {
                            clankers: p
                                .clankers
                                .iter()
                                .map(|(id, cl)| {
                                    (
                                        *id,
                                        ClankerState {
                                            status: cl.status.clone(),
                                            stdin_tx: None,           // Not serialized
                                            history: VecDeque::new(), // Not serialized
                                            messages: cl.history.iter().cloned().collect(),
                                        },
                                    )
                                })
                                .collect(),
                        };

                        let data_response = Message::DataResponse {
                            data: serializable_project,
                            project: project.clone(),
                        };

                        // Also send individual messages for the history
                        let mut individual = Vec::new();
                        for (id, cl) in &p.clankers {
                            for ev in &cl.history {
                                individual.push(Message::ClaudeCodeMsg {
                                    project: project.clone(),
                                    clanker_id: *id,
                                    msg: ev.clone(),
                                });
                            }
                        }

                        (Some(data_response), individual)
                    } else {
                        // Send empty response for unknown project
                        let empty_response = Message::DataResponse {
                            data: ProjectState {
                                clankers: HashMap::new(),
                            },
                            project: project.clone(),
                        };
                        (Some(empty_response), Vec::new())
                    }
                };

                if let Some(response) = data_response {
                    let _ = out_tx.send(response).await;
                }
                for m in individual_messages {
                    let _ = out_tx.send(m).await;
                }
            }
            Message::ClaudeCodeMsg {
                project,
                clanker_id,
                msg,
            } => {
                // Send through ingest to be processed and broadcast
                let _ = ingest_tx
                    .send(Message::ClaudeCodeMsg {
                        project,
                        clanker_id,
                        msg,
                    })
                    .await;
            }
            Message::OpenProject { name, upstream } => {
                eprintln!("TODO: implement OpenProject for {} from {}", name, upstream);
                // TODO: implement project creation/cloning logic
            }
            Message::StartClanker { project, prompt } => {
                eprintln!(
                    "TODO: implement StartClanker for {} with prompt: {}",
                    project, prompt
                );
                // TODO: implement clanker spawning logic
            }
            Message::Ping => {
                let _ = out_tx.send(Message::Ping).await;
            }
            _ => { /* handle others or ignore */ }
        }
    }

    writer_task.abort();
    Ok(())
}
