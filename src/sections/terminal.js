/*
 * A terminal that speaks the app's command language to the Spidey on this page.
 * The parsing is the app's (lib/commands.js); what each command does matches handleCommand().
 */
import { reminders } from '../../vendor/spidey/index.js';
import { parseCommand, HELP } from '../lib/commands.js';
import { SITE_HEROES } from '../overlay/settings-store.js';

export function initTerminal({ settings, spidey, brain, actions }) {
  const out = document.querySelector('[data-term-out]');
  const form = document.querySelector('[data-term-form]');
  const input = document.querySelector('[data-term-input]');
  if (!out || !form || !input) {
    return;
  }
  const history = [];
  let historyAt = 0;

  const print = (text, cls = '') => {
    const line = document.createElement('div');
    if (cls) {
      line.className = cls;
    }
    line.textContent = text;
    out.append(line);
    out.scrollTop = out.scrollHeight;
  };

  print('Spidey Hang command channel. Type "help" for the commands.', 't-dim');
  print('Like the app, anything it does not know is quietly ignored.', 't-dim');

  const needsSpidey = () => {
    if (!spidey.up) {
      print('No Spidey is listening: he was taken down. Use "Hang him back up" at the top.', 't-err');
      return false;
    }
    return true;
  };

  const run = (line) => {
    print(`spidey> ${line}`, 't-cmd');
    const cmd = parseCommand(line);
    switch (cmd.type) {
      case 'empty':
        return;
      case 'help':
        HELP.forEach((h) => print(h));
        return;
      case 'clear':
        out.replaceChildren();
        return;
      case 'ignored':
        print('(ignored)', 't-dim');
        return;
      case 'refused':
        print(cmd.reason, 't-err');
        return;
      case 'up':
      case 'show':
        actions.show();
        print(cmd.type === 'up' ? 'ok, hanging again' : 'ok, shown');
        return;
      case 'focus':
        runFocus(cmd);
        return;
      case 'once': {
        const item = brain.addOnce(cmd.words);
        if (item) {
          print(`One-off reminder at ${item.at.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}: ${item.text} (kept until this page closes)`);
        } else {
          print(`One-off reminder refused, time not understood: ${cmd.words}`, 't-err');
        }
        return;
      }
      default:
        break;
    }
    if (!needsSpidey()) {
      return;
    }
    switch (cmd.type) {
      case 'push':
        spidey.push(cmd.strength);
        print(`ok, pushed with strength ${cmd.strength}`);
        break;
      case 'reset':
        spidey.reset();
        print('ok, hanging straight');
        break;
      case 'swing': {
        const on = cmd.mode === 'on' ? true : cmd.mode === 'off' ? false : !settings.get('AutoSwing');
        spidey.setFlags({ AutoSwing: on });
        print(`ok, swing on his own: ${on ? 'on' : 'off'}`);
        break;
      }
      case 'hero': {
        if (cmd.next) {
          actions.nextHero();
          print(`Hero: ${settings.get('Hero')}`);
          break;
        }
        const name = SITE_HEROES.find((h) => h.toLowerCase() === cmd.name.toLowerCase());
        if (name) {
          actions.setHero(name);
          print(`Hero: ${name}`);
        } else {
          print(`No hero called "${cmd.name}" on this page. Here: ${SITE_HEROES.join(', ')}.`, 't-err');
        }
        break;
      }
      case 'rotate':
        actions.setRotate(cmd.minutes);
        print(`Change hero every: ${cmd.minutes > 0 ? `${cmd.minutes} min` : 'off'}`);
        break;
      case 'remind':
        spidey.remind(cmd.kind === 'note' ? cmd.text : reminders.TEXT[cmd.kind]);
        print(`Reminder (${cmd.kind}) shown`);
        break;
      case 'snapshot':
        spidey.snapshot(cmd.file);
        print(`Saved ${cmd.file.split(/[\\/]/).pop()} (check your downloads)`);
        break;
      case 'stats':
        print(spidey.statsLine());
        break;
      case 'web':
        actions.webSwing(cmd.where === 'across' ? undefined : cmd.where);
        print(`ok, web-swing ${cmd.where === 'across' ? 'across' : `to ${cmd.where}`}`);
        break;
      case 'dismiss':
        spidey.bubble.hide();
        print('ok, dismissed');
        break;
      case 'hide':
        actions.hide(cmd.minutes);
        print(cmd.minutes > 0 ? `Hidden for ${cmd.minutes} min ("show" brings him back)` : 'Hidden until "show"');
        break;
      case 'antic': {
        const did = actions.anticNow(cmd.kind);
        print(did ? `Antic: ${did}` : 'Antic skipped: busy', did ? '' : 't-dim');
        break;
      }
      case 'sleep':
        actions.doze();
        print('Dozing off');
        break;
      case 'wake':
        actions.wakeUp();
        print('Woke up');
        break;
      case 'greet':
        actions.greet();
        print('Greeting shown');
        break;
      case 'down':
      case 'exit':
        actions.takeDown();
        print(cmd.type === 'down' ? 'Taken down ("up" hangs him again)' : 'Exit');
        break;
      default:
        break;
    }
  };

  function runFocus(cmd) {
    if (cmd.action === 'start') {
      actions.startFocus(cmd.minutes);
    } else if (cmd.action === 'stop') {
      actions.stopFocus();
    } else if (cmd.action === 'skip') {
      actions.skipFocus();
    }
    print(`Focus status: ${brain.focus.describe(Date.now())}`);
  }

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const line = input.value;
    input.value = '';
    if (line.trim()) {
      history.push(line);
    }
    historyAt = history.length;
    run(line);
  });

  input.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowUp' && historyAt > 0) {
      input.value = history[--historyAt];
      e.preventDefault();
    } else if (e.key === 'ArrowDown') {
      historyAt = Math.min(history.length, historyAt + 1);
      input.value = history[historyAt] || '';
      e.preventDefault();
    }
  });

  for (const chip of document.querySelectorAll('[data-cmd]')) {
    chip.addEventListener('click', () => {
      history.push(chip.dataset.cmd);
      historyAt = history.length;
      run(chip.dataset.cmd);
    });
  }
}
