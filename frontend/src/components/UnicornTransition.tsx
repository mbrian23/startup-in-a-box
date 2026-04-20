/**
 * Full-screen cinematic overlay played when the user rebirths the
 * session via the "New Unicorn" button. Timed to cover the threadId
 * rotation so the App subtree remounts invisibly behind the curtain.
 *
 * AnimatePresence owns the mount/unmount lifecycle — when `active`
 * flips false, motion keeps the subtree alive for the exit animation,
 * then unmounts. That replaces the hand-rolled timer+state pattern.
 */

'use client';

import { AnimatePresence, motion } from 'motion/react';

interface UnicornTransitionProps {
  active: boolean;
}

const SPARKLE_COUNT = 18;

export function UnicornTransition({ active }: UnicornTransitionProps) {
  return (
    <AnimatePresence>
      {active && (
        <motion.div
          aria-hidden={false}
          className="fixed inset-0 z-[200]"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.48, ease: [0.4, 0, 0.2, 1] }}
        >
          {/* Dark well at the center (where text lives) with a gold halo
              ringing out around it — keeps the "golden unicorn" feel
              without washing out the title with yellow-on-yellow. */}
          <div
            className="absolute inset-0"
            style={{
              background:
                'radial-gradient(ellipse at center, rgba(6, 4, 4, 0.94) 0%, rgba(28, 20, 10, 0.95) 30%, rgba(218, 168, 80, 0.22) 58%, rgba(18, 12, 6, 0.98) 82%, rgba(4, 4, 6, 1) 100%)',
            }}
          />
          <div className="absolute inset-0 scanlines opacity-30" />

          {/* Floating sparkles */}
          {Array.from({ length: SPARKLE_COUNT }).map((_, i) => {
            const left = (i * 37 + 11) % 100;
            const top = (i * 53 + 17) % 100;
            const size = 0.55 + ((i * 17) % 5) * 0.18;
            const delay = ((i * 71) % 900) / 1000;
            const duration = 1.6 + ((i * 29) % 900) / 1000;
            return (
              <span
                key={i}
                className="absolute font-display-warm text-gold select-none"
                style={{
                  left: `${left}%`,
                  top: `${top}%`,
                  fontSize: `${size}rem`,
                  opacity: 0,
                  textShadow: '0 0 12px rgba(218, 168, 80, 0.6)',
                  animation: `unicorn-sparkle ${duration}s ease-in-out ${delay}s infinite both`,
                }}
              >
                ✦
              </span>
            );
          })}

          {/* Center piece */}
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-5">
            <div
              className="font-display-warm text-gold relative"
              style={{
                fontSize: 'clamp(2.5rem, 7vw, 5rem)',
                letterSpacing: '0.12em',
                textShadow:
                  '0 2px 10px rgba(0, 0, 0, 0.8), 0 0 22px rgba(218, 168, 80, 0.35)',
                animation:
                  'unicorn-title-in 900ms cubic-bezier(0.2, 0.9, 0.3, 1) both',
              }}
            >
              <span style={{ opacity: 0.9 }}>✦ </span>
              A NEW UNICORN
              <span style={{ opacity: 0.9 }}> ✦</span>
            </div>
            <div
              className="font-mono text-[#d4cbaf]"
              style={{
                fontSize: '0.9rem',
                letterSpacing: '0.45em',
                textTransform: 'uppercase',
                animation: 'unicorn-subtitle-in 900ms 220ms ease-out both',
                opacity: 0,
              }}
            >
              Fresh Timeline · Dream Again
            </div>
          </div>

          {/* Top + bottom accent bars wiping in */}
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
