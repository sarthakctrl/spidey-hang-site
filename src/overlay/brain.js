/*
 * What the app's main process decides, in the page: the focus timer, dozing and greeting, battery
 * warnings, the little things he does on his own (antics), keyboard shortcuts and one-off reminders.
 * The choices are the app's own code (vendor/spidey focus.js, reactions.js, reminders.js); this file
 * only wires them to the page instead of to Electron's powerMonitor, tray and global shortcuts.
 *
 *   app                                          web
 *   no keyboard or mouse for N minutes           no keyboard, mouse, touch or scrolling on this page
 *   screen locked, computer asleep               this tab hidden for N minutes or more
 *   countdown next to the menu bar icon          countdown next to the web icon in the top bar
 *   global shortcuts (Ctrl+Shift H/B/S/W/F)      the same keys while this page has focus
 *
 * Nothing here polls: each timer is set for when something is due, and moving the mouse only writes
 * down the time. Idle stays at 0% CPU, as in the app.
 */
import { focus as FOCUS, reactions, reminders } from '../../vendor/spidey/index.js';

const MINUTE = 60000;

export class Brain {
  /** spidey: the HangingSpidey. settings: the SettingsStore. onChange(): redraw what shows state. */
  constructor({ spidey, settings, onChange = () => {} }) {
    this.spidey = spidey;
    this.settings = settings;
    this.onChange = onChange;

    this.focus = new FOCUS.Focus(() => ({
      focus: settings.get('FocusMinutes'),
      short: settings.get('ShortBreakMinutes'),
      long: settings.get('LongBreakMinutes'),
    }));
    this.focusTimer = 0;
    this.lastInput = Date.now();
    this.idleTimer = 0;
    this.hiddenAt = 0;
    this.anticTimer = 0;
    this.lastAntic = null;
    this.lastLine = null;
    this.battery = new reactions.BatteryWatch();

    this.watchInput();
    this.watchBattery();
    this.watchKeys();
    this.scheduleIdle();
    this.scheduleAntic();
  }

  // ---- Focus timer ----------------------------------------------------------------------------

  startFocus(minutes) {
    this.focus.start(Date.now(), minutes);
    this.say("Focus time. I'll keep watch!");
    this.armFocus();
  }

  stopFocus() {
    if (!this.focus.running) {
      return;
    }
    this.focus.stop();
    clearTimeout(this.focusTimer);
    this.onChange();
  }

  skipFocus() {
    const change = this.focus.skip(Date.now());
    if (change) {
      this.focusEnded(change);
    }
    this.armFocus();
  }

  toggleFocus() {
    if (this.focus.running) {
      this.stopFocus();
    } else {
      this.startFocus();
    }
  }

  /** Wakes when the countdown next changes (once a minute, each second in the last), never more. */
  armFocus() {
    clearTimeout(this.focusTimer);
    this.onChange();
    if (!this.focus.running) {
      return;
    }
    this.focusTimer = setTimeout(() => {
      const change = this.focus.update(Date.now());
      if (change) {
        this.focusEnded(change);
      }
      this.armFocus();
    }, this.focus.nextTick(Date.now()));
  }

  /** A part ended: a big swing at the end of a focus, and a bubble saying what comes next. */
  focusEnded(change) {
    if (change.ended === 'focus') {
      this.spidey.push(1.6);
    }
    this.say(FOCUS.focusMessage(change));
  }

  /** The countdown, as the app shows it by the menu bar icon: '24m', '45s', 'Break 4m'; '' when idle. */
  get focusLabel() {
    return this.focus.label(Date.now());
  }

  // ---- Dozing and greeting --------------------------------------------------------------------

  watchInput() {
    const touched = () => {
      this.lastInput = Date.now();
      if (this.spidey.dozing) {
        this.wakeUp();
      }
    };
    for (const type of ['pointermove', 'pointerdown', 'keydown', 'wheel', 'touchstart', 'scroll']) {
      window.addEventListener(type, touched, { passive: true, capture: true });
    }
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) {
        this.hiddenAt = Date.now();
        return;
      }
      // Away long enough (a locked screen, in the app): he dozed meanwhile, and greets you now.
      const away = this.hiddenAt && Date.now() - this.hiddenAt >= this.settings.get('IdleMinutes') * MINUTE;
      this.hiddenAt = 0;
      this.lastInput = Date.now();
      if (away && this.settings.get('Reactions')) {
        this.spidey.setDoze(true);
        setTimeout(() => this.wakeUp(), 600);
      }
      this.scheduleIdle();
    });
  }

  /** Checks for "away" once, when it would first be true, then again only as far as needed. */
  scheduleIdle() {
    clearTimeout(this.idleTimer);
    if (!this.settings.get('Reactions')) {
      return;
    }
    const limit = this.settings.get('IdleMinutes') * MINUTE;
    const wait = Math.max(1000, this.lastInput + limit - Date.now());
    this.idleTimer = setTimeout(() => {
      if (Date.now() - this.lastInput >= limit && !document.hidden) {
        this.doze();
      } else {
        this.scheduleIdle();
      }
    }, wait);
  }

  doze() {
    if (!this.spidey.dozing) {
      this.spidey.setDoze(true);
    }
  }

  /** Wakes with a stretch and says hello: "Good morning!" the first time each day. */
  wakeUp() {
    if (!this.spidey.dozing) {
      return;
    }
    this.spidey.setDoze(false);
    this.greet();
    this.scheduleIdle();
  }

  greet() {
    const { text, day } = reactions.greeting(new Date(), this.settings.get('LastGreeting'));
    if (this.settings.get('LastGreeting') !== day) {
      this.settings.set({ LastGreeting: day });
    }
    this.say(text);
  }

  setReactions(on) {
    this.settings.set({ Reactions: on });
    if (!on && this.spidey.dozing) {
      this.spidey.setDoze(false);
    }
    this.scheduleIdle();
    this.onChange();
  }

  setIdleMinutes(minutes) {
    this.settings.set({ IdleMinutes: minutes });
    this.scheduleIdle();
  }

  // ---- Battery --------------------------------------------------------------------------------

  /** Chrome and Edge tell a page about the battery (events only, nothing polls). Others never warn. */
  watchBattery() {
    if (!navigator.getBattery) {
      return;
    }
    navigator.getBattery().then((battery) => {
      const report = () => {
        const line = this.battery.report({ level: battery.level, charging: battery.charging });
        if (line && this.settings.get('Reactions')) {
          this.say(line);
        }
      };
      battery.addEventListener('levelchange', report);
      battery.addEventListener('chargingchange', report);
      report();
    }, () => {});
  }

  // ---- Antics ---------------------------------------------------------------------------------

  /** The next antic in 3 to 7 minutes, if they are on. */
  scheduleAntic() {
    clearTimeout(this.anticTimer);
    if (!this.settings.get('Antics')) {
      return;
    }
    this.anticTimer = setTimeout(() => {
      if (!document.hidden) {
        this.antic(null, false);
      }
      this.scheduleAntic();
    }, reactions.anticDelay());
  }

  /** One antic: `kind` or a random one. Unless forced, none while he dozes or during a focus. */
  antic(kind, forced) {
    if (!forced && (this.spidey.dozing || this.focus.phase === 'focus')) {
      return false;
    }
    const what = reactions.ANTICS.includes(kind) ? kind : reactions.pickAntic(Math.random, this.lastAntic);
    this.lastAntic = what;
    let text = '';
    if (what === 'say') {
      text = this.lastLine = reactions.pickLine(Math.random, this.lastLine);
    }
    return this.spidey.antic(what, text) ? what : false;
  }

  setAntics(on) {
    this.settings.set({ Antics: on });
    this.scheduleAntic();
    this.onChange();
  }

  // ---- One-off reminders ----------------------------------------------------------------------

  /** "in 10 Tea is ready" or "at 15:30 Call back". Returns the reminder, or null if the time is not understood. */
  addOnce(words) {
    const once = reminders.parseOnce(words, new Date());
    if (!once || this.spidey.once.length >= 20) {
      return null;
    }
    const item = { id: 'o' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6), at: once.at, text: once.text };
    this.spidey.once.push(item);
    this.spidey.restartReminders();
    this.onChange();
    return item;
  }

  // ---- Keyboard shortcuts ---------------------------------------------------------------------

  /**
   * Control+Shift (Ctrl+Shift) and H hide or show, B bring back, S swing, W web-swing to the pointer, F focus.
   * The browser keeps some for itself (Ctrl+Shift+W closes the window on Windows and Linux).
   */
  watchKeys() {
    window.addEventListener('keydown', (e) => {
      if (!this.settings.get('Hotkeys') || !e.ctrlKey || !e.shiftKey || e.altKey || e.metaKey || e.repeat) {
        return;
      }
      const act = {
        KeyH: () => (this.spidey.hidden ? this.spidey.showAgain() : this.spidey.hide(0)),
        KeyB: () => (this.spidey.up ? this.spidey.showAgain() : this.spidey.hangUp()),
        KeyS: () => this.spidey.push(1),
        KeyW: () => this.spidey.webSwing('pointer'),
        KeyF: () => this.toggleFocus(),
      }[e.code];
      if (act) {
        e.preventDefault();
        act();
      }
    });
  }

  // ---- Helpers --------------------------------------------------------------------------------

  say(text) {
    if (this.spidey.shown) {
      this.spidey.remind(text);
    }
  }
}
