/**
 * Boardroom desaturation cinematic — drives a CSS saturate() filter
 * during the handoff from boardroom to factory.
 */

import { useEffect, useRef, useState } from 'react';

export type HandoffStage = 'idle' | 'preparing' | 'launched' | 'returned' | 'failed';
export type PowerState = 'off' | 'on' | 'error' | 'receiving' | 'dark' | 'online';

export interface AnimationSnapshot {
  boardroomDesaturation: number;
  errorActive: boolean;
  isAnimating: boolean;
}

const DESAT_DURATION_MS = 600;
const DESAT_INTERVAL_MS = 16;

export function useHandoffAnimation(
  handoffStage: HandoffStage | undefined,
  _variant: 'dark' | 'light' = 'dark',
): AnimationSnapshot {
  const [desaturation, setDesaturation] = useState(0);
  const [errorActive, setErrorActive] = useState(false);
  const animating = useRef(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }

    if (handoffStage === 'preparing' || handoffStage === 'launched') {
      animating.current = true;
      setErrorActive(false);
      const steps = DESAT_DURATION_MS / DESAT_INTERVAL_MS;
      let step = 0;
      timerRef.current = setInterval(() => {
        step++;
        const progress = Math.min(step / steps, 1);
        setDesaturation(progress * 0.85);
        if (progress >= 1) {
          if (timerRef.current) clearInterval(timerRef.current);
          timerRef.current = null;
          animating.current = false;
        }
      }, DESAT_INTERVAL_MS);
    } else if (handoffStage === 'returned' || handoffStage === 'idle') {
      animating.current = true;
      const steps = DESAT_DURATION_MS / DESAT_INTERVAL_MS;
      let step = 0;
      const startDesat = desaturation;
      timerRef.current = setInterval(() => {
        step++;
        const progress = Math.min(step / steps, 1);
        setDesaturation(startDesat * (1 - progress));
        if (progress >= 1) {
          if (timerRef.current) clearInterval(timerRef.current);
          timerRef.current = null;
          animating.current = false;
        }
      }, DESAT_INTERVAL_MS);
    } else if (handoffStage === 'failed') {
      setErrorActive(true);
      animating.current = false;
    }

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [handoffStage]); // eslint-disable-line react-hooks/exhaustive-deps

  return {
    boardroomDesaturation: desaturation,
    errorActive,
    isAnimating: animating.current,
  };
}
