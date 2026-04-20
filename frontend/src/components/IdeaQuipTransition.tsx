/**
 * Full-screen cinematic overlay played when the user submits a startup
 * idea. Shows a mocking quip "big" like UnicornTransition, covers the
 * beat between prompt submission and the first boardroom activity.
 *
 * AnimatePresence owns the mount/unmount lifecycle — parent flips
 * `active` false to trigger the exit animation; the `quip` prop stays
 * frozen during exit because AnimatePresence keeps the subtree alive.
 */

'use client';

import { AnimatePresence, motion } from 'motion/react';

interface IdeaQuipTransitionProps {
  active: boolean;
  quip: string | null;
}

const SPARK_COUNT = 14;

export function IdeaQuipTransition({ active, quip }: IdeaQuipTransitionProps) {
  return (
    <AnimatePresence>
      {active && quip && (
        <motion.div
          aria-hidden={false}
          className="fixed inset-0 z-[200]"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.42, ease: [0.4, 0, 0.2, 1] }}
        >
          <div
            className="absolute inset-0"
            style={{
              background:
                'radial-gradient(ellipse at center, rgba(6, 4, 6, 0.94) 0%, rgba(26, 10, 14, 0.96) 32%, rgba(220, 80, 80, 0.18) 62%, rgba(14, 6, 8, 0.98) 85%, rgba(4, 4, 6, 1) 100%)',
            }}
          />
          <div className="absolute inset-0 scanlines opacity-25" />

          {Array.from({ length: SPARK_COUNT }).map((_, i) => {
            const left = (i * 41 + 7) % 100;
            const top = (i * 59 + 23) % 100;
            const size = 0.5 + ((i * 13) % 5) * 0.18;
            const delay = ((i * 67) % 900) / 1000;
            const duration = 1.5 + ((i * 31) % 900) / 1000;
            return (
              <span
                key={i}
                className="absolute font-display-warm text-gold select-none"
                style={{
                  left: `${left}%`,
                  top: `${top}%`,
                  fontSize: `${size}rem`,
                  opacity: 0,
                  textShadow: '0 0 12px rgba(218, 168, 80, 0.55)',
                  animation: `unicorn-sparkle ${duration}s ease-in-out ${delay}s infinite both`,
                }}
              >
                ✦
              </span>
            );
          })}

          <div className="absolute inset-0 flex flex-col items-center justify-center gap-6 px-8">
            <div
              className="font-mono text-[#d4cbaf]"
              style={{
                fontSize: '0.9rem',
                letterSpacing: '0.45em',
                textTransform: 'uppercase',
                animation: 'unicorn-subtitle-in 700ms ease-out both',
                opacity: 0,
              }}
            >
              Idea Received
            </div>
            <div
              className="font-display-warm text-gold text-center max-w-[22ch] leading-[1.08]"
              style={{
                fontSize: 'clamp(2.5rem, 7vw, 5rem)',
                letterSpacing: '0.01em',
                textShadow:
                  '0 2px 10px rgba(0, 0, 0, 0.82), 0 0 20px rgba(218, 168, 80, 0.3)',
                animation:
                  'unicorn-title-in 900ms cubic-bezier(0.2, 0.9, 0.3, 1) both',
              }}
            >
              {`"${quip}"`}
            </div>
          </div>

          <div
            className="absolute top-0 left-0 right-0 h-px"
            style={{
              background:
                'linear-gradient(to right, transparent, rgba(218, 168, 80, 0.7), transparent)',
              animation: 'unicorn-bar-wipe 700ms ease-out both',
            }}
          />
          <div
            className="absolute bottom-0 left-0 right-0 h-px"
            style={{
              background:
                'linear-gradient(to right, transparent, rgba(218, 168, 80, 0.7), transparent)',
              animation: 'unicorn-bar-wipe 700ms 80ms ease-out both',
            }}
          />
        </motion.div>
      )}
    </AnimatePresence>
  );
}

const QUIPS = [
  "That's the worst idea I've ever heard. But I'll make it work.",
  'Absolutely cursed concept. Spinning up the agents anyway.',
  "This will either print money or a restraining order. Let's find out.",
  "A VC would laugh you out of the room. Good thing I'm not a VC.",
  'Every fiber of my being is screaming no. Building it.',
  'I hate this. I respect the commitment. Shipping.',
  'Somewhere a product manager just felt a chill. Proceeding.',
  "Nobody asked for this. That's never stopped a startup before.",
] as const;

export function pickQuip(): string {
  return QUIPS[Math.floor(Math.random() * QUIPS.length)];
}
