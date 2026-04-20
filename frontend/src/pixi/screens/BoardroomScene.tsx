'use client';

/**
 * BoardroomScene — SceneRenderer subtree for the boardroom tilemap.
 *
 * Intended to be mounted inside a shared <Application> owned by a parent
 * shell so the GL context survives screen swaps.
 */

import '../extend';
import { SceneRenderer } from '../components/SceneRenderer';
import type { BoardroomSceneProps } from '../../lib/scene-contract';
import {
  BOARDROOM_ZONES,
  BOARDROOM_WORK_STATIONS,
  BOARDROOM_MEET_POINT,
} from '../../lib/zones';

export function BoardroomScene({
  map,
  agents,
  celebration,
  screenW,
  screenH,
  phaseBanner,
}: BoardroomSceneProps) {
  return (
    <SceneRenderer
      map={map}
      agents={agents}
      celebration={celebration}
      zones={BOARDROOM_ZONES}
      workStations={BOARDROOM_WORK_STATIONS}
      meetPoint={BOARDROOM_MEET_POINT}
      ambientVariant="warm"
      screenW={screenW}
      screenH={screenH}
      phaseBanner={phaseBanner}
    />
  );
}
