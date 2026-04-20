import { promises as fs } from "node:fs";
import path from "node:path";

// Append AG-UI events to <repo-root>/logs/<threadId>/ag-ui.jsonl so every
// component's trail for a single run (ag-ui, orchestrator, adk, factory)
// lives in one folder keyed by the ADK thread id.

export const runtime = "nodejs";

const LOGS_DIR = path.join(process.cwd(), "..", "logs");
const BOOT_BUCKET = "_boot";

function safeBucket(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  // UUIDs, timestamp ids, and underscored fallbacks are allowed; the
  // character set keeps the value safe to use as a directory name.
  return /^[A-Za-z0-9_-]{1,128}$/.test(raw) ? raw : null;
}

function extractIds(event: unknown): { threadId?: string; runId?: string } {
  if (!event || typeof event !== "object") return {};
  const e = event as { threadId?: unknown; runId?: unknown };
  return {
    threadId: typeof e.threadId === "string" ? e.threadId : undefined,
    runId: typeof e.runId === "string" ? e.runId : undefined,
  };
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return new Response("invalid body", { status: 400 });
  }
  const event = (body as { event?: unknown }).event;
  if (event === undefined) {
    return new Response("missing event", { status: 400 });
  }

  // Prefer the threadId the backend will see (sent explicitly by the
  // bridge). Fall back to a sessionId the frontend derived locally so
  // older clients still log, bucketed separately from real threads.
  const rawThreadId =
    (body as { threadId?: unknown }).threadId ??
    (body as { sessionId?: unknown }).sessionId;
  const bucket = safeBucket(rawThreadId) ?? BOOT_BUCKET;

  const { threadId, runId } = extractIds(event);
  const record: Record<string, unknown> = { ts: new Date().toISOString(), event };
  if (threadId) record.thread_id = threadId;
  if (runId) record.run_id = runId;

  const dir = path.join(LOGS_DIR, bucket);
  await fs.mkdir(dir, { recursive: true });
  await fs.appendFile(path.join(dir, "ag-ui.jsonl"), JSON.stringify(record) + "\n", "utf-8");
  return new Response(null, { status: 204 });
}
