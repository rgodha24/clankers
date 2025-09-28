use std::collections::HashMap;

use futures::{SinkExt, TryStreamExt};
use serde::{Deserialize, Serialize};
use serde_jsonlines::{AsyncBufReadJsonLines, AsyncWriteJsonLines};
use tokio::io::{self, BufReader, BufWriter};
use tokio::net::{UnixListener, UnixStream};
use tokio::sync::mpsc;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type", content = "payload")]
pub enum Message {
    Ping,
    /// sent from the server to the client. this could be the first message that we send in the
    /// specified clanker_id+project combo (e.g. if they just started the clanker.)
    ClaudeCodeMsg {
        project: String,
        clanker_id: u32,
        msg: serde_json::Value,
    },
    DataRequest {
        project: String,
    },
    DataResponse {
        data: (),
        project: String,
    },
    OpenProject {
        name: String,
        upstream: String,
    },
    StartClanker {
        project: String,
        prompt: String,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct State {
    projects: HashMap<String, ProjectState>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProjectState {
    clankers: HashMap<u32, ClankerState>,
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
    pub msg_sender: Option<mpsc::Sender<serde_json::Value>>,
    messages: Vec<serde_json::Value>,
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

    loop {
        let (stream, _addr) = listener.accept().await?;
        tokio::spawn(async move {
            if let Err(e) = handle_client(stream).await {
                eprintln!("error: {}", e);
            }
        });
    }
}

async fn handle_client(stream: UnixStream) -> anyhow::Result<()> {
    let (r, w) = stream.into_split();
    let mut reader = BufReader::new(r).json_lines::<Message>();
    let mut writer = BufWriter::new(w).into_json_lines_sink();

    writer.send(&Message::Ping).await?;

    loop {
        let msg = reader.try_next().await;
        eprintln!("got: {:?}", msg);
        if let Ok(Some(msg)) = msg {
            eprintln!("got good msg: {:?}", msg);
        } else {
            break;
        }
    }

    println!("done");
    Ok(())
}
