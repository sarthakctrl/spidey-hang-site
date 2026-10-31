/*
 * Light and dark. Follows the system until the visitor picks one with the top bar's button; the pick
 * is remembered in this browser. The inline script in each page's <head> applies a remembered pick
 * before the first paint, so the page never flashes the other theme.
 */
const KEY = 'spidey-hang.theme';
const root = document.documentElement;
const system = matchMedia('(prefers-color-scheme: dark)');

const current = () => root.dataset.theme || (system.matches ? 'dark' : 'light');

function show(button) {
  const theme = current();
  const next = theme === 'dark' ? 'light' : 'dark';
  button.setAttribute('aria-label', `Switch to the ${next} theme`);
  button.title = `Switch to the ${next} theme`;
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', theme === 'dark' ? '#11131b' : '#c8202a');
}

export function initTheme(button) {
  if (!button) {
    return;
  }
  show(button);
  system.addEventListener('change', () => show(button));
  button.addEventListener('click', () => {
    const next = current() === 'dark' ? 'light' : 'dark';
    root.dataset.theme = next;
    try {
      localStorage.setItem(KEY, next);
    } catch {
      // Storage refused: the theme lasts until the page closes.
    }
    show(button);
  });
}
