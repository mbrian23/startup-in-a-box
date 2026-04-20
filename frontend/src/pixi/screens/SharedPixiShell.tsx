'use client';

/**
 * Top-level shell for the boardroom Pixi scene — mounts a single
 * <Application> once and keeps it alive across screen swaps so the GL
 * context and the global Assets cache survive boardroom ↔ factory
 * transitions.
 *
 * The factory screen no longer uses a Pixi scene (it renders an
 * agent-flow iframe instead), so this shell only hosts the boardroom.
 */

import { Suspense, useEffect, useMemo, useRef, useState } from 'react';
import { Application } from '@pixi/react';
import '../extend';
import { useSceneImpl } from '../../lib/scene-provider';
import { useTheme } from '../../lib/theme-provider';
import { buildBoardroomMap } from '../../data/boardroom-layout';
import type { AgUiState } from '../../hooks/useAgUiEvents';
import { readHandoffStage } from '../../hooks/useAgUiEvents';
import { useHandoffAnimation } from '../../hooks/useHandoffAnimation';

interface SharedPixiShellProps {
  active: 'boardroom' | 'factory';
  boardroomState: AgUiState;
  phaseBanner?: string | null;
}

export function SharedPixiShell({
  active,
  boardroomState,
  phaseBanner,
}: SharedPixiShellProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState<{ w: number; h: number } | null>(null);
  const { BoardroomScene } = useSceneImpl();
  const { theme } = useTheme();
  const map = useMemo(() => buildBoardroomMap(theme.boardroomImage), [theme.boardroomImage]);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const update = () => {
      const { clientWidth, clientHeight } = el;
      if (clientWidth > 0 && clientHeight > 0) {
        setSize({ w: clientWidth, h: clientHeight });
      }
    };
    // Initial measurement has to happen post-mount because DOM
    // dimensions aren't available until the ref is attached.
    // eslint-disable-next-line react-you-might-not-need-an-effect/no-initialize-state -- reading DOM requires an effect; no SSR-shareable default exists.
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Desaturation filter during boardroom handoff — only applies while the
  // boardroom is the active screen.
  const handoffStage = readHandoffStage(boardroomState.boardState);
  const boardroomAnim = useHandoffAnimation(handoffStage, 'dark');

  const filter =
    active === 'boardroom'
      ? `saturate(${1 - boardroomAnim.boardroomDesaturation})`
      : undefined;

  return (
    <div
      ref={containerRef}
      style={{
        width: '100%',
        height: '100%',
        filter,
        transition: 'filter 400ms ease-in-out',
      }}
    >
      {size && (
        <Application
          width={size.w}
          height={size.h}
          background={0x0a0a12}
          antialias={false}
          resolution={1}
          resizeTo={containerRef}
        >
          <Suspense fallback={null}>
            <BoardroomScene
              map={map}
              agents={boardroomState.agents}
              celebration={boardroomState.celebration}
              screenW={size.w}
              screenH={size.h}
              phaseBanner={phaseBanner ?? null}
            />
          </Suspense>
        </Application>
      )}
    </div>
  );
}
