/**
 * Full-screen alert played when the pipeline (orchestrator or factory)
 * surfaces a RUN_ERROR. Visual twin of UnicornTransition but in the
 * danger palette — AnimatePresence owns mount/unmount.
 *
 * Leans on a small joke bank so the user gets a moment of levity
 * before reading the actual error text.
 */

'use client';

import { useCallback } from 'react';
import { AnimatePresence, motion } from 'motion/react';

interface PipelineErrorOverlayProps {
  message: string | null;
  onDismiss: () => void;
}

// Match the first hit in order — specific before generic.
const JOKE_BANK: Array<{ match: RegExp; title: string; quip: string }> = [
  {
    match: /credit balance is too low|insufficient credit|billing|pro bono/i,
    title: 'OH, CHEAPSKATE?',
    quip:
      "Your Anthropic balance is at zero and the agents are side-eyeing you. " +
      'Cough up a few bucks — venture capital is cheaper than therapy for sad AIs.',
  },
  {
    match: /gemini says no|billing not enabled/i,
    title: 'GOOGLE WANTS THEIR MONEY',
    quip:
      "Gemini refuses to talk until the billing account is real and the API " +
      "is enabled. Pretending won't work — they can see the project ID.",
  },
  {
    match: /no google credentials|gcloud auth application-default/i,
    title: 'WHO ARE YOU, EVEN?',
    quip:
      "No Google credentials found. `gcloud auth application-default login` " +
      'fixes it — or hand over a GOOGLE_API_KEY and stop hiding.',
  },
  {
    match: /authentication|invalid api key|401|google_api_key|anthropic_api_key/i,
    title: 'AGENTS FORGOT THEIR PASSWORD',
    quip: 'Tried every variant of "hunter2". None worked. Check your API key env var.',
  },
  {
    match: /voicemail|rate limit|429|overloaded|quota|resource_exhausted/i,
    title: 'TOO MANY GENIUSES AT ONCE',
    quip: 'The API queue looks like a Black Friday espresso line. Sip, breathe, retry.',
  },
  {
    match: /timeout|timed out/i,
    title: 'AGENT WENT FOR A WALK',
    quip: "They didn't come back. Probably thinking really hard about a tab character.",
  },
  {
    match: /network|connect|ECONN|fetch failed/i,
    title: 'TUBES UNPLUGGED',
    quip: 'Somebody tripped over the internet again. Check the cord.',
  },
];

const DEFAULT_JOKE = {
  title: 'THE SILICON SPIRITS ARE QUIET',
  quip: 'Something broke. The logs know more than I do.',
};

function pickJoke(message: string | null) {
  if (!message) return DEFAULT_JOKE;
  for (const entry of JOKE_BANK) {
    if (entry.match.test(message)) return entry;
  }
  return DEFAULT_JOKE;
}

const SPARK_COUNT = 14;

export function PipelineErrorOverlay({ message, onDismiss }: PipelineErrorOverlayProps) {
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLButtonElement>) => {
      if (e.key === 'Escape') onDismiss();
    },
    [onDismiss],
  );

  const joke = pickJoke(message);

  return (
    <AnimatePresence>
      {message !== null && (
        <motion.div
          role="alertdialog"
          aria-live="assertive"
          className="fixed inset-0 z-[210] flex items-center justify-center"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.4, ease: [0.4, 0, 0.2, 1] }}
        >
          {/* Crimson radial wash */}
          <div
            className="absolute inset-0"
            style={{
              background:
                'radial-gradient(ellipse at center, rgba(232, 80, 80, 0.22) 0%, rgba(18, 6, 6, 0.96) 45%, rgba(4, 4, 6, 1) 100%)',
            }}
          />
          <div className="absolute inset-0 scanlines opacity-30" />

          {/* Glitch sparks */}
          {Array.from({ length: SPARK_COUNT }).map((_, i) => {
            const left = (i * 47 + 13) % 100;
            const top = (i * 61 + 23) % 100;
            const delay = ((i * 83) % 700) / 1000;
            const duration = 1.2 + ((i * 37) % 800) / 1000;
            return (
              <span
                key={i}
                className="absolute select-none font-mono"
                style={{
                  left: `${left}%`,
                  top: `${top}%`,
                  fontSize: '0.7rem',
                  color: '#e85050',
                  opacity: 0,
                  textShadow: '0 0 8px rgba(232, 80, 80, 0.7)',
                  animation: `unicorn-sparkle ${duration}s ease-in-out ${delay}s infinite both`,
                }}
              >
                ⚠
              </span>
            );
          })}

          {/* Card */}
          <motion.div
            className="relative z-10 glass-panel px-8 py-6 rounded-xl max-w-lg mx-5 text-center"
            initial={{ scale: 0.92, y: 8 }}
            animate={{ scale: 1, y: 0 }}
            exit={{ scale: 0.92, y: 8 }}
            transition={{ duration: 0.4, ease: [0.2, 0.9, 0.3, 1] }}
            style={{
              background: 'rgba(16, 6, 6, 0.88)',
              border: '1px solid rgba(232, 80, 80, 0.35)',
              boxShadow:
                '0 20px 80px rgba(232, 80, 80, 0.18), 0 0 0 1px rgba(232, 80, 80, 0.12)',
            }}
          >
            <div
              className="font-display-warm"
              style={{
                color: '#ff8888',
                fontSize: 'clamp(1.8rem, 4vw, 2.8rem)',
                letterSpacing: '0.12em',
                textShadow:
                  '0 0 18px rgba(232, 80, 80, 0.55), 0 0 4px rgba(232, 80, 80, 0.8)',
                animation:
                  'unicorn-title-in 820ms cubic-bezier(0.2, 0.9, 0.3, 1) both',
              }}
            >
              ⚠ {joke.title} ⚠
            </div>

            <div
              className="font-mono mt-3 text-[#f2c0c0]"
              style={{
                fontSize: '0.95rem',
                letterSpacing: '0.03em',
                lineHeight: 1.55,
                animation: 'unicorn-subtitle-in 820ms 180ms ease-out both',
                opacity: 0,
              }}
            >
              {joke.quip}
            </div>

            <div
              className="mt-5 px-4 py-3 font-mono rounded-md text-left"
              style={{
                background: 'rgba(0, 0, 0, 0.35)',
                border: '1px solid rgba(232, 80, 80, 0.15)',
                color: '#e0d0d0',
                fontSize: '0.85rem',
                letterSpacing: '0.02em',
                lineHeight: 1.5,
                maxHeight: '9rem',
                overflowY: 'auto',
                animation: 'unicorn-subtitle-in 820ms 300ms ease-out both',
                opacity: 0,
              }}
            >
              {message}
            </div>

            <button
              type="button"
              onClick={onDismiss}
              onKeyDown={handleKeyDown}
              autoFocus
              className="mt-5 font-mono uppercase tracking-[0.3em] rounded-md px-4 py-2 transition-colors"
              style={{
                color: '#ffcbcb',
                fontSize: '0.8rem',
                background:
                  'linear-gradient(135deg, rgba(232, 80, 80, 0.28), rgba(232, 80, 80, 0.12))',
                border: '1px solid rgba(232, 80, 80, 0.4)',
                animation: 'unicorn-subtitle-in 820ms 440ms ease-out both',
                opacity: 0,
              }}
            >
              Dismiss
            </button>
          </motion.div>

          {/* Top + bottom wipes */}
          <div
            className="absolute top-0 left-0 right-0 h-px"
            style={{
              background:
                'linear-gradient(to right, transparent, rgba(232, 80, 80, 0.7), transparent)',
              animation: 'unicorn-bar-wipe 650ms ease-out both',
            }}
          />
          <div
            className="absolute bottom-0 left-0 right-0 h-px"
            style={{
              background:
                'linear-gradient(to right, transparent, rgba(232, 80, 80, 0.7), transparent)',
              animation: 'unicorn-bar-wipe 650ms 80ms ease-out both',
            }}
          />
        </motion.div>
      )}
    </AnimatePresence>
  );
}
