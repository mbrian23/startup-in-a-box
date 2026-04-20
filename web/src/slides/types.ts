import type { ComponentType } from 'react';
import type { Tint } from '@/lib/palette';

export type SlideCtx = {
  demoFull: boolean;
  setDemoFull: (v: boolean) => void;
  slideIndex: number;
  slideCount: number;
};

export type SlideProps = { ctx: SlideCtx };

export type SlideMeta = {
  id: string;
  number: number;
  chapter: string;
  title: string;
  tint: Tint;
  notes: string;
  component: ComponentType<SlideProps>;
};
