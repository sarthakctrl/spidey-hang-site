/*
 * The app's picture heroes on the web, loaded with the app's own picture code (images.js CustomFigure,
 * stage.js HeroLook). Pictures and settings come from the app's src/heroes/<name>/ (hang.webp and
 * hero.json), as in ~/Hang-in-there-1. "Iconic Spidey - Both" borrows the other two Iconic pictures,
 * as its hero.json "file" entries do.
 *
 * Points are in the picture's own pixels: grip (where the web ties on), face (where reminder bubbles
 * point, with faceSize its radius), tilt (degrees, clockwise).
 */
import { IMAGES, STAGE } from '../../vendor/spidey/index.js';
import animatedUrl from '../assets/heroes/animated-spidey-web-swing.webp';
import comicUrl from '../assets/heroes/comic-spidey-web-swing.webp';
import upsideDownUrl from '../assets/heroes/iconic-spidey-upside-down.webp';
import iconicSwingUrl from '../assets/heroes/iconic-spidey-web-swing.webp';
import ironSpiderUrl from '../assets/heroes/iron-spider-web-swing.webp';

const point = (x, y) => ({ x, y });

const UPSIDE_DOWN = { url: upsideDownUrl, faceSize: 62, face: point(255, 662) };
const ICONIC_SWING = { url: iconicSwingUrl, tilt: -7, faceSize: 75, grip: point(330, 518), face: point(290, 185) };

/** name -> { about, poses: { hang, swing? } }, in the app's menu order (alphabetical). */
export const HEROES = {
  'Animated Spidey - Web Swing': {
    about: 'Animated style, hanging from one fist, the other hand out in a thwip',
    poses: { hang: { url: animatedUrl, tilt: -20, faceSize: 36, grip: point(366, 22), face: point(182, 145) } },
  },
  'Comic Spidey - Web Swing': {
    about: 'Classic comic style, both fists on his web',
    poses: { hang: { url: comicUrl, tilt: -12, faceSize: 40, grip: point(408, 34), face: point(333, 214) } },
  },
  'Iconic Spidey - Both': {
    about: 'Upside down at rest, the swing pose while he moves',
    poses: { hang: UPSIDE_DOWN, swing: ICONIC_SWING },
  },
  'Iconic Spidey - Upside Down': {
    about: 'The classic upside-down hang',
    poses: { hang: UPSIDE_DOWN },
  },
  'Iconic Spidey - Web Swing': {
    about: 'Mid-swing, holding the web in his fist',
    poses: { hang: ICONIC_SWING },
  },
  'Iron Spider - Web Swing': {
    about: 'The Iron Spider suit, hanging from his raised fist',
    poses: { hang: { url: ironSpiderUrl, tilt: 4, faceSize: 45, grip: point(262, 32), face: point(452, 253) } },
  },
};

export const heroPictureUrl = (name) => HEROES[name]?.poses.hang.url || null;

const bytes = new Map();

function fetchBytes(url) {
  if (!bytes.has(url)) {
    bytes.set(url, fetch(url).then((res) => {
      if (!res.ok) {
        throw new Error(`could not fetch the picture (${res.status})`);
      }
      return res.arrayBuffer();
    }).then((buf) => new Uint8Array(buf)));
  }
  return bytes.get(url);
}

/** A HeroLook for Stage, sized for bodyLength, or throws. Like the app's loadLook(). */
export async function loadHeroLook(name, bodyLength, pixelsPerDip) {
  const hero = HEROES[name];
  if (!hero) {
    throw new Error(`no hero called ${name}`);
  }
  const loaded = {};
  for (const [pose, { url, ...hold }] of Object.entries(hero.poses)) {
    loaded[pose] = await IMAGES.CustomFigure.load(await fetchBytes(url), false, bodyLength, pixelsPerDip, 1.3, hold);
  }
  return new STAGE.HeroLook(name, 'web', loaded);
}
