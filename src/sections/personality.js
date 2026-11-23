/*
 * The "new tricks" sections: web-swing buttons, his personality (doze, greet, battery, antics,
 * sounds) and the focus timer, each driving the Spidey on this page through main.js's actions.
 * Returns a refresh function that re-reads the settings and the focus timer.
 */
import { reactions } from '../../vendor/spidey/index.js';

export function initPersonality({ settings, spidey, brain, actions }) {
  for (const btn of document.querySelectorAll('[data-web]')) {
    btn.addEventListener('click', () => actions.webSwing(btn.dataset.web === 'across' ? undefined : btn.dataset.web));
  }

  for (const btn of document.querySelectorAll('[data-antic]')) {
    btn.addEventListener('click', () => actions.anticNow(btn.dataset.antic || null));
  }

  // Acting out what the app reacts to: the computer going idle, coming back, a low battery.
  const battery = (level) => {
    const watch = new reactions.BatteryWatch();
    const line = watch.report({ level, charging: false });
    if (line) {
      actions.say(line);
    }
  };
  const react = {
    doze: () => actions.doze(),
    wake: () => actions.wakeUp(),
    greet: () => actions.greet(),
    battery20: () => battery(0.19),
    battery10: () => battery(0.09),
  };
  for (const btn of document.querySelectorAll('[data-react]')) {
    btn.addEventListener('click', () => react[btn.dataset.react]?.());
  }

  for (const btn of document.querySelectorAll('[data-hide]')) {
    btn.addEventListener('click', () => actions.hide(Number(btn.dataset.hide) || 0));
  }

  for (const input of document.querySelectorAll('[data-setting]')) {
    input.addEventListener('change', () => {
      const key = input.dataset.setting;
      if (key === 'Reactions') {
        actions.setReactions(input.checked);
      } else if (key === 'Antics') {
        actions.setAntics(input.checked);
      } else if (settings.get(key) !== input.checked) {
        actions.toggleSetting(key);
      }
    });
  }

  // The focus timer panel.
  const focusButtons = {
    start: () => actions.startFocus(),
    demo: () => actions.startFocus(1),
    stop: () => actions.stopFocus(),
    skip: () => actions.skipFocus(),
  };
  for (const btn of document.querySelectorAll('[data-focus]')) {
    btn.addEventListener('click', () => focusButtons[btn.dataset.focus]?.());
  }
  const focusState = document.querySelector('[data-focus-state]');
  const focusBig = document.querySelector('[data-focus-big]');
  const running = document.querySelectorAll('[data-focus-running]');
  const idle = document.querySelectorAll('[data-focus-idle]');
  const focusLengths = document.querySelectorAll('[data-focus-length]');

  return () => {
    for (const input of document.querySelectorAll('[data-setting]')) {
      input.checked = Boolean(settings.get(input.dataset.setting));
    }
    const now = Date.now();
    const on = brain.focus.running;
    if (focusState) {
      focusState.textContent = brain.focus.describe(now);
    }
    if (focusBig) {
      focusBig.textContent = on ? brain.focus.label(now) : `${settings.get('FocusMinutes')}m`;
    }
    running.forEach((el) => {
      el.hidden = !on;
    });
    idle.forEach((el) => {
      el.hidden = on;
    });
    focusLengths.forEach((el) => {
      el.textContent = settings.get(el.dataset.focusLength);
    });
    for (const btn of document.querySelectorAll('[data-focus-start-label]')) {
      btn.textContent = `Start a ${settings.get('FocusMinutes')} minute focus`;
    }
    for (const btn of document.querySelectorAll('[data-react="wake"]')) {
      btn.disabled = !spidey.dozing;
    }
  };
}
