/**
 * Small dropdown to switch visual themes. Sits next to the header
 * brand. Native <select> styled to match the v0.1 badge chrome.
 */

import { useTheme } from '../lib/theme-provider';

export function ThemePicker() {
  const { theme, setTheme, themes } = useTheme();
  return (
    <label className="relative flex items-center">
      <span className="sr-only">Theme</span>
      <select
        value={theme.id}
        onChange={(e) => setTheme(e.target.value)}
        className="appearance-none text-[0.65rem] uppercase tracking-[0.15em] font-mono px-2.5 py-0.5 pr-6 rounded cursor-pointer"
        style={{
          color: 'var(--color-warm-accent)',
          border: '1px solid var(--color-warm-border-bright)',
          background: 'var(--color-warm-accent-glow)',
        }}
      >
        {themes.map((t) => (
          <option key={t.id} value={t.id} style={{ background: '#111', color: '#eee' }}>
            {t.brand.name}
          </option>
        ))}
      </select>
      <span
        aria-hidden
        className="absolute right-1.5 text-[0.55rem] pointer-events-none"
        style={{ color: 'var(--color-warm-accent)' }}
      >
        ▾
      </span>
    </label>
  );
}
