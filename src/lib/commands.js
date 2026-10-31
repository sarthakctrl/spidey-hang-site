/*
 * The app's one-line command language (handleCommand in the app's src/main.js), parsed the same way.
 * Returns an action object for the terminal to carry out, or { type: 'ignored' } for anything the
 * app would ignore. Adds 'help' and 'clear', which only make sense in the web terminal.
 */
const TEXT_KINDS = ['water', 'lunch'];

export function parseCommand(raw) {
  const line = String(raw).trim();
  const parts = line.split(/\s+/).filter(Boolean);
  if (parts.length === 0) {
    return { type: 'empty' };
  }
  const rest = (word) => line.slice(word.length).trim();
  switch (parts[0]) {
    case 'swing':
      if (parts.length === 2) {
        return { type: 'swing', mode: parts[1] === 'on' ? 'on' : parts[1] === 'off' ? 'off' : 'toggle' };
      }
      return { type: 'ignored', line };
    case 'snapshot': {
      const file = rest('snapshot');
      if (!file.toLowerCase().endsWith('.png')) {
        return { type: 'refused', line, reason: `Snapshot refused, not a .png path: ${file}` };
      }
      return { type: 'snapshot', file };
    }
    case 'stats':
      return { type: 'stats' };
    case 'hero':
      if (parts.length === 2 && parts[1] === 'next') {
        return { type: 'hero', next: true };
      }
      if (parts.length >= 2) {
        return { type: 'hero', name: rest('hero') };
      }
      return { type: 'ignored', line };
    case 'rotate':
      if (parts.length === 2 && /^\d+$/.test(parts[1])) {
        return { type: 'rotate', minutes: Number(parts[1]) };
      }
      return { type: 'ignored', line };
    case 'push': {
      const value = parts.length > 1 ? Number(parts[1]) : 1;
      return { type: 'push', strength: Number.isFinite(value) ? Math.max(0, Math.min(3, value)) : 1 };
    }
    case 'reset':
      return { type: 'reset' };
    case 'remind': {
      const what = rest('remind');
      if (TEXT_KINDS.includes(what)) {
        return { type: 'remind', kind: what };
      }
      if (what) {
        return { type: 'remind', kind: 'note', text: what };
      }
      return { type: 'ignored', line };
    }
    case 'exit':
      return { type: 'exit' };
    case 'help':
      return { type: 'help' };
    case 'clear':
      return { type: 'clear' };
    default:
      return { type: 'ignored', line }; // "ping" and anything unknown
  }
}

export const HELP = [
  'push [strength]      swing him (0 to 3, default 1)',
  'reset                hang him straight',
  'swing on|off|toggle  keep swinging on his own, or not',
  'hero next | hero <name>',
  'rotate <minutes>     change hero every so often (0 = never)',
  'remind water|lunch   show that reminder now',
  'remind <text>        show any text in his speech bubble',
  'snapshot <x.png>     save what he looks like right now',
  'stats                frame timing',
  'exit                 take him down',
  'clear                clear this terminal (web only)',
];
