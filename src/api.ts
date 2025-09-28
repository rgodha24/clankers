import { Hono } from "hono";
import { existsSync, mkdirSync } from "fs";
import { join } from "path";
import { homedir } from "os";

interface ClankerTask {
  id: number;
  title: string;
  project: string;
  prompt?: string;
  status: "not_started" | "running" | "waiting" | "done" | "failed" | "merged";
  contextusage: number;
  cost: number;
  pr_number?: number;
  sessionID: string;
  created_at: string;
  updated_at: string;
  port?: number;
  logs: string[];
}

interface ProjectState {
  name: string;
  upstream: string;
  tasks: ClankerTask[];
  nextTaskId: number;
}

// Global state management
const projects = new Map<string, ProjectState>();
const taskPorts = new Map<string, number>(); // Maps "project:clankerId" to port

// Port allocation for OpenCode servers
let nextPort = 4000;

function allocatePort(): number {
  return nextPort++;
}

// Git and filesystem utilities
function getClankersDir(): string {
  return join(homedir(), ".clankers", "repos");
}

function getProjectRepoPath(projectName: string): string {
  return join(getClankersDir(), projectName);
}

function getWorktreePath(projectName: string, taskId: number): string {
  return join(homedir(), ".clankers", "worktrees", projectName, `task-${taskId}`);
}

async function ensureDirectoryExists(path: string): Promise<void> {
  if (!existsSync(path)) {
    mkdirSync(path, { recursive: true });
  }
}

async function cloneRepository(
  upstream: string,
  targetPath: string,
): Promise<void> {
  const proc = Bun.spawn(["git", "clone", upstream, targetPath], {
    stdout: "pipe",
    stderr: "pipe",
  });

  const exitCode = await proc.exited;
  if (exitCode !== 0) {
    const stderr = await new Response(proc.stderr).text();
    throw new Error(`Failed to clone repository: ${stderr}`);
  }
}

async function pullLatestChanges(repoPath: string): Promise<void> {
  const proc = Bun.spawn(["git", "pull"], {
    cwd: repoPath,
    stdout: "pipe",
    stderr: "pipe",
  });

  const exitCode = await proc.exited;
  if (exitCode !== 0) {
    const stderr = await new Response(proc.stderr).text();
    console.warn(`Git pull failed (continuing anyway): ${stderr}`);
  }
}

async function createWorktree(
  repoPath: string,
  worktreePath: string,
  taskId: number,
): Promise<void> {
  const branchName = `clanker/task-${taskId}`;

  // Create worktree with new branch
  const proc = Bun.spawn(
    ["git", "worktree", "add", "-b", branchName, worktreePath, "HEAD"],
    {
      cwd: repoPath,
      stdout: "pipe",
      stderr: "pipe",
    },
  );

  const exitCode = await proc.exited;
  if (exitCode !== 0) {
    const stderr = await new Response(proc.stderr).text();
    throw new Error(`Failed to create worktree: ${stderr}`);
  }
}

function resolveUpstream(projectId: string, clankerId: string): string {
  const key = `${projectId}:${clankerId}`;
  const port = taskPorts.get(key);
  if (!port) {
    throw new Error(`No OpenCode server found for ${key}`);
  }
  return `http://127.0.0.1:${port}`;
}

async function startOpenCodeServer(
  project: string,
  taskId: number,
  workingDir: string,
): Promise<number> {
  const port = allocatePort();
  const key = `${project}:${taskId}`;

  console.log(
    `Starting OpenCode server for ${key} on port ${port} in ${workingDir}`,
  );

  // Start OpenCode server process in the project's git worktree
  const proc = Bun.spawn(["opencode", "serve", "-p", port.toString()], {
    cwd: workingDir,
    stdout: "pipe",
    stderr: "pipe",
  });

  taskPorts.set(key, port);
  console.log(
    `Started OpenCode server for ${key} on port ${port} in ${workingDir}`,
  );
  return port;
}

const app = new Hono();

// CORS middleware for browser requests
app.use("*", async (c, next) => {
  await next();
  c.header("Access-Control-Allow-Origin", "*");
  c.header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
  c.header("Access-Control-Allow-Headers", "Content-Type, Authorization");
});

// Handle preflight requests
app.options("*", (c) => {
  return c.text("", 200);
});

// Ping endpoint
app.get("/ping", (c) => {
  return c.json({ message: "pong" });
});

// Get project data
app.get("/projects/:project/data", (c) => {
  const projectName = c.req.param("project");
  const project = projects.get(projectName);

  if (!project) {
    return c.json({ error: "Project not found" }, 404);
  }

  return c.json({ data: project, project: projectName });
});

// Open/create project
app.post("/projects/:project/open", async (c) => {
  const projectName = c.req.param("project");
  const body = await c.req.json();
  const { upstream } = body;

  if (!projects.has(projectName)) {
    const repoPath = getProjectRepoPath(projectName);

    // Ensure ~/.clankers/repos directory exists
    await ensureDirectoryExists(getClankersDir());

    // Clone repository if it doesn't exist
    if (!existsSync(repoPath)) {
      console.log(`Cloning ${upstream} to ${repoPath}`);
      await cloneRepository(upstream, repoPath);
    }

    projects.set(projectName, {
      name: projectName,
      upstream,
      tasks: [],
      nextTaskId: 100,
    });
  }

  return c.json({ success: true, project: projectName });
});

// Start new clanker task
app.post("/projects/:project/clankers", async (c) => {
  const projectName = c.req.param("project");

  const project = projects.get(projectName);
  if (!project) {
    return c.json({ error: "Project not found" }, 404);
  }

  const taskId = project.nextTaskId++;
  let port: number;

  try {
    // Ensure repository exists first
    const repoPath = getProjectRepoPath(projectName);
    if (!existsSync(repoPath)) {
      console.log(
        `Repository doesn't exist, cloning ${project.upstream} to ${repoPath}`,
      );
      await ensureDirectoryExists(getClankersDir());
      await cloneRepository(project.upstream, repoPath);
    }

    // Pull latest changes before creating worktree
    console.log(`Pulling latest changes for ${projectName}`);
    await pullLatestChanges(repoPath);

    // Create git worktree for this task
    const worktreePath = getWorktreePath(projectName, taskId);

    await ensureDirectoryExists(join(homedir(), ".clankers", "worktrees", projectName));
    await createWorktree(repoPath, worktreePath, taskId);

    port = await startOpenCodeServer(projectName, taskId, worktreePath);

    const resp = (await (
      await fetch(`http://localhost:${port}/session`, {
        method: "POST",
      })
    ).json()) as any;
    console.log(resp);
    const { id: sessionID, title } = resp;
    console.log(`Session ID: ${sessionID}`);

    const task: ClankerTask = {
      id: taskId,
      title,
      project: projectName,
      prompt: "",
      status: "not_started",
      contextusage: 0,
      cost: 0,
      sessionID,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      port,
      logs: [],
    };

    project.tasks.push(task);

    return c.json({ taskId, port });
  } catch (error) {
    console.error(`Error setting up task ${taskId}:`, error);
    return c.json(
      {
        error: `Failed to set up task: ${error instanceof Error ? error.message : "Unknown error"}`,
      },
      500,
    );
  }
});

// Get all tasks for a project
app.get("/projects/:project/tasks", (c) => {
  const projectName = c.req.param("project");
  const project = projects.get(projectName);

  if (!project) {
    return c.json({ error: "Project not found" }, 404);
  }

  return c.json({ tasks: project.tasks });
});

// Update task status
app.put("/projects/:project/tasks/:taskId", async (c) => {
  const projectName = c.req.param("project");
  const taskId = parseInt(c.req.param("taskId"));
  const body = await c.req.json();

  const project = projects.get(projectName);
  if (!project) {
    return c.json({ error: "Project not found" }, 404);
  }

  const task = project.tasks.find((t) => t.id === taskId);
  if (!task) {
    return c.json({ error: "Task not found" }, 404);
  }

  if (body.status) task.status = body.status;
  if (body.logs) task.logs.push(...body.logs);
  task.updated_at = new Date().toISOString();

  return c.json({ success: true });
});

// Proxy routes for OpenCode servers
app.all("/:project/:clankerId/*", async (c) => {
  const { project: projectId, clankerId } = c.req.param();

  try {
    const upstream = resolveUpstream(projectId, clankerId);

    // Compute the path after removing the first two segments
    const fullUrl = new URL(c.req.url);
    const segments = fullUrl.pathname.split("/").filter(Boolean);
    // segments[0] = projectId, segments[1] = clankerId, rest is the proxied path
    const restPath = segments.slice(2).join("/");

    // Get the working directory for this task
    const project = projects.get(projectId);
    const taskIdNum = parseInt(clankerId);
    const worktreePath = getWorktreePath(projectId, taskIdNum);

    // Rebuild target URL preserving query string
    const target = new URL(
      restPath,
      upstream.endsWith("/") ? upstream : upstream + "/",
    );
    target.search = fullUrl.search; // preserve query

    // Add directory parameter to ensure OpenCode uses the correct working directory
    target.searchParams.set('directory', worktreePath);

    // Manual proxy implementation for Bun
    const proxyHeaders = new Headers();

    // Copy request headers
    c.req.raw.headers.forEach((value, key) => {
      // Skip hop-by-hop headers
      if (
        !["host", "connection", "transfer-encoding"].includes(key.toLowerCase())
      ) {
        proxyHeaders.set(key, value);
      }
    });

    // Add X-Forwarded headers
    proxyHeaders.set(
      "X-Forwarded-For",
      c.req.header("x-forwarded-for") ?? "127.0.0.1",
    );
    proxyHeaders.set("X-Forwarded-Host", c.req.header("host") ?? "localhost");
    proxyHeaders.set("X-Forwarded-Proto", fullUrl.protocol.replace(":", ""));

    const response = await fetch(target.toString(), {
      method: c.req.method,
      headers: proxyHeaders,
      body:
        c.req.method === "GET" || c.req.method === "HEAD"
          ? undefined
          : c.req.raw.body,
    });

    // Copy response headers
    const responseHeaders = new Headers();
    response.headers.forEach((value, key) => {
      responseHeaders.set(key, value);
    });

    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers: responseHeaders,
    });
  } catch (error) {
    console.error(`Proxy error for ${projectId}/${clankerId}:`, error);
    return c.json({ error: "Upstream server not available" }, 502);
  }
});

const port = 3000;
console.log(`Starting Clanker API on port ${port}`);

export default {
  port,
  fetch: app.fetch,
  idleTimeout: 0,
};
