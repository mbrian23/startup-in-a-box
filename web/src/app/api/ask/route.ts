import { NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// POST /api/ask
// Body: { question: string, context: string }
// Reads OPENROUTER_API_KEY from server env. If absent, returns 204 so the
// client falls back to offline keyword matching.
export async function POST(req: Request) {
  const key = process.env.OPENROUTER_API_KEY;
  if (!key) return new NextResponse(null, { status: 204 });

  let body: { question?: string; context?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'bad json' }, { status: 400 });
  }
  const question = (body.question || '').slice(0, 2000).trim();
  const context = (body.context || '').slice(0, 12000);
  if (!question) return NextResponse.json({ error: 'empty question' }, { status: 400 });

  const model = process.env.OPENROUTER_MODEL || 'anthropic/claude-3.5-haiku';
  const system = [
    "You are a terse Q&A assistant embedded in a live technical talk.",
    "Answer ONLY using the <deck-context> below — this talk's outline.",
    "If the answer isn't in the context, say so in one sentence.",
    "Never invent facts about the repo. Max 5 sentences.",
  ].join(' ');

  try {
    const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${key}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'https://startup-in-a-box.local/',
        'X-Title': 'Startup in a Box — Ask the Deck',
      },
      body: JSON.stringify({
        model,
        temperature: 0.2,
        max_tokens: 320,
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: `<deck-context>\n${context}\n</deck-context>\n\nQuestion: ${question}` },
        ],
      }),
    });
    if (!res.ok) {
      console.warn('[ask] openrouter %s: %s', res.status, (await res.text()).slice(0, 200));
      return new NextResponse(null, { status: 204 });
    }
    const json = await res.json();
    const answer: string = json?.choices?.[0]?.message?.content ?? '';
    return NextResponse.json({ answer, model });
  } catch (e) {
    console.warn('[ask] fetch failed, falling back to offline:', e);
    return new NextResponse(null, { status: 204 });
  }
}
