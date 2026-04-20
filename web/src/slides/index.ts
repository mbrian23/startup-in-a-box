import type { SlideMeta } from './types';

import Slide01, { meta as m01 } from './01-title';
import Slide02, { meta as m02 } from './02-whoami';
import Slide03, { meta as m03 } from './03-dumb-idea';
import Slide04, { meta as m04 } from './04-thesis';
import Slide05, { meta as m05 } from './05-stage1-divider';
import Slide06, { meta as m06 } from './06-tool-calling';
import Slide07, { meta as m07 } from './07-routers-vs-loops';
import Slide08, { meta as m08 } from './08-claude-code-teaser';
import Slide09, { meta as m09 } from './09-stage1-close';
import Slide10, { meta as m10 } from './10-scopeA-divider';
import Slide11, { meta as m11 } from './11-plugins';
import Slide12, { meta as m12 } from './12-skills';
import Slide13, { meta as m13 } from './13-config';
import Slide14, { meta as m14 } from './14-plan-mode';
import Slide15, { meta as m15 } from './15-scopeB-divider';
import Slide16, { meta as m16 } from './16-llmagent-anatomy';
import Slide17, { meta as m17 } from './17-boardroom-cast';
import Slide18, { meta as m18 } from './18-output-schema-trap';
import Slide19, { meta as m19 } from './19-reviewer-loop';
import Slide21, { meta as m21 } from './21-scopeC-divider';
import Slide22, { meta as m22 } from './22-supervisor-subagents';
import Slide23, { meta as m23 } from './23-per-tier-permissions';
import Slide24, { meta as m24 } from './24-hermetic-sandbox';
import Slide25, { meta as m25 } from './25-hooks';
import Slide26, { meta as m26 } from './26-pydantic-contract';
import Slide27, { meta as m27 } from './27-dual-path-skills';
import Slide28, { meta as m28 } from './28-stage3-divider';
import Slide29, { meta as m29 } from './29-demo-stack';
import Slide30, { meta as m30 } from './30-handoff-postmortem';
import Slide31, { meta as m31 } from './31-hitl-gate';
import Slide32, { meta as m32 } from './32-agui-reducer';
import Slide33, { meta as m33 } from './33-live-demo';
import Slide34, { meta as m34 } from './34-lessons';
import Slide35, { meta as m35 } from './35-credits';
import Slide36, { meta as m36 } from './36-thanks';

export const slides: SlideMeta[] = [
  { ...m01, component: Slide01 },
  { ...m02, component: Slide02 },
  { ...m03, component: Slide03 },
  { ...m04, component: Slide04 },
  { ...m05, component: Slide05 },
  { ...m06, component: Slide06 },
  { ...m07, component: Slide07 },
  { ...m08, component: Slide08 },
  { ...m09, component: Slide09 },
  { ...m10, component: Slide10 },
  { ...m11, component: Slide11 },
  { ...m12, component: Slide12 },
  { ...m13, component: Slide13 },
  { ...m14, component: Slide14 },
  { ...m15, component: Slide15 },
  { ...m16, component: Slide16 },
  { ...m17, component: Slide17 },
  { ...m18, component: Slide18 },
  { ...m19, component: Slide19 },
  { ...m21, component: Slide21 },
  { ...m22, component: Slide22 },
  { ...m23, component: Slide23 },
  { ...m24, component: Slide24 },
  { ...m25, component: Slide25 },
  { ...m26, component: Slide26 },
  { ...m27, component: Slide27 },
  { ...m28, component: Slide28 },
  { ...m29, component: Slide29 },
  { ...m30, component: Slide30 },
  { ...m31, component: Slide31 },
  { ...m32, component: Slide32 },
  { ...m33, component: Slide33 },
  { ...m34, component: Slide34 },
  { ...m35, component: Slide35 },
  { ...m36, component: Slide36 },
];
