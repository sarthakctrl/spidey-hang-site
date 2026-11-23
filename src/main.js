/*
 * The home page: a hanging Spidey over the whole page, his menu, and the sections that drive him.
 */
import './fonts.js';
import './styles/site.css';
import { reminders } from '../vendor/spidey/index.js';
import { SettingsStore, SITE_HEROES } from './overlay/settings-store.js';
import { HangingSpidey } from './overlay/hanging-spidey.js';
import { Brain } from './overlay/brain.js';
import { SpideyMenu } from './overlay/menu.js';
import { initTheme } from './theme.js';
import { initPlayground } from './sections/playground.js';
import { initReminders } from './sections/reminders.js';
import { initPersonality } from './sections/personality.js';
import { initTerminal } from './sections/terminal.js';
import { initDownloads } from './sections/download.js';
import { initHeroes } from './sections/heroes.js';

const settings = new SettingsStore();
const refreshers = [];
const refresh = () => refreshers.forEach((fn) => fn());

let menu = null;
const spidey = new HangingSpidey({
  settings,
  onMenu: (x, y) => menu.open(x, y),
  onChange: refresh,
});
const brain = new Brain({ spidey, settings, onChange: refresh });

/** Anything that acts on him hangs him back up (or shows him) first if he was taken down or hidden. */
const ensureUp = () => {
  if (!spidey.up) {
    spidey.hangUp();
  } else if (spidey.hidden) {
    spidey.showAgain();
  }
};

const actions = {
  swing: (strength = 1) => {
    ensureUp();
    spidey.push(strength);
  },
  reset: () => {
    ensureUp();
    spidey.reset();
  },
  relayout: (changes) => {
    settings.set(changes);
    ensureUp();
    spidey.reset();
    refresh();
  },
  setFlags: (changes) => {
    ensureUp();
    spidey.setFlags(changes);
  },
  setHero: (name) => {
    ensureUp();
    spidey.setHero(name);
  },
  /** The next hero, wrapping round, as the app's nextHero(). */
  nextHero: () => {
    const at = SITE_HEROES.indexOf(settings.get('Hero'));
    actions.setHero(SITE_HEROES[(at + 1) % SITE_HEROES.length]);
  },
  setRotate: (minutes) => {
    settings.set({ RotateMinutes: Math.max(0, minutes) });
    startRotateTimer();
  },
  toggleReminder: (key) => {
    settings.set({ [key]: !settings.get(key) });
    spidey.restartReminders();
    refresh();
  },
  /** Water every / Lunch time: { WaterMinutes } or { LunchTime }. */
  setReminderTime: (changes) => {
    settings.set(changes);
    spidey.restartReminders();
    refresh();
  },
  webSwing: (where) => {
    ensureUp();
    spidey.webSwing(where);
  },
  hide: (minutes) => spidey.hide(minutes),
  show: () => ensureUp(),
  startFocus: (minutes) => {
    ensureUp();
    brain.startFocus(minutes);
  },
  stopFocus: () => brain.stopFocus(),
  skipFocus: () => brain.skipFocus(),
  setFocusLength: (key, minutes) => {
    settings.set({ [key]: minutes });
    refresh();
  },
  setReactions: (on) => brain.setReactions(on),
  setIdleMinutes: (minutes) => brain.setIdleMinutes(minutes),
  setAntics: (on) => brain.setAntics(on),
  anticNow: (kind = null) => {
    ensureUp();
    return brain.antic(kind, true);
  },
  doze: () => {
    ensureUp();
    brain.doze();
  },
  wakeUp: () => brain.wakeUp(),
  greet: () => {
    ensureUp();
    brain.greet();
  },
  toggleSetting: (key) => {
    settings.set({ [key]: !settings.get(key) });
    refresh();
  },
  testReminder: (kind = 'water') => {
    ensureUp();
    spidey.remind(reminders.TEXT[kind]);
  },
  takeDown: () => spidey.takeDown(),
  say: (text) => {
    ensureUp();
    spidey.remind(text);
  },
};

menu = new SpideyMenu({ settings, actions, brain, spidey });

// "Change hero every": the app's rotate timer.
let rotateTimer = 0;
function startRotateTimer() {
  clearInterval(rotateTimer);
  const minutes = settings.get('RotateMinutes');
  if (minutes > 0) {
    rotateTimer = setInterval(() => spidey.up && actions.nextHero(), minutes * 60 * 1000);
  }
}
startRotateTimer();

// The top bar: the "tray icon" opens his menu, and he can be hung back up after "exit".
const tray = document.querySelector('.tray');
tray.addEventListener('click', () => {
  const r = tray.getBoundingClientRect();
  menu.open(r.left, r.bottom + 6, tray);
});
const hangUp = document.querySelector('.hang-up');
hangUp.addEventListener('click', () => ensureUp());
// The focus countdown, where the app shows it: next to the menu bar icon.
const countdown = document.querySelector('[data-focus-countdown]');
refreshers.push(() => {
  hangUp.hidden = spidey.shown;
  hangUp.textContent = spidey.up ? 'Show him' : 'Hang him back up';
  if (countdown) {
    const label = brain.focusLabel;
    countdown.textContent = label;
    countdown.hidden = !label;
  }
});

initTheme(document.querySelector('.theme-toggle'));

refreshers.push(initPlayground({ settings, spidey, menu, actions }));
refreshers.push(initPersonality({ settings, spidey, brain, actions }));
refreshers.push(initReminders({ settings, spidey, actions }));
refreshers.push(initHeroes({ settings, actions }));
initTerminal({ settings, spidey, brain, actions });
initDownloads(document);
refresh();

// Show off the reminder bubble: once soon after the page opens, once when the Reminders section
// comes into view. The real reminders still come on the half hour and at 3:00 PM.
setTimeout(() => spidey.up && !spidey.bubble.visible && spidey.remind(reminders.TEXT.water), 2500);
const remindersSection = document.querySelector('#reminders');
if (remindersSection) {
  const seen = new IntersectionObserver((entries) => {
    if (entries.some((e) => e.isIntersecting)) {
      seen.disconnect();
      if (spidey.up && !spidey.bubble.visible) {
        spidey.remind(reminders.TEXT.lunch);
      }
    }
  }, { threshold: 0.4 });
  seen.observe(remindersSection);
}

// For the browser tests: a read-only view of what he is doing, like the app's window.__spideyState.
window.__spideyState = () => ({ ...spidey.readout(), anchorX: spidey.rig.anchor.x, flags: spidey.flags, bubble: spidey.bubble.visible,
  focus: brain.focus.phase, focusLabel: brain.focusLabel });
