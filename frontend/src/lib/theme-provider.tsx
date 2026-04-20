'use client';

/**
 * Theme context — persists the active theme id to localStorage and
 * mirrors it onto <html data-theme="..."> so CSS custom-property
 * overrides in globals.css apply globally. The theme object itself
 * (palette, brand, boardroom image) is available via useTheme() for
 * components that need to read it directly (header brand text,
 * Pixi boardroom background).
 *
 * Uses useSyncExternalStore so React reads the true persisted value
 * during hydration (via the getSnapshot path), while SSR gets the
 * default (via getServerSnapshot). The inline script in layout.tsx
 * sets data-theme pre-hydration so CSS doesn't flash either.
 */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useSyncExternalStore,
  type ReactNode,
} from 'react';
import { DEFAULT_THEME_ID, THEMES, getTheme, type Theme } from '../data/themes';

const STORAGE_KEY = 'sib:theme';

const listeners = new Set<() => void>();

function subscribe(cb: () => void): () => void {
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
  };
}

function getSnapshot(): string {
  try {
    return window.localStorage.getItem(STORAGE_KEY) ?? DEFAULT_THEME_ID;
  } catch {
    return DEFAULT_THEME_ID;
  }
}

function getServerSnapshot(): string {
  return DEFAULT_THEME_ID;
}

const TRANSITION_CLASS = 'theme-transitioning';
const TRANSITION_MS = 560;
let transitionTimer: number | null = null;

function writeTheme(id: string): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, id);
  } catch {
    // Private mode / quota — accept in-memory only.
  }
  const root = document.documentElement;
  // Re-trigger the animation even if the user rapid-fires themes: drop
  // the class, force a reflow, add it back.
  root.classList.remove(TRANSITION_CLASS);
  void root.offsetWidth;
  root.classList.add(TRANSITION_CLASS);
  if (transitionTimer !== null) window.clearTimeout(transitionTimer);
  transitionTimer = window.setTimeout(() => {
    root.classList.remove(TRANSITION_CLASS);
    transitionTimer = null;
  }, TRANSITION_MS);
  for (const cb of listeners) cb();
}

interface ThemeContextValue {
  theme: Theme;
  setTheme: (id: string) => void;
  themes: readonly Theme[];
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const themeId = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  useEffect(() => {
    document.documentElement.dataset.theme = themeId;
  }, [themeId]);

  const setTheme = useCallback((id: string) => writeTheme(id), []);

  const value = useMemo<ThemeContextValue>(
    () => ({ theme: getTheme(themeId), setTheme, themes: THEMES }),
    [themeId, setTheme],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used within ThemeProvider');
  return ctx;
}
