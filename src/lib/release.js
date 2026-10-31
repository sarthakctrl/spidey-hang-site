/*
 * Finding the installers in a GitHub release. GitHub replaces spaces in uploaded file names with dots,
 * so "Spidey Hang Setup 1.0.0.exe" arrives as "Spidey.Hang.Setup.1.0.0.exe". Match by pattern.
 */
export const KINDS = {
  win: { label: 'Windows', detail: 'Windows, 64-bit', test: (n) => /\.exe$/i.test(n) },
  'mac-arm': { label: 'macOS · Apple silicon', detail: 'M1 and newer', test: (n) => /arm64\.dmg$/i.test(n) },
  'mac-x64': { label: 'macOS · Intel', detail: 'Intel Macs', test: (n) => /x64\.dmg$/i.test(n) },
  linux: { label: 'Linux', detail: 'Ubuntu 22.04+, Debian · 64-bit .deb', test: (n) => /\.deb$/i.test(n) },
};

/** Trims GitHub's API answer to what the page needs. Null when there is no usable release. */
export function summarize(api) {
  if (!api || typeof api !== 'object' || !api.tag_name) {
    return null;
  }
  return {
    tag: api.tag_name,
    name: api.name || api.tag_name,
    publishedAt: api.published_at || null,
    url: api.html_url || null,
    assets: (api.assets || []).map((a) => ({ name: a.name, size: a.size, url: a.browser_download_url })),
  };
}

/** { win, 'mac-arm', 'mac-x64' } -> the asset for each, or null when that file is not in the release. */
export function pickAssets(release) {
  const out = {};
  for (const [key, kind] of Object.entries(KINDS)) {
    out[key] = release?.assets?.find((a) => kind.test(a.name)) || null;
  }
  return out;
}

export function formatSize(bytes) {
  if (!Number.isFinite(bytes) || bytes <= 0) {
    return '';
  }
  return `${Math.round(bytes / 1024 / 1024)} MB`;
}

export function formatDate(iso) {
  if (!iso) {
    return '';
  }
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '' : d.toLocaleDateString('en', { year: 'numeric', month: 'short', day: 'numeric' });
}

/** The newest release: from GitHub now if it answers, else the copy saved at build time. */
export async function latestRelease(repo, saved, fetchImpl = globalThis.fetch) {
  try {
    const res = await fetchImpl(`https://api.github.com/repos/${repo}/releases/latest`, {
      headers: { Accept: 'application/vnd.github+json' },
    });
    if (res.status === 404) {
      return { release: null, source: 'live' };
    }
    if (!res.ok) {
      throw new Error(`GitHub answered ${res.status}`);
    }
    return { release: summarize(await res.json()), source: 'live' };
  } catch (err) {
    return { release: saved?.release || null, source: 'saved', error: err.message };
  }
}
