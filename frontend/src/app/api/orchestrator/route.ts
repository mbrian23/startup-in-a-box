import { HttpAgent } from "@ag-ui/client";
import type { NextRequest } from "next/server";
import { Agent, setGlobalDispatcher } from "undici";

export const runtime = "nodejs";
export const maxDuration = 3600;

setGlobalDispatcher(new Agent({ bodyTimeout: 0, headersTimeout: 0 }));

const orchestratorUrl =
  process.env.ORCHESTRATOR_URL || "http://localhost:8000/orchestrator";

const httpAgent = new HttpAgent({ url: orchestratorUrl });

export async function POST(req: NextRequest): Promise<Response> {
  const body = await req.json();
  const { readable, writable } = new TransformStream();
  const writer = writable.getWriter();
  const encoder = new TextEncoder();

  const run$ = httpAgent.run({
    threadId: body.thread_id ?? crypto.randomUUID(),
    runId: body.run_id ?? crypto.randomUUID(),
    state: body.state ?? {},
    messages: body.messages ?? [],
    tools: body.tools ?? [],
    context: body.context ?? [],
    forwardedProps: body.forwarded_props ?? {},
  });

  const subscription = run$.subscribe({
    next: (event: unknown) => {
      writer.write(encoder.encode(`data: ${JSON.stringify(event)}\n\n`)).catch(() => {});
    },
    error: (err: unknown) => {
      const msg = err instanceof Error ? err.message : String(err);
      writer.write(encoder.encode(`data: ${JSON.stringify({ type: "RUN_ERROR", error: msg })}\n\n`)).catch(() => {});
      writer.close().catch(() => {});
    },
    complete: () => {
      writer.close().catch(() => {});
    },
  });

  req.signal.addEventListener("abort", () => {
    subscription.unsubscribe();
    writer.close().catch(() => {});
  });

  return new Response(readable, {
    headers: {
      "content-type": "text/event-stream",
      "cache-control": "no-cache",
      connection: "keep-alive",
    },
  });
}
