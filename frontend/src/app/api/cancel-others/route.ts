import type { NextRequest } from "next/server";

export const runtime = "nodejs";

const orchestratorBase = (
  process.env.ORCHESTRATOR_URL || "http://localhost:8000/orchestrator"
).replace(/\/orchestrator\/?$/, "");
const cancelOthersUrl = `${orchestratorBase}/orchestrator/cancel-others`;

// Called on mount, spawn, and reset with { keep: <new threadId> }. The
// orchestrator sweeps its _ACTIVE_RUNS and cascades to /factory/cancel-others
// — one round-trip takes out orphans from refreshes, other tabs, or
// client crashes that sessionStorage alone can't enumerate.
export async function POST(req: NextRequest) {
  const text = await req.text();
  try {
    await fetch(cancelOthersUrl, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: text,
    });
  } catch {
    // Best-effort — the new run doesn't need this to succeed to proceed.
  }
  return new Response(null, { status: 204 });
}
