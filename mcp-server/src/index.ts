import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

const BASE_URL = process.env.ACTION_CENTER_URL ?? "http://localhost:3000";

// ─── HTTP helpers ─────────────────────────────────────────────────────────────

type ApiResult = { ok: boolean; status: number; data: unknown };

async function apiFetch(
  path: string,
  options: RequestInit = {}
): Promise<ApiResult> {
  const url = `${BASE_URL}/api${path}`;
  try {
    const response = await fetch(url, {
      ...options,
      headers: {
        "Content-Type": "application/json",
        ...(options.headers ?? {}),
      },
    });
    let data: unknown;
    try {
      data = await response.json();
    } catch {
      data = null;
    }
    return { ok: response.ok, status: response.status, data };
  } catch {
    throw new Error(
      `Action Center is not running or not reachable at ${BASE_URL}. ` +
        `Start it with: bun dev (inside action-center-app/)`
    );
  }
}

function formatError(result: ApiResult): string {
  if (
    result.data &&
    typeof result.data === "object" &&
    "error" in result.data &&
    typeof (result.data as { error: unknown }).error === "string"
  ) {
    return (result.data as { error: string }).error;
  }
  return `Request failed with status ${result.status}`;
}

// ─── Server ───────────────────────────────────────────────────────────────────

const server = new McpServer({
  name: "action-center",
  version: "0.1.0",
});

// ─── add_task ─────────────────────────────────────────────────────────────────

server.tool(
  "add_task",
  `Save a new task to the Action Center. Follow these rules strictly before calling this tool:

1. GENERATE — Do not save the user's raw words. Derive a clear, specific task title and meaningful notes from their message and the conversation context. The title should be actionable (start with a verb). Notes should summarise what needs doing and why.
2. CLARIFY — If the user's intent is too vague to produce a quality title or notes, ask one focused clarifying question before proceeding. Do not guess.
3. DUE DATE — A due date is always required. If the user has not provided one, ask for it before calling this tool. Never save a task without a due date.
4. CONFIRM — Before calling this tool, show the user the generated title, notes, and due date and get explicit confirmation. Do not save silently.`,
  {
    title: z.string().min(1).describe("Actionable task title generated from the conversation — not a verbatim copy of what the user said"),
    project: z.string().min(1).describe("Project or domain this task belongs to"),
    notes: z.string().optional().describe("Context, background, and detail drawn from the conversation"),
    due_date: z.string().min(1).describe("Due date in YYYY-MM-DD format. Always required — ask the user if they have not provided one"),
  },
  async ({ title, project, notes, due_date }) => {
    let result: ApiResult;
    try {
      result = await apiFetch("/tasks", {
        method: "POST",
        body: JSON.stringify({ title, project, notes, due_date, source: "claude" }),
      });
    } catch (err) {
      return { content: [{ type: "text", text: (err as Error).message }], isError: true };
    }

    if (!result.ok) {
      return { content: [{ type: "text", text: formatError(result) }], isError: true };
    }

    const task = result.data as { id: string; title: string; project: string };
    return {
      content: [
        {
          type: "text",
          text: `Saved "${task.title}" to your Action Center under *${task.project}*. (ID: ${task.id})`,
        },
      ],
    };
  }
);

// ─── list_tasks ───────────────────────────────────────────────────────────────

server.tool(
  "list_tasks",
  "Retrieve tasks from the Action Center. Optionally filter by project or status.",
  {
    project: z.string().optional().describe("Filter to a specific project name"),
    status: z
      .enum(["pending", "in_progress", "done", "snoozed"])
      .optional()
      .describe("Filter by status. If omitted, returns all statuses"),
  },
  async ({ project, status }) => {
    const params = new URLSearchParams();
    if (project) params.set("project", project);
    if (status) params.set("status", status);
    const query = params.size > 0 ? `?${params.toString()}` : "";

    let result: ApiResult;
    try {
      result = await apiFetch(`/tasks${query}`);
    } catch (err) {
      return { content: [{ type: "text", text: (err as Error).message }], isError: true };
    }

    if (!result.ok) {
      return { content: [{ type: "text", text: formatError(result) }], isError: true };
    }

    const tasks = result.data as Array<{
      id: string;
      title: string;
      project: string;
      status: string;
      due_date: string | null;
    }>;

    if (tasks.length === 0) {
      const filter = project ? ` in *${project}*` : status ? ` with status "${status}"` : "";
      return { content: [{ type: "text", text: `No tasks found${filter}.` }] };
    }

    const lines = tasks.map((t) => {
      const due = t.due_date ? ` · due ${t.due_date}` : "";
      return `- [${t.id}] ${t.title} (${t.project}) — ${t.status}${due}`;
    });

    return {
      content: [
        {
          type: "text",
          text: `You have ${tasks.length} task(s):\n\n${lines.join("\n")}`,
        },
      ],
    };
  }
);

// ─── complete_task ────────────────────────────────────────────────────────────

server.tool(
  "complete_task",
  "Mark a task as done. Always call list_tasks first to find the correct task ID — never guess an ID.",
  {
    task_id: z.string().min(1).describe("The ID of the task to mark as done"),
  },
  async ({ task_id }) => {
    let result: ApiResult;
    try {
      result = await apiFetch(`/tasks/${task_id}`, {
        method: "PATCH",
        body: JSON.stringify({ status: "done" }),
      });
    } catch (err) {
      return { content: [{ type: "text", text: (err as Error).message }], isError: true };
    }

    if (result.status === 404) {
      return {
        content: [{ type: "text", text: "I couldn't find that task. Let me list your open tasks first." }],
        isError: true,
      };
    }

    if (!result.ok) {
      return { content: [{ type: "text", text: formatError(result) }], isError: true };
    }

    const task = result.data as { title: string };
    return { content: [{ type: "text", text: `"${task.title}" is marked as done.` }] };
  }
);

// ─── update_task ──────────────────────────────────────────────────────────────

server.tool(
  "update_task",
  "Update one or more fields on an existing task. Always call list_tasks first to find the correct task ID.",
  {
    task_id: z.string().min(1).describe("The ID of the task to update"),
    title: z.string().optional().describe("New title"),
    notes: z.string().optional().describe("Updated context or notes"),
    due_date: z.string().optional().describe("New due date in YYYY-MM-DD format"),
    project: z.string().optional().describe("Move task to this project"),
    status: z
      .enum(["pending", "in_progress", "done", "snoozed"])
      .optional()
      .describe("New status"),
  },
  async ({ task_id, title, notes, due_date, project, status }) => {
    const updates: Record<string, string> = {};
    if (title !== undefined) updates.title = title;
    if (notes !== undefined) updates.notes = notes;
    if (due_date !== undefined) updates.due_date = due_date;
    if (project !== undefined) updates.project = project;
    if (status !== undefined) updates.status = status;

    if (Object.keys(updates).length === 0) {
      return { content: [{ type: "text", text: "No fields provided to update." }], isError: true };
    }

    let result: ApiResult;
    try {
      result = await apiFetch(`/tasks/${task_id}`, {
        method: "PATCH",
        body: JSON.stringify(updates),
      });
    } catch (err) {
      return { content: [{ type: "text", text: (err as Error).message }], isError: true };
    }

    if (result.status === 404) {
      return {
        content: [{ type: "text", text: "I couldn't find that task. Let me list your open tasks first." }],
        isError: true,
      };
    }

    if (!result.ok) {
      return { content: [{ type: "text", text: formatError(result) }], isError: true };
    }

    const task = result.data as { title: string };
    const fieldList = Object.keys(updates).join(", ");
    return {
      content: [{ type: "text", text: `Updated "${task.title}". Changed: ${fieldList}.` }],
    };
  }
);

// ─── Start ────────────────────────────────────────────────────────────────────

const transport = new StdioServerTransport();
await server.connect(transport);
