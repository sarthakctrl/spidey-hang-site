/*
 * Copies Spidey Hang's own browser code into vendor/spidey, so the site's demos run the app's real
 * physics, drawing and reminder bubble. Run it again whenever the app changes:
 *
 *   npm run sync                      reads ../Hang-in-there
 *   npm run sync -- /path/to/app      reads another copy
 *
 * The app's files are UMD scripts. Each copy gets two lines on top that make it an ES module and keep
 * it on its browser path (no `module`, no `require`), so bundlers never mistake it for CommonJS.
 * reminders.js is CommonJS only; its export line becomes an ES export.
 */
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
const app = path.resolve(process.argv[2] || path.join(root, '..', 'Hang-in-there'));
const out = path.join(root, 'vendor', 'spidey');

const UMD = [
  'renderer/shared/vec.js',
  'renderer/shared/rig.js',
  'renderer/shared/images.js',
  'renderer/shared/stage.js',
  'renderer/shared/figure.js',
  'renderer/bubble.js',
];

if (!fs.existsSync(path.join(app, 'src', 'renderer', 'shared', 'rig.js'))) {
  console.error(`No Spidey Hang app at ${app}. Pass its folder: npm run sync -- /path/to/Hang-in-there`);
  process.exit(1);
}

const pkg = JSON.parse(fs.readFileSync(path.join(app, 'package.json'), 'utf8'));
const header = (file) =>
  `// Copied from Spidey Hang ${pkg.version}, src/${file}, by scripts/sync-app-code.mjs. Do not edit here.\n` +
  '// MIT licensed, see LICENSE in this folder.\n';

fs.mkdirSync(out, { recursive: true });

for (const file of UMD) {
  const source = fs.readFileSync(path.join(app, 'src', file), 'utf8');
  const wrapped = header(file) +
    'const module = undefined;\n' +
    'const require = undefined;\n' +
    source + '\nexport {};\n';
  fs.writeFileSync(path.join(out, path.basename(file)), wrapped);
}

const reminders = fs.readFileSync(path.join(app, 'src', 'lib', 'reminders.js'), 'utf8');
if (!/^module\.exports = \{[^}]+\};$/m.test(reminders)) {
  console.error('reminders.js no longer ends with a plain module.exports = { ... } line; update this script.');
  process.exit(1);
}
fs.writeFileSync(path.join(out, 'reminders.js'),
  header('lib/reminders.js') + reminders.replace(/^'use strict';\n/m, '').replace(/^module\.exports = (\{[^}]+\});$/m, 'export $1'));

// The speech bubble's styles: the part of overlay.css after the page's own rules.
const css = fs.readFileSync(path.join(app, 'src', 'renderer', 'overlay.css'), 'utf8');
const from = css.indexOf('/* Reminder speech bubble');
if (from < 0) {
  console.error('overlay.css no longer has the "Reminder speech bubble" block; update this script.');
  process.exit(1);
}
fs.writeFileSync(path.join(out, 'bubble.css'), `/* Copied from Spidey Hang ${pkg.version}, src/renderer/overlay.css. */\n` + css.slice(from));

fs.copyFileSync(path.join(app, 'LICENSE'), path.join(out, 'LICENSE'));
fs.writeFileSync(path.join(out, 'version.json'), JSON.stringify({ app: pkg.productName, version: pkg.version }, null, 2) + '\n');

console.log(`Synced Spidey Hang ${pkg.version} from ${app} into vendor/spidey.`);
