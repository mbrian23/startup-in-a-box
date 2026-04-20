import type { NextRequest } from "next/server";

export const runtime = "nodejs";

const orchestratorBase = (
  process.env.ORCHESTRATOR_URL || "http://localhost:8000/orchestrator"
).replace(/\/orchestrator\/?$/, "");
const hitlUrl = `${orchestratorBase}/orchestrator/hitl`;

// Browser posts {thread_id, approved, notes?} here when the user clicks
// Approve / Reject in the HITLPanel; we forward verbatim to the
// orchestrator, which resolves the pending future and either releases
// delegation to the factory or emits a RUN_ERROR.
export async function POST(req: NextRequest) {
  const text = await req.text();
  try {
    const resp = await fetch(hitlUrl, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: text,
    });
    const body = await resp.text();
    return new Response(body, {
      status: resp.status,
      headers: { "content-type": "application/json" },
    });
  } catch {
    return new Response(JSON.stringify({ resolved: false }), {
      status: 502,
      headers: { "content-type": "application/json" },
    });
  }
}
