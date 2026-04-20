/**
 * Visual themes — palette + boardroom background + brand text.
 *
 * Each theme is a pure config object consumed by the ThemeProvider, which
 * applies CSS custom-property overrides via `data-theme="<id>"` on <html>,
 * swaps the boardroom background image, and hands the brand string to
 * AppHeader. No per-theme image assets except the boardroom PNG itself.
 *
 * Palettes were sampled from the corresponding boardroom PNG so the
 * HUD/panel chrome sits coherently over the pixel art.
 */

export interface ThemePalette {
  /** Primary accent — used for headers, highlights, gold-ish warm role. */
  accent: string;
  /** Secondary accent — factory/cool role. */
  accentAlt: string;
  /** Page background. */
  bg: string;
  /** Elevated panel background (rgba). */
  surface: string;
  /** Subtler border (rgba). */
  border: string;
  /** Primary body text. */
  text: string;
  /** Muted / secondary text. */
  muted: string;
}

export interface ThemeBrand {
  /** Top-left header title. */
  name: string;
  /** Pre-text glyph (unicode/emoji) — shown next to the name. */
  glyph: string;
  /** Subtitle / tagline shown in subtle chrome (optional). */
  tagline?: string;
}

export interface Theme {
  id: string;
  /** Boardroom background PNG at 1248×1152 rendered into the 624×576 grid. */
  boardroomImage: string;
  palette: ThemePalette;
  brand: ThemeBrand;
}

const RETRO_OFFICE: Theme = {
  id: 'retro-office',
  boardroomImage: '/assets/retro-office.png',
  palette: {
    accent: '#daa850',
    accentAlt: '#6090ee',
    bg: '#0c0804',
    surface: 'rgba(24, 18, 10, 0.82)',
    border: 'rgba(200, 150, 60, 0.12)',
    text: '#d4cbaf',
    muted: '#7a7060',
  },
  brand: {
    name: 'Startup in a Box',
    glyph: '◆',
    tagline: 'Unicorn Factory',
  },
};

const HOTDOG: Theme = {
  id: 'hotdog',
  boardroomImage: '/assets/boardrooms/hotdog.png',
  palette: {
    accent: '#f0c030',
    accentAlt: '#d84030',
    bg: '#1a0e0a',
    surface: 'rgba(38, 18, 14, 0.82)',
    border: 'rgba(240, 192, 48, 0.18)',
    text: '#f5d88a',
    muted: '#8a5540',
  },
  brand: {
    name: 'Weiner Ventures',
    glyph: '🌭',
    tagline: '3×3 Growth · Always Toasted',
  },
};

const RAMEN: Theme = {
  id: 'ramen-2049',
  boardroomImage: '/assets/boardrooms/ramen.png',
  palette: {
    accent: '#ff4090',
    accentAlt: '#40c8d0',
    bg: '#0e0820',
    surface: 'rgba(30, 16, 50, 0.82)',
    border: 'rgba(255, 64, 144, 0.18)',
    text: '#f0c8e0',
    muted: '#7060a0',
  },
  brand: {
    name: 'Ramen-Ya 2049',
    glyph: '⛩',
    tagline: 'Neo-Tokyo Cybernetics Division',
  },
};

const PENAROL: Theme = {
  id: 'penarol',
  boardroomImage: '/assets/boardrooms/penarol.png',
  palette: {
    accent: '#e8b830',
    accentAlt: '#b07820',
    bg: '#0a0806',
    surface: 'rgba(38, 26, 10, 0.86)',
    border: 'rgba(232, 184, 48, 0.18)',
    text: '#f0dca0',
    muted: '#8a6a28',
  },
  brand: {
    name: 'Peñarol',
    glyph: '★',
    tagline: 'Club Atlético Peñarol · Aurinegros · 1891',
  },
};

const MESSI: Theme = {
  id: 'messi',
  boardroomImage: '/assets/boardrooms/messi.png',
  palette: {
    accent: '#f0c850',
    accentAlt: '#6a8ac8',
    bg: '#1a2240',
    surface: 'rgba(28, 42, 80, 0.82)',
    border: 'rgba(240, 200, 80, 0.20)',
    text: '#f0dcb0',
    muted: '#7090b0',
  },
  brand: {
    name: 'Messi & Asociados',
    glyph: '⚽',
    tagline: 'Campeón del Mundo · Siete Balones de Oro',
  },
};

export const THEMES: readonly Theme[] = [RETRO_OFFICE, HOTDOG, RAMEN, PENAROL, MESSI];
export const DEFAULT_THEME_ID = RETRO_OFFICE.id;

export function getTheme(id: string | null | undefined): Theme {
  if (!id) return RETRO_OFFICE;
  return THEMES.find((t) => t.id === id) ?? RETRO_OFFICE;
}
