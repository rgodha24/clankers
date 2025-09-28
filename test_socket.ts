#!/usr/bin/env bun

import { spawn } from "child_process";
import { connect } from "net";
import { setTimeout } from "timers/promises";

interface Message {
  type: string;
  payload?: any;
}

async function testSocket() {
  console.log("🚀 Starting socket test...");
  
  // Start the daemon
  console.log("Starting daemon...");
  const daemon = spawn("cargo", ["run"], {
    cwd: process.cwd(),
    stdio: ["ignore", "pipe", "pipe"],
  });

  daemon.stdout?.on("data", (data) => {
    console.log("Daemon stdout:", data.toString());
  });

  daemon.stderr?.on("data", (data) => {
    console.log("Daemon stderr:", data.toString());
  });

  // Wait for daemon to start
  await setTimeout(3000);

  // Connect to the Unix socket
  const socket = connect("/tmp/clanker.sock");
  
  let responses: Message[] = [];
  let buffer = "";

  socket.on("data", (data) => {
    buffer += data.toString();
    const lines = buffer.split("\n");
    buffer = lines.pop() || ""; // Keep incomplete line in buffer
    
    for (const line of lines) {
      if (line.trim()) {
        try {
          const msg = JSON.parse(line) as Message;
          responses.push(msg);
          console.log("📥 Received:", msg);
        } catch (e) {
          console.log("📥 Raw:", line);
        }
      }
    }
  });

  socket.on("connect", async () => {
    console.log("✅ Connected to daemon");

    // Wait for initial ping
    await setTimeout(100);

    console.log("\n=== Test 1: Send ClaudeCodeMsg ===");
    socket.write(JSON.stringify({
      type: "ClaudeCodeMsg",
      payload: {
        project: "test-project", 
        clanker_id: 1,
        msg: { event: "test", content: "Hello!" }
      }
    }) + "\n");

    await setTimeout(200);

    console.log("\n=== Test 2: Request Data ===");
    socket.write(JSON.stringify({
      type: "DataRequest",
      payload: { project: "test-project" }
    }) + "\n");

    await setTimeout(200);

    console.log("\n=== Test 3: Send another message ===");
    socket.write(JSON.stringify({
      type: "ClaudeCodeMsg", 
      payload: {
        project: "test-project",
        clanker_id: 1, 
        msg: { event: "test2", content: "World!" }
      }
    }) + "\n");

    await setTimeout(200);

    console.log("\n=== Test 4: Request Data again ===");
    socket.write(JSON.stringify({
      type: "DataRequest",
      payload: { project: "test-project" }
    }) + "\n");

    await setTimeout(500);

    // Close and cleanup
    socket.end();
    daemon.kill();

    console.log(`\n=== Summary ===`);
    console.log(`Total responses: ${responses.length}`);
    
    const pings = responses.filter(r => r.type === "Ping");
    const claudeMsgs = responses.filter(r => r.type === "ClaudeCodeMsg"); 
    const dataResponses = responses.filter(r => r.type === "DataResponse");
    
    console.log(`- Pings: ${pings.length}`);
    console.log(`- Claude messages: ${claudeMsgs.length}`);
    console.log(`- Data responses: ${dataResponses.length}`);

    if (pings.length > 0) console.log("✅ Initial ping received");
    if (claudeMsgs.length > 0) console.log("✅ Message broadcasting works");
    if (dataResponses.length > 0) console.log("✅ Data requests work");

    process.exit(0);
  });

  socket.on("error", (err) => {
    console.error("Socket error:", err);
    daemon.kill();
    process.exit(1);
  });
}

testSocket().catch(console.error);