/*
 * The app's one-line command language (handleCommand in the app's src/main.js), parsed the same way.
 * Returns an action object for the terminal to carry out, or { type: 'ignored' } for anything the
 * app would ignore. Adds 'help' and 'clear', which only make sense in the web terminal.
 */
const TEXT_KINDS = ['water', 'lunch'];
const WEB_PLACES = ['left', 'center', 'right', 'random', 'pointer'];
const ANTIC_KINDS = ['wiggle', 'bungee', 'swing', 'say', 'web'];

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
      if (/^(in|at)\s+\d/i.test(what)) {
        return { type: 'once', words: what }; // a one-off reminder, for later
      }
      if (what) {
        return { type: 'remind', kind: 'note', text: what };
      }
      return { type: 'ignored', line };
    }
    case 'dismiss':
      return { type: 'dismiss' };
    case 'down':
      return { type: 'down' };
    case 'up':
      return { type: 'up' };
    case 'travel':
      return { type: 'web', where: 'across' };
    case 'web': {
      if (parts.length !== 2) {
        return { type: 'ignored', line };
      }
      if (WEB_PLACES.includes(parts[1])) {
        return { type: 'web', where: parts[1] };
      }
      const share = Number(parts[1]);
      return Number.isFinite(share) && share >= 0 && share <= 1 ? { type: 'web', where: share } : { type: 'ignored', line };
    }
    case 'focus': {
      const sub = parts[1] || 'status';
      if (sub === 'start') {
        const minutes = Number(parts[2]);
        return { type: 'focus', action: 'start', minutes: Number.isFinite(minutes) && minutes > 0 ? minutes : undefined };
      }
      return ['stop', 'skip', 'status'].includes(sub) ? { type: 'focus', action: sub } : { type: 'ignored', line };
    }
    case 'hide': {
      const minutes = Number(parts[1] || 0);
      return { type: 'hide', minutes: Number.isFinite(minutes) && minutes > 0 ? Math.min(24 * 60, minutes) : 0 };
    }
    case 'show':
      return { type: 'show' };
    case 'antic':
      return { type: 'antic', kind: ANTIC_KINDS.includes(parts[1]) ? parts[1] : null };
    case 'sleep':
      return { type: 'sleep' };
    case 'wake':
      return { type: 'wake' };
    case 'greet':
      return { type: 'greet' };
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
  'remind in <min> <text> | remind at <time> <text>   a one-off reminder',
  'dismiss              close the reminder showing',
  'web left|center|right|random|pointer|<0..1>   web-swing there',
  'travel               web-swing across to the other side',
  'focus start [min]|stop|skip|status   the focus timer',
  'hide [minutes] | show   hide him (0 or nothing: until "show")',
  'antic [wiggle|bungee|swing|say|web]   one of his little things',
  'sleep | wake | greet doze off, wake up, say hello',
  'down | up            take him down, hang him back up',
  'snapshot <x.png>     save what he looks like right now',
  'stats                frame timing',
  'exit                 take him down',
  'clear                clear this terminal (web only)',
];
