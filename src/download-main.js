/* The download page: the cards, install steps, and the theme switch. */
import './fonts.js';
import './styles/site.css';
import { initTheme } from './theme.js';
import { initDownloads } from './sections/download.js';

initDownloads(document);
initTheme(document.querySelector('.theme-toggle'));

if (['#install-windows', '#install-mac', '#install-linux'].includes(location.hash)) {
  document.querySelector(location.hash)?.classList.add('is-highlighted');
}
