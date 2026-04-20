---
name: new-theme
description: Add a new visual theme to Startup in a Box — palette, boardroom background image, and brand chip. Use when the user asks to "add a theme", "create a theme", "wire up the [X] theme", provides a new boardroom PNG/JPG and wants it swappable, or mentions specific theme names (e.g., "make a cyberpunk theme", "add the Peñarol one"). Also triggers on color palette / branding / cosmetic customization requests for the app.
---

# New Theme

Add a swappable visual theme covering palette, boardroom background, and brand chip. Themes are pure config — no component changes needed.

## Theme = three things

1. **Boardroom PNG** under `frontend/public/assets/boardrooms/` (one image, 624×576 logical dims, rendered at ~1248×1152 for retina, ~300–700 KB palette-compressed).
2. **Theme entry** in `frontend/src/data/themes.ts` (palette sampled from the PNG, brand name + glyph).
3. **CSS override block** in `frontend/src/app/globals.css` under `[data-theme="<id>"]`.

Swapping at runtime is already wired via `src/lib/theme-provider.tsx` + `src/components/ThemePicker.tsx` — no need to touch them unless you're extending the theme shape.

## Key files

| File | Role |
|---|---|
| `frontend/src/data/themes.ts` | Theme registry. Source of truth. |
| `frontend/src/app/globals.css` | Per-theme CSS variable overrides. |
| `frontend/public/assets/boardrooms/` | Boardroom PNGs, one per theme. |
| `frontend/src/lib/theme-provider.tsx` | Runtime swap logic — read-only reference. |
| `frontend/src/components/AppHeader.tsx` | Shows brand chip (`theme.brand.name` + `theme.brand.glyph`). |
| `frontend/src/data/boardroom-layout.ts` | `buildBoardroomMap(url)` consumes `theme.boardroomImage`. |

## Procedure

### 1. Prepare the image

Source image goes somewhere at repo root (user usually drops it there). Convert, resize, and palette-compress in one shot:

```bash
# From frontend/ dir. Works for .png or .jpg sources.
node -e "
const sharp = require('sharp');
const src = '../<source-filename>';
const out = 'public/assets/boardrooms/<theme-id>.png';
sharp(src)
  .resize(1248, 1152, { kernel: 'nearest', fit: 'fill' })
  .png({ palette: true, quality: 90, compressionLevel: 9, effort: 10 })
  .toFile(out);
"
```

Then delete the source from repo root:
```bash
rm ../<source-filename>
```

**Sizing rules:**
- Logical grid is 624×576 (13×12 @ 48 px). Render dims should be 2× (1248×1152) for retina crispness.
- Targets: ~300–700 KB after palette compression. If larger, lower the palette quality or reduce to 1:1 logical size (624×576).
- If source is close to aspect ratio 1.083 (1248/1152), just resize; otherwise crop or letterbox first before resizing.
- `kernel: 'nearest'` preserves pixel-art edges. Never use lanczos/bicubic on pixel-art sources.

### 2. Sample the palette

Look at the image and pick six colors that match the baked art. Five of these become CSS variable overrides; the sixth (`accentAlt`) is future-facing for factory chrome.

| Field | Purpose | What to pick |
|---|---|---|
| `accent` | Primary warm accent (headings, highlights, button borders) | The most saturated "hero" color in the image (signage, logo, neon). Must be readable on `bg`. |
| `accentAlt` | Reserved for factory/secondary chrome | A complementary color from the image (opposing hue, usually) |
| `bg` | Page background behind panels | The darkest chroma-rich tone — usually the outside/sky or a wall shadow. Near-black but not pure `#000`. |
| `surface` | Panel background (rgba, alpha 0.80–0.86) | A slightly-lifted version of `bg`. Keep alpha ≥ 0.80 so panel text reads over bright Pixi floors. |
| `border` | Subtle panel border (rgba) | Accent hue at 0.14–0.22 alpha. |
| `text` | Body text on surfaces | A pale cream/tint that matches the image's light accents. Must hit AA contrast vs `surface`. |
| `muted` | Secondary text (labels, taglines) | Mid-tone from the image's shadows/furniture. |

Additionally derive:
- `--color-warm-accent-rgb`: the `accent` color as three space-separated 0–255 integers (e.g., `240 200 80`). Used for alpha variants via `rgb(var(--color-warm-accent-rgb) / α)`.
- `--color-warm-accent-dim`: accent at 0.40 alpha.
- `--color-warm-accent-glow`: accent (or a complementary tone) at 0.08–0.12 alpha.
- `--color-warm-surface-elevated`: slightly lighter `surface` at 0.75 alpha.
- `--color-warm-border-bright`: accent at 0.25–0.38 alpha.
- `--color-bg-dark`: a touch darker than `bg`, used by handoff overlays.

### 3. Add the theme entry

Append to `frontend/src/data/themes.ts` — after the other themes, before the `THEMES` export:

```ts
const MY_THEME: Theme = {
  id: 'my-theme',                             // kebab-case; used in localStorage + data-theme attr
  boardroomImage: '/assets/boardrooms/my-theme.png',
  palette: {
    accent: '#xxxxxx',
    accentAlt: '#xxxxxx',
    bg: '#xxxxxx',
    surface: 'rgba(x, x, x, 0.82)',
    border: 'rgba(x, x, x, 0.18)',
    text: '#xxxxxx',
    muted: '#xxxxxx',
  },
  brand: {
    name: 'My Theme',                         // shown in picker + header chip
    glyph: '★',                               // unicode/emoji shown next to name in header
    tagline: 'Optional tagline',              // hover tooltip
  },
};
```

Then add to the registry:
```ts
export const THEMES: readonly Theme[] = [RETRO_OFFICE, HOTDOG, RAMEN, PENAROL, MESSI, MY_THEME];
```

### 4. Add the CSS override block

In `frontend/src/app/globals.css`, under the existing `[data-theme="..."]` blocks:

```css
[data-theme="my-theme"] {
  --color-warm-bg: #xxxxxx;
  --color-warm-surface: rgba(x, x, x, 0.82);
  --color-warm-surface-elevated: rgba(x, x, x, 0.75);
  --color-warm-border: rgba(x, x, x, 0.18);
  --color-warm-border-bright: rgba(x, x, x, 0.35);
  --color-warm-accent: #xxxxxx;
  --color-warm-accent-rgb: R G B;             /* space-separated, no commas */
  --color-warm-accent-dim: rgba(R, G, B, 0.4);
  --color-warm-accent-glow: rgba(R, G, B, 0.10);
  --color-warm-text: #xxxxxx;
  --color-warm-muted: #xxxxxx;
  --color-gold: #xxxxxx;                      /* Tailwind `text-gold` falls through this */
  --color-bg-dark: #xxxxxx;
}
```

**Important:** `--color-warm-accent-rgb` is load-bearing. All dynamic alpha styling across IdeaLauncher, AppHeader buttons, ScreenTabs, artifact PDF button, glow-ring animation, and gradient-border-warm reads through it via `rgb(var(--color-warm-accent-rgb) / α)`. Get the channels right or the chrome won't tint.

### 5. Verify

```bash
cd frontend
npx tsc --noEmit
npx eslint src/data/themes.ts src/app/globals.css
```

Then run the dev server and swap via the picker. What to look for:
- Brand chip next to "Startup in a Box" shows the new brand name + glyph.
- Boardroom background PNG loads.
- AppHeader gradient underline, New Unicorn button, ScreenTabs, and IdeaLauncher all pick up the new accent.
- The 560 ms color-wash flash fires on theme switch.
- Panel text on bright Pixi floors (if any) is still legible — if not, bump `surface` alpha up toward 0.88.

## Contrast guardrails

Every theme must clear these:
- `text` on `surface` — hit WCAG AA (≥ 4.5:1).
- `accent` on `bg` — readable at body text sizes.
- `accent` on `surface` — readable for buttons and labels.

Quick sanity: plug pairs into https://webaim.org/resources/contrastchecker/ — or use any contrast checker. If a pair fails, darken the bg/surface or pull `text` toward cream.

**Known contrast pitfalls:**
- Bright Pixi floor (hotdog yellow, Messi yellow) under glass panels washes out panel text if `surface` alpha dips below 0.80.
- Pure light-mode themes break the existing Pixi/HUD assumption that backgrounds are dark. Avoid unless you pair with a CSS filter on the Pixi stage — out of scope for a v1 theme add.
- Pink/magenta accents over dark purple (ramen-2049) look cohesive but reduce the accent's readability on `surface` — verify button labels specifically.

## Don't do

- **Don't add per-theme fonts** unless absolutely required — Google Fonts links count as new assets and bloat the page.
- **Don't create per-theme asset folders** for chrome (icons, logos, SVGs). Unicode/emoji glyphs in `brand.glyph` cover 99% of logo needs.
- **Don't change the boardroom grid dims.** All themes share 624×576 collision because agent seating is the same 3×2 desk grid. If the new image has desks in different positions, either re-author the ASCII floor plan in `boardroom-collision.ts` (heavy lift) or ask the user to regenerate the image with the standard desk grid.
- **Don't touch `retro-office`** — it's the default fallback and SSR anchor. Modifying its palette can cause hydration flashes for users with no localStorage.
- **Don't hardcode new gold/warm rgba literals** in components. Use `rgb(var(--color-warm-accent-rgb) / α)` or a theme-aware Tailwind class.

## Example: adding "Cybersynth" theme (reference)

Imagine the user drops `cybersynth_source.png` at repo root and asks for a new theme.

```bash
# 1. Process image
cd frontend
node -e "
const sharp = require('sharp');
sharp('../cybersynth_source.png')
  .resize(1248, 1152, { kernel: 'nearest', fit: 'fill' })
  .png({ palette: true, quality: 90, compressionLevel: 9, effort: 10 })
  .toFile('public/assets/boardrooms/cybersynth.png');
"
rm ../cybersynth_source.png
```

Sample palette from the image (hypothetical): neon teal `#00e8d4` on deep violet `#1a0838`. Pick complementary magenta `#ff3080` for `accentAlt`.

Add to `themes.ts`:
```ts
const CYBERSYNTH: Theme = {
  id: 'cybersynth',
  boardroomImage: '/assets/boardrooms/cybersynth.png',
  palette: {
    accent: '#00e8d4',
    accentAlt: '#ff3080',
    bg: '#1a0838',
    surface: 'rgba(36, 16, 64, 0.84)',
    border: 'rgba(0, 232, 212, 0.18)',
    text: '#c8f0ec',
    muted: '#7060a8',
  },
  brand: {
    name: 'Cybersynth Industries',
    glyph: '◈',
    tagline: 'Synthwave · Neon · Future-Past',
  },
};
// …
export const THEMES = [..., CYBERSYNTH];
```

Add CSS block in `globals.css`:
```css
[data-theme="cybersynth"] {
  --color-warm-bg: #1a0838;
  --color-warm-surface: rgba(36, 16, 64, 0.84);
  --color-warm-surface-elevated: rgba(56, 28, 96, 0.75);
  --color-warm-border: rgba(0, 232, 212, 0.18);
  --color-warm-border-bright: rgba(0, 232, 212, 0.35);
  --color-warm-accent: #00e8d4;
  --color-warm-accent-rgb: 0 232 212;
  --color-warm-accent-dim: rgba(0, 232, 212, 0.4);
  --color-warm-accent-glow: rgba(255, 48, 128, 0.10);
  --color-warm-text: #c8f0ec;
  --color-warm-muted: #7060a8;
  --color-gold: #00e8d4;
  --color-bg-dark: #0e041e;
}
```

Verify, test in picker. Done.
