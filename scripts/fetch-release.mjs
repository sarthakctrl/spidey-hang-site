/*
 * Saves the app's latest GitHub release into src/data/release.json before each build, so the
 * download buttons work straight away (and if GitHub is unreachable from the visitor's browser).
 *
 *   { repo, fetchedAt, release: { tag, name, publishedAt, url, assets: [{ name, size, url }] } | null }
 *
 * GITHUB_TOKEN is used when set (GitHub Actions provides one) to avoid the anonymous rate limit;
 * it is only sent to api.github.com and never written anywhere.
 * If GitHub cannot be reached, the existing file is kept and the build goes on.
 */
import fs from 'node:fs';
import path from 'node:path';
import config from '../site.config.js';
import { summarize } from '../src/lib/release.js';

const file = path.resolve(import.meta.dirname, '..', 'src', 'data', 'release.json');
const repo = config.appRepo;

const headers = { Accept: 'application/vnd.github+json', 'User-Agent': 'spidey-hang-site' };
if (process.env.GITHUB_TOKEN) {
  headers.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`;
}

function write(release) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify({ repo, fetchedAt: new Date().toISOString(), release }, null, 2) + '\n');
}

try {
  const res = await fetch(`https://api.github.com/repos/${repo}/releases/latest`, { headers, signal: AbortSignal.timeout(10000) });
  if (res.status === 404) {
    write(null);
    console.log(`release-info: ${repo} has no published release yet (or is private). The site will say builds are on their way.`);
  } else if (!res.ok) {
    throw new Error(`GitHub answered ${res.status}`);
  } else {
    const release = summarize(await res.json());
    write(release);
    console.log(`release-info: ${repo} ${release.tag}, ${release.assets.length} file(s).`);
  }
} catch (err) {
  if (!fs.existsSync(file)) {
    write(null);
  }
  console.warn(`release-info: could not reach GitHub (${err.message}); keeping the saved release info.`);
}
