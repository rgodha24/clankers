#!/usr/bin/env bun

import { spawn } from "child_process";

interface Message {
  type: string;
  payload?: any;
}

interface ClaudeCodeMsg {
  type: "ClaudeCodeMsg";
  payload: {
    project: string;
    clanker_id: number;
    msg: any;
  };
}

interface DataRequest {
  type: "DataRequest";
  payload: {
    project: string;
  };
}



// Test the daemon by spawning it with --stdio and sending messages
async function testDaemon() {
  console.log("🚀 Starting daemon test...");

  // Start the daemon in stdio mode
  const daemon = spawn("cargo", ["run", "--", "--stdio"], {
    cwd: process.cwd(),
    stdio: ["pipe", "pipe", "pipe"],
  });

  if (!daemon.stdin || !daemon.stdout) {
    throw new Error("Failed to get daemon stdin/stdout");
  }

  let responses: Message[] = [];

  // Read responses from daemon
  daemon.stdout.on("data", (data) => {
    const lines = data.toString().split("\n").filter(Boolean);
    for (const line of lines) {
      try {
        const msg = JSON.parse(line) as Message;
        responses.push(msg);
        console.log("📥 Received:", msg);
      } catch (e) {
        console.log("📥 Raw output:", line);
      }
    }
  });

  daemon.stderr.on("data", (data) => {
    console.log("⚠️  Daemon stderr:", data.toString());
  });

  // Wait for daemon to start
  await new Promise((resolve) => setTimeout(resolve, 2000));

  // Helper to send message and wait a bit
  const send = async (msg: Message) => {
    const json = JSON.stringify(msg);
    console.log("📤 Sending:", json);
    daemon.stdin!.write(json + "\n");
    await new Promise((resolve) => setTimeout(resolve, 200)); // Wait for response
  };

  // Test sequence
  console.log("\n=== Test 1: Basic ping ===");
  await send({ type: "Ping" });

  console.log("\n=== Test 2: Send some Claude messages ===");
  await send({
    type: "ClaudeCodeMsg",
    payload: {
      project: "test-project",
      clanker_id: 1,
      msg: { event: "task_started", content: "Starting task..." },
    },
  } as ClaudeCodeMsg);

  await send({
    type: "ClaudeCodeMsg",
    payload: {
      project: "test-project", 
      clanker_id: 1,
      msg: { event: "log_line", content: "Some log output" },
    },
  } as ClaudeCodeMsg);

  await send({
    type: "ClaudeCodeMsg",
    payload: {
      project: "test-project",
      clanker_id: 2,
      msg: { event: "task_started", content: "Another clanker starting..." },
    },
  } as ClaudeCodeMsg);

  console.log("\n=== Test 3: Request project data ===");
  await send({
    type: "DataRequest",
    payload: { project: "test-project" },
  } as DataRequest);

  console.log("\n=== Test 4: Request non-existent project ===");
  await send({
    type: "DataRequest", 
    payload: { project: "non-existent" },
  } as DataRequest);

  // Wait for final responses
  await new Promise((resolve) => setTimeout(resolve, 500));

  // Close daemon
  daemon.stdin.end();
  daemon.kill();

  console.log("\n=== Summary ===");
  console.log(`Total responses received: ${responses.length}`);
  
  // Check we got expected responses
  const pings = responses.filter((r) => r.type === "Ping");
  const dataResponses = responses.filter((r) => r.type === "DataResponse");
  const claudeMsgs = responses.filter((r) => r.type === "ClaudeCodeMsg");

  console.log(`- Pings: ${pings.length}`);
  console.log(`- Data responses: ${dataResponses.length}`);
  console.log(`- Claude messages echoed back: ${claudeMsgs.length}`);

  if (pings.length >= 1) {
    console.log("✅ Ping/pong working");
  } else {
    console.log("❌ No pings received");
  }

  if (dataResponses.length >= 2) {
    console.log("✅ Data request/response working");
  } else {
    console.log("❌ Data requests not working properly");
  }

  if (claudeMsgs.length >= 3) {
    console.log("✅ Message echoing/broadcasting working");
  } else {
    console.log("❌ Message broadcasting not working properly");
  }

  console.log("\n🎉 Test complete!");
}

// Run the test
testDaemon().catch(console.error);