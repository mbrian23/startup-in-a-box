'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { slides } from '@/slides';
import PresenterOverlay from './PresenterOverlay';
import Overview from './Overview';
import SseDrawer from './SseDrawer';
import AskDeck from './AskDeck';
import GotoModal from './GotoModal';
import StatusBar from './StatusBar';
import ParallaxStars from './ParallaxStars';
import SectionBanner from './SectionBanner';
import ZoomPan from './ZoomPan';

export default function Deck() {
  const [index, setIndex] = useState(0);
  const [dir, setDir] = useState<1 | -1>(1);
  const [presenter, setPresenter] = useState(false);
  const [overview, setOverview] = useState(false);
  const [blackout, setBlackout] = useState(false);
  const [sseOpen, setSseOpen] = useState(false);
  const [demoFull, setDemoFull] = useState(false);
  const [askOpen, setAskOpen] = useState(false);
  const [gotoOpen, setGotoOpen] = useState(false);
  const [startedAt] = useState(() => Date.now());
  const rootRef = useRef<HTMLDivElement>(null);

  const clamp = useCallback(
    (i: number) => Math.max(0, Math.min(slides.length - 1, i)),
    [],
  );

  const indexRef = useRef(0);
  useEffect(() => { indexRef.current = index; }, [index]);

  const goTo = useCallback(
    (i: number) => {
      const next = clamp(i);
      setDir(next >= indexRef.current ? 1 : -1);
      setIndex(next);
    },
    [clamp],
  );

  // Keep the URL hash in sync without touching the router during render.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const hash = `#slide-${String(index + 1).padStart(2, '0')}`;
    if (window.location.hash !== hash) {
      history.replaceState(null, '', hash);
    }
  }, [index]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const hash = window.location.hash.match(/slide-(\d+)/);
    if (hash) setIndex(clamp(parseInt(hash[1], 10) - 1));
  }, [clamp]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement | null)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA') return;
      if (askOpen || gotoOpen) return;

      switch (e.key) {
        case 'ArrowRight':
        case ' ':
        case 'PageDown':
          e.preventDefault();
          goTo(index + 1);
          break;
        case 'ArrowLeft':
        case 'PageUp':
          e.preventDefault();
          goTo(index - 1);
          break;
        case 'Home': goTo(0); break;
        case 'End':  goTo(slides.length - 1); break;
        case 'f':
        case 'F':
          if (!document.fullscreenElement) rootRef.current?.requestFullscreen().catch(() => {});
          else document.exitFullscreen().catch(() => {});
          break;
        case 'p':
        case 'P': setPresenter((v) => !v); break;
        case 'o':
        case 'O': setOverview((v) => !v); break;
        case 's':
        case 'S': setSseOpen((v) => !v); break;
        case 'd':
        case 'D': setDemoFull((v) => !v); break;
        case '.': setBlackout((v) => !v); break;
        case '/': e.preventDefault(); setAskOpen(true); break;
        case 'g':
        case 'G': setGotoOpen(true); break;
        case 'Escape':
          setOverview(false); setPresenter(false); setBlackout(false);
          setAskOpen(false); setGotoOpen(false); setDemoFull(false);
          break;
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [index, goTo, askOpen, gotoOpen]);

  // Parallax: track mouse position as CSS variables at the root.
  useEffect(() => {
    const el = rootRef.current;
    if (!el) return;
    let rafId = 0;
    let pending = { x: 0, y: 0 };
    const onMove = (e: MouseEvent) => {
      const r = el.getBoundingClientRect();
      pending = {
        x: ((e.clientX - r.left) / r.width - 0.5) * 24,
        y: ((e.clientY - r.top) / r.height - 0.5) * 18,
      };
      if (!rafId) {
        rafId = requestAnimationFrame(() => {
          el.style.setProperty('--mx', String(pending.x));
          el.style.setProperty('--my', String(pending.y));
          rafId = 0;
        });
      }
    };
    el.addEventListener('mousemove', onMove);
    return () => {
      el.removeEventListener('mousemove', onMove);
      if (rafId) cancelAnimationFrame(rafId);
    };
  }, []);

  const current = slides[index];
  const Slide = current.component;

  const context = useMemo(
    () => ({ demoFull, setDemoFull, slideIndex: index, slideCount: slides.length }),
    [demoFull, index],
  );

  return (
    <div id="deck" ref={rootRef} className="scanlines vignette aberration">
      <ParallaxStars />
      <div className="noise" aria-hidden />
      <SectionBanner
        chapter={current.chapter}
        tint={current.tint}
        slideNumber={index + 1}
        slideTotal={slides.length}
      />

      <div className="absolute inset-0">
        {!blackout && !overview && (
          <ZoomPan resetKey={current.id}>
            <AnimatePresence mode="wait" custom={dir}>
              <motion.main
                key={current.id}
                custom={dir}
                initial={{ opacity: 0, x: dir * 40, filter: 'blur(8px)' }}
                animate={{ opacity: 1, x: 0, filter: 'blur(0px)' }}
                exit={{ opacity: 0, x: dir * -40, filter: 'blur(8px)' }}
                transition={{ duration: 0.36, ease: [0.2, 0.7, 0.2, 1] }}
                className="absolute inset-0 flex items-stretch justify-center pl-10 pr-8 sm:pl-14 sm:pr-12 pt-[72px]"
                style={{ paddingBottom: 64 }}
              >
                <Slide ctx={context} />
              </motion.main>
            </AnimatePresence>
          </ZoomPan>
        )}
        {blackout && <div className="absolute inset-0 bg-black" />}
      </div>

      {overview && (
        <Overview
          slides={slides}
          currentIndex={index}
          onPick={(i) => { goTo(i); setOverview(false); }}
          onClose={() => setOverview(false)}
        />
      )}

      {presenter && !overview && !blackout && (
        <PresenterOverlay
          slide={current}
          index={index}
          total={slides.length}
          startedAt={startedAt}
          onClose={() => setPresenter(false)}
        />
      )}

      {sseOpen && <SseDrawer onClose={() => setSseOpen(false)} />}
      {askOpen && <AskDeck slides={slides} onClose={() => setAskOpen(false)} />}
      {gotoOpen && (
        <GotoModal
          max={slides.length}
          onGo={(n) => { goTo(n - 1); setGotoOpen(false); }}
          onClose={() => setGotoOpen(false)}
        />
      )}

      <StatusBar
        index={index}
        total={slides.length}
        title={current.title}
        tint={current.tint}
        sseOpen={sseOpen}
      />
    </div>
  );
}
