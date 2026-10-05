const KEY = 'theme';

/** Stored choice wins; otherwise follow the OS colour-scheme preference. */
export function getInitialTheme() {
  try {
    const stored = localStorage.getItem(KEY);
    if (stored === 'light' || stored === 'dark') return stored;
  } catch {
    // storage unavailable (private mode) — fall through to OS preference
  }
  if (typeof window !== 'undefined' && window.matchMedia?.('(prefers-color-scheme: dark)').matches) {
    return 'dark';
  }
  return 'light';
}

export function applyTheme(theme, persist = true) {
  document.documentElement.classList.toggle('dark', theme === 'dark');
  if (!persist) return;
  try {
    localStorage.setItem(KEY, theme);
  } catch {
    // ignore
  }
}
