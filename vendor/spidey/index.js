/*
 * Spidey Hang's own browser code, loaded in the order the app's overlay.html loads it.
 * Each file registers itself on globalThis.SH (and figure.js on globalThis.SpideyFigure).
 * Written by hand, not by the sync script.
 */
import './bubble.js';
import './sound.js';
import './vec.js';
import './rig.js';
import './travel.js';
import './images.js';
import './stage.js';
import './figure.js';
import './bubble.css';

export const { rig: RIG, travel: TRAVEL, stage: STAGE, bubble: BUBBLE, images: IMAGES, sound: SOUND } = globalThis.SH;
export const SpideyFigure = globalThis.SpideyFigure;
export * as reminders from './reminders.js';
export * as focus from './focus.js';
export * as reactions from './reactions.js';
