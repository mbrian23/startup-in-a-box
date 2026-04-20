/**
 * Type augmentation for pixi-viewport's Viewport registered via @pixi/react extend().
 * Since Viewport isn't a pixi.js export, @pixi/react's auto-generated types
 * don't include it. We declare it manually here.
 */

import type { Viewport } from 'pixi-viewport';

type ViewportProps = Omit<
  Partial<ConstructorParameters<typeof Viewport>[0]>,
  'ticker'
> & {
  ref?: React.Ref<Viewport>;
  children?: React.ReactNode;
  key?: React.Key;
};

declare module 'react' {
  namespace JSX {
    interface IntrinsicElements {
      pixiViewport: ViewportProps;
    }
  }
}

declare module 'react/jsx-runtime' {
  namespace JSX {
    interface IntrinsicElements {
      pixiViewport: ViewportProps;
    }
  }
}

declare module 'react/jsx-dev-runtime' {
  namespace JSX {
    interface IntrinsicElements {
      pixiViewport: ViewportProps;
    }
  }
}
