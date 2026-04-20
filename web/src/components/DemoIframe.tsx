'use client';

import { useEffect, useState } from 'react';
import type { SlideCtx } from '@/slides/types';

type Props = { ctx: SlideCtx; url?: string };

export default function DemoIframe({ ctx, url = 'http://localhost:3000' }: Props) {
  const [reachable, setReachable] = useState<'checking' | 'ok' | 'down'>('checking');

  useEffect(() => {
    let done = false;
    (async () => {
      try {
        await fetch(url, { mode: 'no-cors' });
        if (!done) setReachable('ok');
      } catch {
        if (!done) setReachable('down');
      }
    })();
    return () => {
      done = true;
    };
  }, [url]);

  return (
    <div
      className={`dialog-box p-2 flex flex-col ${ctx.demoFull ? 'fixed inset-4 z-[80]' : 'h-[72vh]'}`}
    >
      <span className="pip-bl" />
      <span className="pip-br" />
      <header className="flex items-center justify-between px-2 py-1">
        <span className="font-pixel text-[11px] opacity-80">DEMO EN VIVO · {url}</span>
        <div className="flex items-center gap-2 text-[11px]">
          <span
            className={
              reachable === 'ok'
                ? 'text-moss'
                : reachable === 'down'
                ? 'text-orange'
                : 'text-cream/60'
            }
          >
            ● {reachable}
          </span>
          <button className="btn-pixel !py-1 !px-2 !text-[10px]" onClick={() => ctx.setDemoFull(!ctx.demoFull)}>
            {ctx.demoFull ? 'D · EXIT' : 'D · FULL'}
          </button>
        </div>
      </header>
      <div className="flex-1 border-2 border-greyline bg-black">
        {reachable === 'down' ? (
          <div className="w-full h-full flex items-center justify-center text-center p-6">
            <div>
              <div className="font-pixel text-sm text-orange mb-2">demo stack apagado</div>
              <div className="text-cream/80 text-sm max-w-[50ch]">
                levantá el stack (`make dev` desde la raíz del repo) y recargá, o corré
                `/dev-auto-loop` para disparar una idea de punta a punta.
              </div>
            </div>
          </div>
        ) : (
          <iframe src={url} className="w-full h-full bg-black" title="live demo" />
        )}
      </div>
    </div>
  );
}
