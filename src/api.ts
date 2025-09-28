import { Hono } from "hono";

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

// Initialize with sample OpenCode project data
const sampleTasks: ClankerTask[] = [
  {
    id: 324,
    title: "title title title title title title title title title title",
    project: "opencode",
    status: "running",
    contextusage: 23.465,
    cost: 0.6721309412,
    sessionID: "ses_67151623cffepFFcuR8ZAl53oi",
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    logs: [],
  },
  {
    id: 325,
    title: "title title title title title title title title title title",
    project: "opencode",
    status: "waiting",
    contextusage: 67.321423,
    cost: 10.615,
    pr_number: 41,
    sessionID: "ses_67149c45effeciaTVy6rxDhVFL",
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    logs: [],
  },
  {
    id: 670,
    title: "title title title title title title title title title title",
    project: "opencode",
    status: "merged",
    contextusage: 23.465,
    cost: 0.6721309412,
    pr_number: 67,
    sessionID: "ses_671cf1193ffe70abmJXUxKWo6P",
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    logs: [],
  },
];

// Initialize opencode project with sample data
projects.set("opencode", {
  name: "opencode",
  upstream: "https://github.com/opencode/project",
  tasks: sampleTasks,
  nextTaskId: 671,
});

// Start OpenCode servers for sample tasks
async function initializeSampleServers() {
  for (const task of sampleTasks) {
    try {
      const port = await startOpenCodeServer(task.project, task.id);
      task.port = port;
      console.log(
        `Initialized sample task ${task.id} with OpenCode server on port ${port}`,
      );
    } catch (error) {
      console.error(
        `Failed to start OpenCode server for sample task ${task.id}:`,
        error,
      );
    }
  }
}

// Initialize sample servers when module loads
initializeSampleServers().catch(console.error);

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
): Promise<number> {
  const port = allocatePort();
  const key = `${project}:${taskId}`;

  // Start OpenCode server process in current working directory
  const proc = Bun.spawn(["opencode", "serve", "-p", port.toString()], {
    cwd: "/Users/rohangodha/Developer/opencode",
    stdout: "pipe",
    stderr: "pipe",
  });

  taskPorts.set(key, port);
  console.log(`Started OpenCode server for ${key} on port ${port}`);
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
    projects.set(projectName, {
      name: projectName,
      upstream,
      tasks: [],
      nextTaskId: 1,
    });
  }

  return c.json({ success: true, project: projectName });
});

// Start new clanker task
app.post("/projects/:project/clankers", async (c) => {
  const projectName = c.req.param("project");
  const body = await c.req.json();
  const { prompt } = body;

  const project = projects.get(projectName);
  if (!project) {
    return c.json({ error: "Project not found" }, 404);
  }

  const taskId = project.nextTaskId++;
  const port = await startOpenCodeServer(projectName, taskId);

  const task: ClankerTask = {
    id: taskId,
    title: prompt || `Task ${taskId}`,
    project: projectName,
    prompt,
    status: "not_started",
    contextusage: 0,
    cost: 0,
    sessionID: `ses_${Date.now()}${Math.random().toString(36).substr(2, 9)}`,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    port,
    logs: [],
  };

  project.tasks.push(task);

  return c.json({ taskId, port });
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
    // Rebuild target URL preserving query string
    const target = new URL(
      restPath,
      upstream.endsWith("/") ? upstream : upstream + "/",
    );
    target.search = fullUrl.search; // preserve query

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
