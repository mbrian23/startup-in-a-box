export const palette = {
  bg: '#0A142E',
  dialog: '#1C2A4C',
  dialog2: '#121C38',
  gold: '#D4A84A',
  magenta: '#C45A5A',
  cyan: '#6BA8B8',
  cream: '#ECDFC0',
  moss: '#7A9E56',
  lila: '#8B6FA6',
  orange: '#C87A3A',
  greyline: '#5A5F7A',
} as const;

export type Tint = 'cyan' | 'gold' | 'magenta' | 'moss' | 'lila' | 'orange' | 'cream';

export const tintHex: Record<Tint, string> = {
  cyan: palette.cyan,
  gold: palette.gold,
  magenta: palette.magenta,
  moss: palette.moss,
  lila: palette.lila,
  orange: palette.orange,
  cream: palette.cream,
};
