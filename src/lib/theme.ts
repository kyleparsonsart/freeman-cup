/**
 * Dark is the default: it holds up in direct sun on the course. Light is a
 * per-device preference, stored locally, shared by the app and the design
 * system page. The stylesheet does the work (body.light swaps the tokens).
 */
export type Theme = 'dark' | 'light';

const KEY = 'fc-theme';
const META: Record<Theme, string> = { dark: '#0A1410', light: '#E7E0CD' };

export function getTheme(): Theme {
  try {
    return localStorage.getItem(KEY) === 'light' ? 'light' : 'dark';
  } catch {
    return 'dark';
  }
}

export function applyTheme(t: Theme): void {
  document.body.classList.toggle('light', t === 'light');
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute('content', META[t]);
}

export function setTheme(t: Theme): void {
  applyTheme(t);
  try { localStorage.setItem(KEY, t); } catch { /* private mode etc. */ }
}
