/*
 * The reminders section: a clock, when the next reminder is due (the app's own nextReminder()),
 * test buttons, and the two switches from the Reminders menu.
 */
import { reminders } from '../../vendor/spidey/index.js';

const time = (d) => d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });

function until(ms) {
  const minutes = Math.max(0, Math.ceil(ms / 60000));
  if (minutes < 1) {
    return 'any second now';
  }
  if (minutes < 60) {
    return `in ${minutes} min`;
  }
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `in ${h} h${m ? ` ${m} min` : ''}`;
}

export function initReminders({ settings, actions }) {
  const clock = document.querySelector('[data-clock]');
  const next = document.querySelector('[data-next-reminder]');

  for (const btn of document.querySelectorAll('[data-remind]')) {
    btn.addEventListener('click', () => actions.testReminder(btn.dataset.remind));
  }
  for (const input of document.querySelectorAll('[data-reminder]')) {
    input.addEventListener('change', () => actions.toggleReminder(input.dataset.reminder));
  }

  const tick = () => {
    const now = new Date();
    if (clock) {
      clock.textContent = time(now);
    }
    if (next) {
      const due = reminders.nextReminder(now, { water: settings.get('WaterReminder'), lunch: settings.get('LunchReminder') });
      next.replaceChildren();
      if (!due) {
        next.textContent = 'Both reminders are off.';
      } else {
        const text = document.createElement('b');
        text.textContent = `“${reminders.TEXT[due.kind]}”`;
        next.append('Next: ', text, ` at ${time(due.at)}, ${until(due.at - now)}.`);
      }
    }
  };
  tick();
  setInterval(tick, 1000);

  return () => {
    for (const input of document.querySelectorAll('[data-reminder]')) {
      input.checked = Boolean(settings.get(input.dataset.reminder));
    }
    tick();
  };
}
