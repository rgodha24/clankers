use futures::{SinkExt, TryStreamExt};
use serde::{Deserialize, Serialize};
use serde_jsonlines::{AsyncBufReadJsonLines, AsyncWriteJsonLines};
use std::os::unix::fs::PermissionsExt;
use tokio::io::{self, AsyncReadExt, AsyncWriteExt, BufReader, BufWriter};
use tokio::net::{UnixListener, UnixStream};

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type", content = "payload")]
pub enum Message {
    Ping,
}

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    let args: Vec<String> = std::env::args().collect();
    if args.contains(&"--stdio".to_string()) {
        println!("stdio");
        let sock = UnixStream::connect("/run/clauded.sock").await?;
        let (mut sr, mut sw) = sock.into_split();
        let mut stdin = io::stdin();
        let mut stdout = io::stdout();

        // stdin -> socket
        let a = tokio::spawn(async move {
            let mut buf = vec![0u8; 8192];
            loop {
                let n = stdin.read(&mut buf).await?;
                if n == 0 {
                    break;
                }
                sw.write_all(&buf[..n]).await?;
                sw.flush().await?;
            }
            Ok::<_, anyhow::Error>(())
        });

        // socket -> stdout
        let b = tokio::spawn(async move {
            let mut buf = vec![0u8; 8192];
            loop {
                let n = sr.read(&mut buf).await?;
                if n == 0 {
                    break;
                }
                stdout.write_all(&buf[..n]).await?;
                stdout.flush().await?;
            }
            Ok::<_, anyhow::Error>(())
        });

        let _ = tokio::try_join!(a, b)?;
        return Ok(());
    }
    let path = "/run/clauded.sock";
    let _ = std::fs::remove_file(path);
    let listener = UnixListener::bind(path)?;
    std::fs::set_permissions(path, std::fs::Permissions::from_mode(0o660))?;

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

    while let Some(msg) = reader.try_next().await? {
        eprintln!("got: {:?}", msg);
    }

    Ok(())
}
