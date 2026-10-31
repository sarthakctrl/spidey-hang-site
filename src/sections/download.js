/*
 * Download cards for the three installers, on the home page and the download page.
 * Shows the release saved at build time straight away, then checks GitHub for a newer one.
 */
import config from '../../site.config.js';
import saved from '../data/release.json';
import { KINDS, latestRelease, pickAssets, formatSize, formatDate } from '../lib/release.js';
import { detectPlatform } from '../lib/platform.js';

const repoUrl = `https://github.com/${config.appRepo}`;
/** Which install steps go with each installer (download/index.html data-install). */
const INSTALL = { win: 'windows', 'mac-arm': 'mac', 'mac-x64': 'mac', linux: 'linux' };
const releasesUrl = `${repoUrl}/releases`;

export async function initDownloads(root) {
  for (const a of root.querySelectorAll('[data-repo-link]')) {
    const which = a.dataset.repoLink;
    a.href = which === 'site' ? `https://github.com/${config.siteRepo}` : which === 'releases' ? releasesUrl : repoUrl;
  }
  const box = root.querySelector('[data-downloads]');
  let platform = { os: 'other', pick: null };
  render(root, box, saved.release, platform, { source: 'saved', loading: true });

  const [found, live] = await Promise.all([detectPlatform(), latestRelease(config.appRepo, saved)]);
  platform = found;
  render(root, box, live.release, platform, live);
}

function render(root, box, release, platform, { source, loading = false, error = null }) {
  const assets = pickAssets(release);
  updatePrimary(root, release, assets, platform);
  if (!box) {
    return;
  }
  box.replaceChildren();

  if (!release && loading) {
    box.append(status('Looking up the latest version…'));
    return;
  }

  if (platform.os === 'phone') {
    box.append(status('Spidey Hang is a desktop app for Windows, macOS and Linux. Send yourself this link and open it on your computer.'));
  }

  for (const [key, kind] of Object.entries(KINDS)) {
    const asset = assets[key];
    const yours = platform.pick === key;
    const card = el('article', `dl-card${yours ? ' is-yours' : ''}`);
    if (yours) {
      card.append(el('span', 'yours-tag', 'Your computer'));
    }
    card.append(el('h3', '', kind.label), el('p', 'meta', [kind.detail, formatSize(asset?.size)].filter(Boolean).join(' · ')));
    if (asset) {
      const btn = link(`Download ${asset.name.slice(asset.name.lastIndexOf('.'))}`, asset.url, `btn ${yours ? 'btn-red' : 'btn-gold'}`);
      btn.addEventListener('click', () => highlightInstall(root, INSTALL[key]));
      card.append(btn);
    } else {
      // Empty (nothing released yet) or partial (this release has no file for this system).
      card.append(el('p', 'missing', release ? 'Not in this release yet' : 'Not released yet'),
        link('Releases on GitHub', releasesUrl, 'btn btn-paper'));
    }
    box.append(card);
  }

  if (!release) {
    const empty = status(error
      ? 'GitHub could not be reached just now, and this site has no saved release to fall back on. '
      : 'The first release is on its way. Until then, ');
    empty.append(link('build him yourself', root.querySelector('#build') ? '#build' : 'download/#build'), ' in two commands.');
    box.append(empty);
    return;
  }

  if (platform.os === 'mac' && !platform.pick) {
    box.append(status('Which Mac? Apple menu › About This Mac: if "Chip" says Apple M-something, take Apple silicon. If it says "Processor … Intel", take Intel.'));
  }
  const line = [`${release.name}`, formatDate(release.publishedAt)].filter(Boolean).join(' · ');
  const msg = source === 'saved' && error
    ? `${line}. GitHub could not be reached just now, so these are the links saved when this site was built.`
    : `${line}.`;
  const foot = status(msg);
  foot.append(' ', link('All releases', release.url || releasesUrl));
  box.append(foot);
}

/** The hero's big button: straight to your installer when we know it, otherwise to the cards.
 *  The macOS / Windows / Linux buttons: straight to that installer, or to its install steps until there is one. */
function updatePrimary(root, release, assets, platform) {
  for (const a of root.querySelectorAll('[data-os-button]')) {
    const os = a.dataset.osButton;
    // A Mac only goes straight to a disk image when we know which chip it has.
    const asset = os === 'mac' ? (platform.pick?.startsWith('mac') ? assets[platform.pick] : null) : assets[os];
    const install = `${root.querySelector('[data-install]') ? '' : 'download/'}#install-${INSTALL[os === 'mac' ? 'mac-arm' : os]}`;
    a.href = asset ? asset.url : install;
    a.classList.toggle('btn-gold', platform.pick === os || (os === 'mac' && platform.os === 'mac'));
    a.classList.toggle('btn-paper', !a.classList.contains('btn-gold'));
  }
  for (const a of root.querySelectorAll('[data-download-primary]')) {
    const label = a.querySelector('[data-os-label]');
    const asset = platform.pick ? assets[platform.pick] : null;
    if (asset) {
      a.href = asset.url;
      label.textContent = { windows: 'Download for Windows', mac: 'Download for your Mac', linux: 'Download for Linux' }[platform.os];
    } else {
      a.href = root.querySelector('#download, #get') ? '#download' : 'download/';
      label.textContent = platform.os === 'mac' ? 'Download for Mac' : 'Download Spidey Hang';
    }
  }
  for (const v of root.querySelectorAll('[data-version]')) {
    v.textContent = release ? `version ${release.tag.replace(/^v/, '')}` : 'not released yet';
  }
}

function highlightInstall(root, os) {
  const section = root.querySelector(`[data-install="${os}"]`);
  if (!section) {
    return;
  }
  root.querySelectorAll('[data-install]').forEach((s) => s.classList.toggle('is-highlighted', s === section));
  section.scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'start' });
}

function status(text) {
  return el('p', 'note dl-status', text);
}

function el(tag, cls, text) {
  const node = document.createElement(tag);
  if (cls) {
    node.className = cls;
  }
  if (text) {
    node.textContent = text;
  }
  return node;
}

function link(text, href, cls = 'text-link') {
  const a = el('a', cls, text);
  a.href = href;
  return a;
}
