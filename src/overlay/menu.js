/*
 * The right-click menu, item for item the app's buildMenu() (src/main.js), built fresh each time it
 * opens so the current choices show. Opens on right-click or a long press on Spidey, from the web
 * icon in the page's menu bar (the app's tray icon), and from the playground's Menu button.
 *
 * The one item the web cannot do (starting at sign-in) is shown but disabled, with a note.
 * Keyboard: arrows move, Right/Enter opens a submenu, Left/Escape goes back, Tab leaves.
 */
import { DRAWN, SITE_HEROES } from './settings-store.js';

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
  /** actions: { swing, reset, relayout, setFlags, nextHero, setRotate, toggleReminder, testReminder, takeDown, say } */
  constructor({ settings, actions }) {
    this.settings = settings;
    this.actions = actions;
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
    const radio = (label, checked, click) => ({ label, type: 'radio', checked, click });
    const relayout = (changes) => () => a.relayout(changes);
    const hero = s.get('Hero');
    return [
      { label: 'Give him a swing', click: () => a.swing() },
      { label: 'Reset', click: () => a.reset() },
      { type: 'separator' },
      {
        label: 'Position',
        submenu: [['Left', 0.12], ['Center', 0.5], ['Right', 0.88]].map(([name, fraction]) =>
          radio(name, Math.abs(s.get('AnchorFraction') - fraction) < 0.005, relayout({ AnchorFraction: fraction }))),
      },
      { label: 'Size', submenu: ['Small', 'Medium', 'Large'].map((n) => radio(n, s.get('Size') === n, relayout({ Size: n }))) },
      { label: 'Rope length', submenu: ['Short', 'Medium', 'Long'].map((n) => radio(n, s.get('Rope') === n, relayout({ Rope: n }))) },
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
        ],
      },
      { label: 'Swing on his own', type: 'checkbox', checked: s.get('AutoSwing'), click: () => a.setFlags({ AutoSwing: !s.get('AutoSwing') }) },
      { label: 'Breeze', type: 'checkbox', checked: s.get('Breeze'), click: () => a.setFlags({ Breeze: !s.get('Breeze') }) },
      {
        label: 'Reminders',
        submenu: [
          { label: 'Drink water every 30 minutes', type: 'checkbox', checked: s.get('WaterReminder'), click: () => a.toggleReminder('WaterReminder') },
          { label: 'Lunch at 3:00 PM', type: 'checkbox', checked: s.get('LunchReminder'), click: () => a.toggleReminder('LunchReminder') },
          { type: 'separator' },
          { label: 'Show a test reminder', click: () => a.testReminder() },
        ],
      },
      { type: 'separator' },
      { label: startLabel(), type: 'checkbox', checked: true, enabled: false, note: 'In the desktop app' },
      { label: 'Take him down (exit)', click: () => a.takeDown() },
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
