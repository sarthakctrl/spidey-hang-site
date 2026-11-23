/*
 * The right-click menu, item for item the app's buildMenu() (src/main.js), built fresh each time it
 * opens so the current choices show. Opens on right-click or a long press on Spidey, from the web
 * icon in the page's menu bar (the app's tray icon), and from the playground's Menu button.
 *
 * Items the web cannot do (starting at sign-in, your own heroes, other screens, editing reminders)
 * are shown but disabled, with a note. Shortcuts show on the right, as in the app's menu.
 * Keyboard: arrows move, Right/Enter opens a submenu, Left/Escape goes back, Tab leaves.
 */
import { reminders } from '../../vendor/spidey/index.js';
import {
  DRAWN, SITE_HEROES, WATER_CHOICES, LUNCH_CHOICES, IDLE_CHOICES, FOCUS_CHOICES, SHORT_BREAK_CHOICES, LONG_BREAK_CHOICES,
} from './settings-store.js';

const isMac = () => /mac os x|macintosh/i.test(navigator.userAgent);

function startLabel() {
  const ua = navigator.userAgent;
  if (/windows/i.test(ua)) {
    return 'Start automatically with Windows';
  }
  if (/mac os x|macintosh/i.test(ua)) {
    return 'Start automatically at login';
  }
  return 'Start automatically at sign-in';
}

export class SpideyMenu {
  /** actions: main.js's actions. brain: the Brain (focus timer state). spidey: the HangingSpidey (shown, once). */
  constructor({ settings, actions, brain, spidey }) {
    this.settings = settings;
    this.actions = actions;
    this.brain = brain;
    this.spidey = spidey;
    this.layer = document.createElement('div');
    this.layer.className = 'menu-layer';
    this.layer.hidden = true;
    document.body.append(this.layer);
    this.opener = null;
    this.stack = [];
    this.nextId = 0;

    this.layer.addEventListener('pointerdown', (e) => {
      if (e.target === this.layer) {
        this.close();
      }
    });
    this.layer.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      if (e.target === this.layer) {
        this.close();
      }
    });
    window.addEventListener('resize', () => this.close());
    window.addEventListener('blur', () => this.close());
  }

  get isOpen() {
    return !this.layer.hidden;
  }

  template() {
    const s = this.settings;
    const a = this.actions;
    const brain = this.brain;
    const spidey = this.spidey;
    const radio = (label, checked, click) => ({ label, type: 'radio', checked, click });
    const relayout = (changes) => () => a.relayout(changes);
    const hero = s.get('Hero');
    const keys = isMac() ? '⌃⌥⇧' : 'Ctrl+Alt+Shift+';
    const now = Date.now();
    const focus = brain.focus;
    const lengths = (key, values) => values.map((m) => radio(`${m} minutes`, s.get(key) === m, () => a.setFocusLength(key, m)));
    const water = (m) => (m % 60 === 0 ? (m === 60 ? '1 hour' : `${m / 60} hours`) : `${m} minutes`);
    const time = (t) => reminders.clockTime(t);

    const focusMenu = {
      label: focus.running ? `Focus timer (${focus.label(now)})` : 'Focus timer',
      submenu: [
        ...(focus.running ? [{ label: focus.describe(now), enabled: false }] : []),
        focus.running
          ? { label: 'Stop', accel: `${keys}F`, click: () => a.stopFocus() }
          : { label: `Start a ${s.get('FocusMinutes')} minute focus`, accel: `${keys}F`, click: () => a.startFocus() },
        ...(focus.running ? [{ label: focus.phase === 'focus' ? 'Skip to the break' : 'Skip to the next focus', click: () => a.skipFocus() }] : []),
        { type: 'separator' },
        { label: 'Focus length', submenu: lengths('FocusMinutes', FOCUS_CHOICES) },
        { label: 'Short break', submenu: lengths('ShortBreakMinutes', SHORT_BREAK_CHOICES) },
        { label: 'Long break (every 4th)', submenu: lengths('LongBreakMinutes', LONG_BREAK_CHOICES) },
      ],
    };
    const remindersMenu = {
      label: 'Reminders',
      submenu: [
        { label: `Drink water every ${water(s.get('WaterMinutes'))}`, type: 'checkbox', checked: s.get('WaterReminder'), click: () => a.toggleReminder('WaterReminder') },
        { label: 'Water every', submenu: WATER_CHOICES.map((m) => radio(water(m), s.get('WaterMinutes') === m, () => a.setReminderTime({ WaterMinutes: m }))) },
        { label: `Lunch at ${time(s.get('LunchTime'))}`, type: 'checkbox', checked: s.get('LunchReminder'), click: () => a.toggleReminder('LunchReminder') },
        { label: 'Lunch time', submenu: LUNCH_CHOICES.map((t) => radio(time(t), s.get('LunchTime') === t, () => a.setReminderTime({ LunchTime: t }))) },
        ...(spidey.once.length ? [{ type: 'separator' }] : []),
        ...spidey.once.map((o) => ({ label: `${o.text}  (at ${o.at.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}, once)`, enabled: false })),
        { type: 'separator' },
        { label: 'Edit your reminders…', enabled: false, note: 'In the desktop app' },
        { label: 'Show a test reminder', click: () => a.testReminder() },
      ],
    };
    const hotkeyItem = {
      label: `Keyboard shortcuts (${keys}H hide, S swing, W web-swing, F focus)`,
      type: 'checkbox',
      checked: s.get('Hotkeys'),
      click: () => a.toggleSetting('Hotkeys'),
    };
    const startItem = { label: startLabel(), type: 'checkbox', checked: true, enabled: false, note: 'In the desktop app' };

    if (!spidey.shown) {
      return [
        spidey.up
          ? { label: 'Show him', accel: `${keys}H`, click: () => a.show() }
          : { label: 'Bring him back', click: () => a.show() },
        { type: 'separator' },
        focusMenu,
        remindersMenu,
        { type: 'separator' },
        hotkeyItem,
        startItem,
      ];
    }

    return [
      { label: 'Give him a swing', accel: `${keys}S`, click: () => a.swing() },
      {
        label: 'Web-swing to',
        submenu: [
          { label: 'Left', click: () => a.webSwing('left') },
          { label: 'Center', click: () => a.webSwing('center') },
          { label: 'Right', click: () => a.webSwing('right') },
          { label: 'Somewhere else', click: () => a.webSwing('random') },
          { label: 'Where the pointer is', accel: `${keys}W`, click: () => a.webSwing('pointer') },
          { type: 'separator' },
          { label: 'Across the screen', click: () => a.webSwing() },
        ],
      },
      { label: 'Reset', click: () => a.reset() },
      { type: 'separator' },
      {
        label: 'Position',
        submenu: [['Left', 0.12], ['Center', 0.5], ['Right', 0.88]].map(([name, fraction]) =>
          radio(name, Math.abs(s.get('AnchorFraction') - fraction) < 0.005, relayout({ AnchorFraction: fraction }))),
      },
      { label: 'Size', submenu: ['Small', 'Medium', 'Large'].map((n) => radio(n, s.get('Size') === n, relayout({ Size: n }))) },
      { label: 'Rope length', submenu: ['Short', 'Medium', 'Long'].map((n) => radio(n, s.get('Rope') === n, relayout({ Rope: n }))) },
      { label: 'Screen', submenu: [radio('Main screen', true, () => {}), { type: 'separator' }, { label: 'Follow the pointer', enabled: false, note: 'In the desktop app, across all your screens' }] },
      {
        label: 'Hero',
        submenu: [
          ...SITE_HEROES.filter((name) => name !== DRAWN)
            .map((name) => ({ label: name, type: 'checkbox', checked: hero === name, click: () => a.setHero(name) })),
          { type: 'separator' },
          { label: DRAWN, type: 'checkbox', checked: hero === DRAWN, click: () => a.setHero(DRAWN) },
          { type: 'separator' },
          {
            label: 'Change hero every',
            submenu: [0, 2, 5, 10, 30].map((m) => radio(m === 0 ? 'Never' : `${m} minutes`, s.get('RotateMinutes') === m, () => a.setRotate(m))),
          },
          { label: 'Next hero', click: () => a.nextHero() },
          { type: 'separator' },
          { label: 'Add a hero from a picture…', enabled: false, note: 'In the desktop app' },
        ],
      },
      { label: 'Swing on his own', type: 'checkbox', checked: s.get('AutoSwing'), click: () => a.setFlags({ AutoSwing: !s.get('AutoSwing') }) },
      { label: 'Breeze', type: 'checkbox', checked: s.get('Breeze'), click: () => a.setFlags({ Breeze: !s.get('Breeze') }) },
      {
        label: 'Personality',
        submenu: [
          { label: 'React to the computer (doze, greet, battery)', type: 'checkbox', checked: s.get('Reactions'), click: () => a.setReactions(!s.get('Reactions')) },
          {
            label: 'Doze after',
            enabled: s.get('Reactions'),
            submenu: IDLE_CHOICES.map((m) => radio(`${m} minutes away`, s.get('IdleMinutes') === m, () => a.setIdleMinutes(m))),
          },
          { type: 'separator' },
          { label: 'Do little things on his own', type: 'checkbox', checked: s.get('Antics'), click: () => a.setAntics(!s.get('Antics')) },
          { label: 'Do something now', click: () => a.anticNow() },
          { type: 'separator' },
          { label: 'Sounds', type: 'checkbox', checked: s.get('Sounds'), click: () => a.toggleSetting('Sounds') },
        ],
      },
      focusMenu,
      remindersMenu,
      { type: 'separator' },
      {
        label: 'Hide him',
        submenu: [
          { label: 'For 15 minutes', click: () => a.hide(15) },
          { label: 'For 1 hour', click: () => a.hide(60) },
          { label: 'Until you bring him back', accel: `${keys}H`, click: () => a.hide(0) },
        ],
      },
      { label: 'Take him down', click: () => a.takeDown() },
      { type: 'separator' },
      hotkeyItem,
      startItem,
    ];
  }

  /** Opens at a page point. opener: the element to give focus back to on close. */
  open(x, y, opener = document.activeElement) {
    this.close(false);
    this.opener = opener;
    this.layer.hidden = false;
    const list = this.render(this.template(), 0);
    this.place(list, x, y);
    this.focusItem(list, 0);
  }

  close(restoreFocus = true) {
    if (this.layer.hidden) {
      return;
    }
    this.layer.hidden = true;
    this.layer.replaceChildren();
    this.stack = [];
    if (restoreFocus && this.opener && typeof this.opener.focus === 'function') {
      this.opener.focus({ preventScroll: true });
    }
  }

  render(items, depth) {
    const list = document.createElement('ul');
    list.className = 'menu';
    list.setAttribute('role', 'menu');
    list.dataset.depth = depth;
    for (const item of items) {
      const li = document.createElement('li');
      if (item.type === 'separator') {
        li.className = 'menu-sep';
        li.setAttribute('role', 'separator');
        list.append(li);
        continue;
      }
      li.className = 'menu-item';
      li.tabIndex = -1;
      li.dataset.id = String(++this.nextId);
      li.setAttribute('role', item.type === 'checkbox' ? 'menuitemcheckbox' : item.type === 'radio' ? 'menuitemradio' : 'menuitem');
      if (item.type === 'checkbox' || item.type === 'radio') {
        li.setAttribute('aria-checked', String(Boolean(item.checked)));
      }
      if (item.enabled === false) {
        li.setAttribute('aria-disabled', 'true');
      }
      const mark = document.createElement('span');
      mark.className = 'menu-mark';
      mark.textContent = item.checked ? (item.type === 'radio' ? '●' : '✓') : '';
      mark.setAttribute('aria-hidden', 'true');
      const label = document.createElement('span');
      label.className = 'menu-label';
      label.textContent = item.label;
      li.append(mark, label);
      if (item.accel) {
        const accel = document.createElement('span');
        accel.className = 'menu-accel';
        accel.textContent = item.accel;
        accel.setAttribute('aria-hidden', 'true');
        li.append(accel);
      }
      if (item.note) {
        const note = document.createElement('span');
        note.className = 'menu-note';
        note.textContent = item.note;
        li.append(note);
      }
      if (item.submenu) {
        li.setAttribute('aria-haspopup', 'menu');
        li.setAttribute('aria-expanded', 'false');
        const arrow = document.createElement('span');
        arrow.className = 'menu-arrow';
        arrow.setAttribute('aria-hidden', 'true');
        arrow.textContent = '›';
        li.append(arrow);
      }
      li.addEventListener('pointerenter', () => {
        li.focus({ preventScroll: true });
        this.closeDeeper(depth);
        if (item.submenu) {
          this.openSub(li, item, depth);
        }
      });
      li.addEventListener('click', (e) => {
        e.stopPropagation();
        this.activate(li, item, depth);
      });
      li.addEventListener('keydown', (e) => this.key(e, li, item, depth));
      list.append(li);
    }
    this.layer.append(list);
    this.stack[depth] = list;
    return list;
  }

  activate(li, item, depth) {
    if (item.enabled === false) {
      return;
    }
    if (item.submenu) {
      this.openSub(li, item, depth, true);
      return;
    }
    this.close();
    item.click?.();
  }

  openSub(li, item, depth, focus = false) {
    if (this.stack[depth + 1]?.dataset.owner === li.dataset.id) {
      if (focus) {
        this.focusItem(this.stack[depth + 1], 0);
      }
      return;
    }
    this.closeDeeper(depth);
    li.setAttribute('aria-expanded', 'true');
    const sub = this.render(item.submenu, depth + 1);
    sub.dataset.owner = li.dataset.id;
    const r = li.getBoundingClientRect();
    const w = sub.offsetWidth;
    const x = r.right + w + 4 > window.innerWidth ? r.left - w + 4 : r.right - 4;
    this.place(sub, x, r.top - 6);
    if (focus) {
      this.focusItem(sub, 0);
    }
  }

  closeDeeper(depth) {
    while (this.stack.length > depth + 1) {
      const sub = this.stack.pop();
      const owner = this.stack[depth]?.querySelector(`[data-id="${sub.dataset.owner}"]`);
      owner?.setAttribute('aria-expanded', 'false');
      sub.remove();
    }
  }

  place(list, x, y) {
    const w = list.offsetWidth;
    const h = list.offsetHeight;
    const left = Math.max(8, Math.min(x, window.innerWidth - w - 8));
    const top = Math.max(8, Math.min(y, window.innerHeight - h - 8));
    list.style.left = `${left}px`;
    list.style.top = `${top}px`;
  }

  items(list) {
    return [...list.querySelectorAll(':scope > .menu-item')];
  }

  focusItem(list, index) {
    const items = this.items(list);
    items[(index + items.length) % items.length]?.focus({ preventScroll: true });
  }

  key(e, li, item, depth) {
    const list = this.stack[depth];
    const items = this.items(list);
    const at = items.indexOf(li);
    switch (e.key) {
      case 'ArrowDown':
        this.focusItem(list, at + 1);
        break;
      case 'ArrowUp':
        this.focusItem(list, at - 1);
        break;
      case 'Home':
        this.focusItem(list, 0);
        break;
      case 'End':
        this.focusItem(list, items.length - 1);
        break;
      case 'ArrowRight':
        if (item.submenu) {
          this.openSub(li, item, depth, true);
        }
        break;
      case 'ArrowLeft':
        if (depth > 0) {
          const owner = this.stack[depth - 1].querySelector(`[data-id="${list.dataset.owner}"]`);
          this.closeDeeper(depth - 1);
          owner?.focus();
        }
        break;
      case 'Enter':
      case ' ':
        this.activate(li, item, depth);
        break;
      case 'Escape':
        if (depth > 0) {
          const owner = this.stack[depth - 1].querySelector(`[data-id="${list.dataset.owner}"]`);
          this.closeDeeper(depth - 1);
          owner?.focus();
        } else {
          this.close();
        }
        break;
      case 'Tab':
        this.close();
        return;
      default:
        return;
    }
    e.preventDefault();
  }
}
