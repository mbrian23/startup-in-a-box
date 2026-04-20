'use client';

import { useEffect, useRef, useState } from 'react';

type Evt = { t: number; source: 'orch' | 'factory' | 'mock'; kind: string; text: string };

const MOCK: ReadonlyArray<Omit<Evt, 't'>> = [
  { source: 'orch', kind: 'RUN_STARTED', text: 'boardroom pipeline · idea=ai-bread' },
  { source: 'orch', kind: 'AGENT_TURN', text: 'rin → marcus · feasibility' },
  { source: 'orch', kind: 'TEXT_DELTA', text: 'Marcus: "I can stand this up in a week."' },
  { source: 'orch', kind: 'HITL_GATE', text: 'approve handoff to factory? (6s)' },
  { source: 'factory', kind: 'SUBAGENT_START', text: 'supervisor → web-edition' },
  { source: 'factory', kind: 'TOOL_USE', text: 'stripe-checkout · mocked (no STRIPE_KEY)' },
  { source: 'factory', kind: 'FILE_WRITE', text: 'pages/checkout.tsx · 184 lines' },
  { source: 'factory', kind: 'RUN_COMPLETED', text: 'build ok · 37s' },
];

export default function SseDrawer({ onClose }: { onClose: () => void }) {
  const [events, setEvents] = useState<Evt[]>([]);
  const [live, setLive] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let closed = false;
    let tried = 0;
    const sources = ['http://localhost:8000/events', 'http://localhost:8888/events'];
    const eventSources: EventSource[] = [];

    sources.forEach((url, i) => {
      try {
        const es = new EventSource(url);
        es.onopen = () => setLive(true);
        es.onmessage = (e) => {
          if (closed) return;
          setEvents((prev) => {
            const next: Evt = {
              t: Date.now(),
              source: i === 0 ? 'orch' : 'factory',
              kind: 'message',
              text: String(e.data).slice(0, 160),
            };
            return [...prev, next].slice(-200);
          });
        };
        es.onerror = () => {
          tried += 1;
          if (tried >= sources.length) setLive(false);
        };
        eventSources.push(es);
      } catch {
        /* ignore */
      }
    });

    const mockT = setInterval(() => {
      if (closed) return;
      setEvents((prev) => {
        if (prev.some((e) => e.source !== 'mock')) return prev;
        const template = MOCK[prev.filter((e) => e.source === 'mock').length % MOCK.length];
        const next: Evt = { ...template, source: 'mock', t: Date.now() };
        return [...prev, next].slice(-200);
      });
    }, 1800);

    return () => {
      closed = true;
      clearInterval(mockT);
      eventSources.forEach((es) => es.close());
    };
  }, []);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [events]);

  return (
    <aside className="absolute right-0 top-0 bottom-10 w-[380px] dialog-box m-4 p-0 z-40 flex flex-col">
      <span className="pip-bl" />
      <span className="pip-br" />
      <header className="flex items-center justify-between px-4 py-2 border-b-2 border-greyline">
        <span className="font-pixel text-xs">
          PANEL SSE {live ? <span className="text-moss">● EN VIVO</span> : <span className="text-orange">◌ SIMULADO</span>}
        </span>
        <button className="btn-pixel" onClick={onClose}>
          S
        </button>
      </header>
      <div ref={scrollRef} className="flex-1 overflow-auto panel-scroll px-4 py-3 text-[13px] font-mono">
        {events.length === 0 && <div className="opacity-60">esperando eventos…</div>}
        {events.map((e, i) => (
          <div key={i} className="mb-2 animate-rise">
            <span
              className={
                e.source === 'orch'
                  ? 'text-gold'
                  : e.source === 'factory'
                  ? 'text-magenta'
                  : 'text-lila'
              }
            >
              ●
            </span>{' '}
            <span className="opacity-70 text-[11px]">{e.kind}</span>
            <div className="pl-4 opacity-95">{e.text}</div>
          </div>
        ))}
      </div>
      <footer className="px-4 py-2 border-t-2 border-greyline text-[11px] opacity-70 font-pixel">
dorado = orquestador · rubí = factory · violeta = simulado
      </footer>
    </aside>
  );
}
