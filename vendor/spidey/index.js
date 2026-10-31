/*
 * Spidey Hang's own browser code, loaded in the order the app's overlay.html loads it.
 * Each file registers itself on globalThis.SH (and figure.js on globalThis.SpideyFigure).
 * Written by hand, not by the sync script.
 */
import './vec.js';
import './rig.js';
import './images.js';
import './stage.js';
import './figure.js';
import './bubble.js';
import './bubble.css';

export const { rig: RIG, stage: STAGE, bubble: BUBBLE, images: IMAGES } = globalThis.SH;
export const SpideyFigure = globalThis.SpideyFigure;
export * as reminders from './reminders.js';
