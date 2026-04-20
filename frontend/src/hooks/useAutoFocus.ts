/**
 * Auto-drives which screen is active based on pipeline phase and handoff stage.
 * Manual override via tab click; auto resumes on next phase/stage change.
 */

import { useEffect, useCallback, useState, useRef } from 'react';
import type { AgentPhase } from './useAgentActivity';
import type { HandoffStage } from './useHandoffAnimation';

export type ActiveScreen = 'boardroom' | 'factory';

const RETURN_HOLD_MS = 4000;

export function useAutoFocus(phase: AgentPhase, handoffStage: HandoffStage) {
  const [active, setActive] = useState<ActiveScreen>('boardroom');
  const manualOverrideRef = useRef(false);

  useEffect(() => {
    manualOverrideRef.current = false;

    switch (phase) {
      case 'thinking':
      case 'researching':
        setActive('boardroom');
        break;
      case 'building':
        setActive('factory');
        break;
    }
  }, [phase]);

  useEffect(() => {
    // Failed handoff: stay on factory so the error UI stays in context.
    // Manual override: respect the user's tab choice.
    if (handoffStage !== 'returned' || manualOverrideRef.current) return;

    const timer = setTimeout(() => {
      if (!manualOverrideRef.current) setActive('boardroom');
    }, RETURN_HOLD_MS);

    return () => clearTimeout(timer);
  }, [handoffStage]);

  const switchTo = useCallback((screen: ActiveScreen) => {
    manualOverrideRef.current = true;
    setActive(screen);
  }, []);

  return { active, switchTo };
}
