/*
 * The visitor's menu choices, kept in localStorage under the same keys and defaults as the app's
 * ~/.spidey-hang/settings.json (src/lib/settings.js). Differences on the web:
 *   - Hero defaults to Iron Spider and Size to Large, and only the heroes the site carries can be picked.
 *   - StartAutomatically is shown but cannot change: there is no sign-in to start at.
 */
export const DRAWN = 'Drawn Spider-Man';
/** Every hero, in the app's "Next hero" order: the picture heroes (web-heroes.js) alphabetically, then the drawing. */
export const SITE_HEROES = [
  'Animated Spidey - Web Swing',
  'Comic Spidey - Web Swing',
  'Iconic Spidey - Both',
  'Iconic Spidey - Upside Down',
  'Iconic Spidey - Web Swing',
  'Iron Spider - Web Swing',
  DRAWN,
];

export const DEFAULTS = Object.freeze({
  AnchorFraction: 0.88,
  Size: 'Large',
  Rope: 'Medium',
  Breeze: false,
  AutoSwing: false,
  Hero: 'Iron Spider - Web Swing',
  RotateMinutes: 0,
  StartAutomatically: true,
  WaterReminder: true,
  LunchReminder: true,
});

export const BODY_LENGTH = { Small: 110, Medium: 150, Large: 200 };
export const ROPE_FRACTION = { Short: 0.15, Medium: 0.27, Long: 0.42 };

// v4: the defaults changed (Iron Spider, Large), so earlier saves start fresh.
const KEY = 'spidey-hang.settings.v4';

/** Keeps only known keys whose type matches the default, like Settings.load() in the app. */
export function clean(raw) {
  const values = { ...DEFAULTS };
  if (raw && typeof raw === 'object') {
    for (const key of Object.keys(DEFAULTS)) {
      if (raw[key] !== undefined && typeof raw[key] === typeof DEFAULTS[key]) {
        values[key] = raw[key];
      }
    }
  }
  if (!(values.Size in BODY_LENGTH)) {
    values.Size = DEFAULTS.Size;
  }
  if (!(values.Rope in ROPE_FRACTION)) {
    values.Rope = DEFAULTS.Rope;
  }
  if (!SITE_HEROES.includes(values.Hero)) {
    values.Hero = DEFAULTS.Hero;
  }
  values.StartAutomatically = true;
  return values;
}

export class SettingsStore {
  constructor(storage = safeStorage()) {
    this.storage = storage;
    this.listeners = new Set();
    let raw = null;
    try {
      raw = JSON.parse(this.storage?.getItem(KEY) || 'null');
    } catch {
      // A broken entry just means defaults, as in the app.
    }
    this.values = clean(raw);
  }

  get(key) {
    return this.values[key];
  }

  get bodyLength() {
    return BODY_LENGTH[this.values.Size];
  }

  get ropeFraction() {
    return ROPE_FRACTION[this.values.Rope];
  }

  set(changes) {
    this.values = clean({ ...this.values, ...changes });
    try {
      this.storage?.setItem(KEY, JSON.stringify(this.values));
    } catch {
      // Private windows can refuse storage; the choice still applies until the page closes.
    }
    for (const listener of this.listeners) {
      listener(this.values, changes);
    }
  }

  /** listener(values, changes) runs after every change. Returns a function that unsubscribes. */
  subscribe(listener) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }
}

function safeStorage() {
  try {
    return globalThis.localStorage || null;
  } catch {
    return null;
  }
}
