/** Persistência e aplicação do tema claro/escuro (data-theme no <html>). */

export const THEME_STORAGE_KEY = 'arjen-theme';

export const THEME_COLOR_LIGHT = '#1a7f37';
export const THEME_COLOR_DARK = '#0f2918';

export function getInitialTheme() {
  try {
    const stored = localStorage.getItem(THEME_STORAGE_KEY);
    if (stored === 'dark' || stored === 'light') return stored;
  } catch {
    /* ignore */
  }
  if (typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: dark)').matches) {
    return 'dark';
  }
  return 'light';
}

export function applyTheme(theme) {
  if (theme !== 'dark' && theme !== 'light') return;
  document.documentElement.dataset.theme = theme;
  try {
    localStorage.setItem(THEME_STORAGE_KEY, theme);
  } catch {
    /* ignore */
  }
}

export function readAppliedTheme() {
  const t = document.documentElement.dataset.theme;
  return t === 'dark' ? 'dark' : 'light';
}

/** Alterna light ↔ dark; retorna o tema aplicado. */
export function toggleStoredTheme() {
  const next = readAppliedTheme() === 'dark' ? 'light' : 'dark';
  applyTheme(next);
  return next;
}

export function syncThemeColorMeta() {
  const meta = document.querySelector('meta[name="theme-color"]');
  if (!meta) return;
  meta.setAttribute(
    'content',
    readAppliedTheme() === 'dark' ? THEME_COLOR_DARK : THEME_COLOR_LIGHT
  );
}
