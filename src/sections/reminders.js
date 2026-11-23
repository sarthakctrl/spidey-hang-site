/*
 * The reminders section: a clock, when the next reminder is due (the app's own nextReminders()),
 * test buttons, the two switches from the Reminders menu, and Water every / Lunch time.
 */
import { reminders } from '../../vendor/spidey/index.js';
import { WATER_CHOICES, LUNCH_CHOICES } from '../overlay/settings-store.js';

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

export function initReminders({ settings, spidey, actions }) {
  const clock = document.querySelector('[data-clock]');
  const next = document.querySelector('[data-next-reminder]');

  for (const btn of document.querySelectorAll('[data-remind]')) {
    btn.addEventListener('click', () => actions.testReminder(btn.dataset.remind));
  }
  for (const input of document.querySelectorAll('[data-reminder]')) {
    input.addEventListener('change', () => actions.toggleReminder(input.dataset.reminder));
  }

  // Water every / Lunch time, the app's choices.
  const waterLabel = (m) => (m % 60 === 0 ? (m === 60 ? '1 hour' : `${m / 60} hours`) : `${m} minutes`);
  const selects = {
    WaterMinutes: { choices: WATER_CHOICES, label: waterLabel, value: Number },
    LunchTime: { choices: LUNCH_CHOICES, label: (t) => reminders.clockTime(t), value: String },
  };
  for (const el of document.querySelectorAll('[data-reminder-time]')) {
    const spec = selects[el.dataset.reminderTime];
    if (!spec) {
      continue;
    }
    for (const choice of spec.choices) {
      el.append(new Option(spec.label(choice), String(choice)));
    }
    el.addEventListener('change', () => actions.setReminderTime({ [el.dataset.reminderTime]: spec.value(el.value) }));
  }
  const waterText = document.querySelectorAll('[data-water-every]');
  const lunchText = document.querySelectorAll('[data-lunch-at]');

  const tick = () => {
    const now = new Date();
    if (clock) {
      clock.textContent = time(now);
    }
    if (next) {
      const due = reminders.nextReminders(now, {
        water: settings.get('WaterReminder'),
        waterMinutes: settings.get('WaterMinutes'),
        lunch: settings.get('LunchReminder'),
        lunchTime: settings.get('LunchTime'),
        once: spidey.once,
      });
      next.replaceChildren();
      if (!due) {
        next.textContent = 'Both reminders are off.';
      } else {
        const text = document.createElement('b');
        text.textContent = `“${due.items[0].text}”`;
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
    for (const el of document.querySelectorAll('[data-reminder-time]')) {
      el.value = String(settings.get(el.dataset.reminderTime));
    }
    waterText.forEach((el) => {
      el.textContent = waterLabel(settings.get('WaterMinutes'));
    });
    lunchText.forEach((el) => {
      el.textContent = reminders.clockTime(settings.get('LunchTime'));
    });
    tick();
  };
}
