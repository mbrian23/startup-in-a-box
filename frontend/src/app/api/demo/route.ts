import { NextRequest } from 'next/server';
import { readFile } from 'fs/promises';
import { join } from 'path';

interface DemoEvent {
  delay_ms: number;
  event: Record<string, unknown>;
}

export async function GET(req: NextRequest) {
  const speed = Number(req.nextUrl.searchParams.get('speed') ?? '1');
  const factor = Math.max(0.1, Math.min(speed, 20));

  const filePath = join(process.cwd(), 'public', 'demo', 'boardroom.jsonl');
  const raw = await readFile(filePath, 'utf-8');
  const events: DemoEvent[] = raw
    .split('\n')
    .filter(Boolean)
    .map((line) => JSON.parse(line));

  const stream = new ReadableStream({
    async start(controller) {
      const encoder = new TextEncoder();
      let prevDelay = 0;

      for (const entry of events) {
        const gap = Math.max(0, (entry.delay_ms - prevDelay) / factor);
        prevDelay = entry.delay_ms;

        if (gap > 0) {
          await new Promise((r) => setTimeout(r, gap));
        }

        controller.enqueue(
          encoder.encode(`data: ${JSON.stringify(entry.event)}\n\n`),
        );
      }

      controller.close();
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
    },
  });
}
