import test from 'node:test';
import assert from 'node:assert/strict';
import { parseCommand } from '../src/lib/commands.js';
import { detectFromStrings } from '../src/lib/platform.js';
import { summarize, pickAssets, formatSize, latestRelease } from '../src/lib/release.js';
import { SettingsStore, clean, DEFAULTS, DRAWN, SITE_HEROES } from '../src/overlay/settings-store.js';


test('commands parse the way the app parses them', () => {
  assert.deepEqual(parseCommand('push'), { type: 'push', strength: 1 });
  assert.deepEqual(parseCommand('push 9'), { type: 'push', strength: 3 });
  assert.deepEqual(parseCommand('push nope'), { type: 'push', strength: 1 });
  assert.deepEqual(parseCommand('  swing on '), { type: 'swing', mode: 'on' });
  assert.deepEqual(parseCommand('swing maybe'), { type: 'swing', mode: 'toggle' });
  assert.equal(parseCommand('swing').type, 'ignored');
  assert.deepEqual(parseCommand('remind lunch'), { type: 'remind', kind: 'lunch' });
  assert.deepEqual(parseCommand('remind Hang in there!'), { type: 'remind', kind: 'note', text: 'Hang in there!' });
  assert.deepEqual(parseCommand('hero next'), { type: 'hero', next: true });
  assert.deepEqual(parseCommand('hero Drawn Spider-Man'), { type: 'hero', name: 'Drawn Spider-Man' });
  assert.deepEqual(parseCommand('rotate 5'), { type: 'rotate', minutes: 5 });
  assert.equal(parseCommand('rotate soon').type, 'ignored');
  assert.equal(parseCommand('snapshot me.jpg').type, 'refused');
  assert.deepEqual(parseCommand('snapshot me.png'), { type: 'snapshot', file: 'me.png' });
  assert.equal(parseCommand('ping').type, 'ignored');
  assert.equal(parseCommand('').type, 'empty');
});

test('the app\'s newer commands parse too', () => {
  assert.deepEqual(parseCommand('web left'), { type: 'web', where: 'left' });
  assert.deepEqual(parseCommand('web 0.4'), { type: 'web', where: 0.4 });
  assert.equal(parseCommand('web 7').type, 'ignored');
  assert.equal(parseCommand('web').type, 'ignored');
  assert.deepEqual(parseCommand('travel'), { type: 'web', where: 'across' });
  assert.deepEqual(parseCommand('remind in 10 Tea is ready'), { type: 'once', words: 'in 10 Tea is ready' });
  assert.deepEqual(parseCommand('remind at 15:30 Call back'), { type: 'once', words: 'at 15:30 Call back' });
  assert.deepEqual(parseCommand('remind inside joke'), { type: 'remind', kind: 'note', text: 'inside joke' });
  assert.deepEqual(parseCommand('focus start 50'), { type: 'focus', action: 'start', minutes: 50 });
  assert.deepEqual(parseCommand('focus start'), { type: 'focus', action: 'start', minutes: undefined });
  assert.deepEqual(parseCommand('focus'), { type: 'focus', action: 'status' });
  assert.equal(parseCommand('focus later').type, 'ignored');
  assert.deepEqual(parseCommand('hide 15'), { type: 'hide', minutes: 15 });
  assert.deepEqual(parseCommand('hide'), { type: 'hide', minutes: 0 });
  assert.deepEqual(parseCommand('antic bungee'), { type: 'antic', kind: 'bungee' });
  assert.deepEqual(parseCommand('antic dance'), { type: 'antic', kind: null });
  for (const word of ['show', 'sleep', 'wake', 'greet', 'dismiss', 'down', 'up']) {
    assert.deepEqual(parseCommand(word), { type: word });
  }
});

test('platform detection picks the right installer', () => {
  const mac = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36';
  assert.deepEqual(detectFromStrings({ userAgent: mac, architecture: 'arm' }), { os: 'mac', pick: 'mac-arm' });
  assert.deepEqual(detectFromStrings({ userAgent: mac, architecture: 'x86' }), { os: 'mac', pick: 'mac-x64' });
  assert.deepEqual(detectFromStrings({ userAgent: mac }), { os: 'mac', pick: null }); // Safari cannot tell
  assert.deepEqual(detectFromStrings({ userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' }), { os: 'windows', pick: 'win' });
  assert.deepEqual(detectFromStrings({ userAgent: 'Mozilla/5.0 (X11; Linux x86_64)' }), { os: 'linux', pick: 'linux' });
  assert.equal(detectFromStrings({ userAgent: 'Mozilla/5.0 (Linux; Android 14; Pixel 8) Mobile' }).os, 'phone');
  assert.equal(detectFromStrings({ userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X)' }).os, 'phone');
});

test('release files are matched by pattern, with GitHub dotted names', () => {
  const release = summarize({
    tag_name: 'v1.0.0',
    html_url: 'https://github.com/x/y/releases/tag/v1.0.0',
    assets: [
      { name: 'Spidey.Hang.Setup.1.0.0.exe', size: 104857600, browser_download_url: 'u1' },
      { name: 'Spidey.Hang-1.0.0-arm64.dmg', size: 1, browser_download_url: 'u2' },
      { name: 'Spidey.Hang-1.0.0-x64.dmg', size: 1, browser_download_url: 'u3' },
      { name: 'spidey-hang_1.0.0_amd64.deb', size: 1, browser_download_url: 'u4' },
    ],
  });
  const picked = pickAssets(release);
  assert.equal(picked.win.url, 'u1');
  assert.equal(picked['mac-arm'].url, 'u2');
  assert.equal(picked['mac-x64'].url, 'u3');
  assert.equal(picked.linux.url, 'u4');
  assert.equal(formatSize(104857600), '100 MB');
  assert.equal(summarize({ message: 'Not Found' }), null);
  assert.deepEqual(pickAssets(null), { win: null, 'mac-arm': null, 'mac-x64': null, linux: null });
});

test('a failed GitHub check falls back to the release saved at build time', async () => {
  const saved = { release: { tag: 'v0.9.0', assets: [] } };
  const down = await latestRelease('x/y', saved, async () => { throw new Error('offline'); });
  assert.equal(down.source, 'saved');
  assert.equal(down.release.tag, 'v0.9.0');
  const none = await latestRelease('x/y', saved, async () => ({ status: 404, ok: false }));
  assert.equal(none.release, null);
});

test('settings keep the app keys and defaults and refuse bad values', () => {
  assert.equal(clean(null).AnchorFraction, 0.88);
  const odd = clean({ Size: 'Huge', Rope: 3, Breeze: 'yes', Hero: 'Somebody', StartAutomatically: false, Extra: 1 });
  assert.equal(odd.Size, DEFAULTS.Size);
  assert.equal(odd.Rope, DEFAULTS.Rope);
  assert.equal(odd.Breeze, false);
  assert.equal(odd.Hero, DEFAULTS.Hero);
  assert.equal(odd.StartAutomatically, true);
  assert.equal('Extra' in odd, false);
  assert.ok(SITE_HEROES.includes(DRAWN) && SITE_HEROES.includes(DEFAULTS.Hero));
  assert.equal(DEFAULTS.Hero, 'Iron Spider - Web Swing');
  assert.equal(DEFAULTS.Size, 'Large');
  assert.equal(SITE_HEROES.length, 7);
  assert.equal(SITE_HEROES.at(-1), DRAWN, 'the drawing comes last, as in the app');
  assert.equal(clean({ Hero: 'Comic Spidey - Web Swing' }).Hero, 'Comic Spidey - Web Swing');
  // The app's newer settings: water interval, lunch time, focus lengths, personality.
  assert.equal(DEFAULTS.WaterMinutes, 30);
  assert.equal(DEFAULTS.LunchTime, '15:00');
  assert.equal(DEFAULTS.Reactions, true);
  assert.equal(DEFAULTS.Antics, true);
  assert.equal(DEFAULTS.Sounds, false);
  assert.equal(clean({ WaterMinutes: 45 }).WaterMinutes, 45);
  assert.equal(clean({ WaterMinutes: 7 }).WaterMinutes, 30);
  assert.equal(clean({ LunchTime: '12:30' }).LunchTime, '12:30');
  assert.equal(clean({ LunchTime: '25:00' }).LunchTime, '15:00');
  assert.equal(clean({ FocusMinutes: 50 }).FocusMinutes, 50);
  assert.equal(clean({ FocusMinutes: 1000 }).FocusMinutes, 25);
  assert.equal(clean({ IdleMinutes: 3 }).IdleMinutes, 5);

  const memory = new Map();
  const storage = { getItem: (k) => memory.get(k) ?? null, setItem: (k, v) => memory.set(k, v) };
  const store = new SettingsStore(storage);
  let heard = null;
  store.subscribe((values, changes) => (heard = changes));
  store.set({ Size: 'Large', Hero: DRAWN });
  assert.deepEqual(heard, { Size: 'Large', Hero: DRAWN });
  assert.equal(new SettingsStore(storage).get('Size'), 'Large');
  assert.equal(new SettingsStore(storage).bodyLength, 200);
});
