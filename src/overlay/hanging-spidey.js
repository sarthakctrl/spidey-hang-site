/*
 * Spidey Hang's overlay, in a web page. A port of the app's src/renderer/hang-view.js that runs the
 * same Rig, Stage, drawn Spider-Man and reminder bubble. What changes:
 *
 *   app (Electron)                               web
 *   transparent always-on-top window             a fixed layer over the whole page
 *   setIgnoreMouseEvents(true, { forward })      pointer-events: none, switched on over his pixels
 *   main process sends setup/flags/push/remind   method calls from the menu, panel and terminal
 *   ~/.spidey-hang/settings.json                 localStorage (settings-store.js)
 *   the window moves with the web knot           the knot moves inside the page
 *
 * Everything he does is the app's code: the physics, the drawing, the pose and arm lag, the
 * frame rationing (60 a second, 30 when calm), and the stop-drawing-when-still rule. One difference:
 * he starts still and only moves when the visitor moves him or turns on "Swing on his own".
 */
import { RIG, STAGE, BUBBLE, SpideyFigure, reminders } from '../../vendor/spidey/index.js';
import { makeBubble } from './bubble-element.js';
import { loadHeroLook } from './web-heroes.js';
import { DRAWN } from './settings-store.js';

const { Rig, STEP, REACH_PAST_HEAD } = RIG;
const { Stage, SILK } = STAGE;

const FULL_FRAME = 1 / 60;
const CALM_FRAME = 1 / 30;
const CALM_AFTER_MS = 3000;
const LONG_PRESS_MS = 550;

const clamp = (x, lo, hi) => Math.max(lo, Math.min(hi, x));
const web = (alpha) => `rgba(${SILK[0]}, ${SILK[1]}, ${SILK[2]}, ${alpha})`;

export class HangingSpidey {
  /**
   * settings: a SettingsStore. onMenu(x, y): open the right-click menu there.
   * onChange(): something worth re-reading changed (up/down, flags), for the panel.
   */
  constructor({ settings, onMenu = () => {}, onChange = () => {} }) {
    this.settings = settings;
    this.onMenu = onMenu;
    this.onChange = onChange;

    this.canvas = document.createElement('canvas');
    this.canvas.className = 'spidey-layer';
    this.canvas.setAttribute('aria-hidden', 'true');
    this.ctx = this.canvas.getContext('2d');
    this.bubbleEl = makeBubble();
    document.body.append(this.canvas, this.bubbleEl);
    this.bubble = new BUBBLE.Bubble(this.bubbleEl);

    this.rig = new Rig();
    this.stage = new Stage(this.rig, (c, armOffset) => SpideyFigure.draw(c, armOffset, web));

    this.layout = null;
    this.up = true;
    this.skeleton = false;
    this.dpr = 1;
    this.animating = false;
    this.lastFrame = 0;
    this.accumulator = 0;
    this.simTime = 0;
    this.quietTime = 0;
    this.lastActive = 0;
    this.dragged = null;
    this.draggingAnchor = false;
    this.dragMoved = false;
    this.dragStart = { x: 0, y: 0 };
    this.dragTarget = { x: 0, y: 0 };
    this.lastHover = { x: 0, y: 0 };
    this.lastHoverTime = -1;
    this.hit = false;
    this.pressTimer = 0;
    this.stats = { frames: 0, time: 0, worst: 0, slow: 0 };
    this.fps = 0;
    this.lookRequest = 0;

    this.clock = new reminders.ReminderClock(
      () => ({ water: this.settings.get('WaterReminder'), lunch: this.settings.get('LunchReminder') }),
      ({ text }) => this.remind(text));

    this.listen();
    this.setup();
    this.clock.start();
  }

  get flags() {
    return { breeze: this.settings.get('Breeze'), autoSwing: this.settings.get('AutoSwing') };
  }

  // ---- Layout: the app's applyLayout(), with the page as the screen ---------------------------

  computeLayout() {
    const width = window.innerWidth;
    const height = window.innerHeight;
    // Phones get a smaller Spidey so he does not cover the page.
    const body = this.settings.bodyLength * clamp(width / 1200, 0.55, 1);
    const hang = body * (1 + REACH_PAST_HEAD);
    let rope = Math.max(60, this.settings.ropeFraction * height);
    rope = Math.min(rope, Math.max(60, height - hang - 30));
    const work = { x: 0, y: 0, width, height };
    let anchorX = clamp(this.settings.get('AnchorFraction'), 0, 1) * width;
    // Keep the web far enough in from the sides that a wide picture hero stays on the page.
    const edge = Math.min(width / 2, Math.max(20, body * 0.8));
    anchorX = clamp(anchorX, edge, width - edge);
    if (this.settings.get('AutoSwing')) {
      anchorX = Rig.roomToSwing(anchorX, rope, body, work);
    }
    return { left: 0, top: 0, width, height, work, anchorX, rope, body };
  }

  /**
   * Hangs him straight, the app's setup message. The app gives him a small swing here; on the site
   * he stays still until the visitor moves him or switches on "Swing on his own".
   */
  setup() {
    this.layout = this.computeLayout();
    this.sizeCanvas();
    const { width, height, anchorX, rope, body } = this.layout;
    this.rig.build(width, height, anchorX, rope, body);
    this.rig.visibleLeft = 0;
    this.rig.visibleRight = width;
    this.stage.resetPose();
    this.wake();
    this.applyHero();
  }

  /** Shows the hero from the settings: the drawing, or a picture hero sized for his body length. */
  async applyHero() {
    const name = this.settings.get('Hero');
    const request = ++this.lookRequest;
    let look = null;
    if (name !== DRAWN) {
      try {
        look = await loadHeroLook(name, this.layout.body, this.dpr);
      } catch (err) {
        console.warn(`${name} did not load, so the drawn Spider-Man is shown.`, err);
      }
    }
    if (request !== this.lookRequest) {
      return; // a newer choice arrived while this one loaded
    }
    this.stage.look = look;
    this.wake();
    this.onChange();
  }

  setHero(name) {
    this.settings.set({ Hero: name });
    this.onChange();
    this.applyHero();
  }

  sizeCanvas() {
    this.dpr = Math.min(2, window.devicePixelRatio || 1);
    this.canvas.width = Math.round(this.layout.width * this.dpr);
    this.canvas.height = Math.round(this.layout.height * this.dpr);
  }

  onResize() {
    if (!this.layout) {
      return;
    }
    const width = window.innerWidth;
    const height = window.innerHeight;
    // Phone address bars change the height while scrolling; only a real change re-hangs him.
    if (width !== this.layout.width || Math.abs(height - this.layout.height) > 140) {
      this.setup();
      return;
    }
    this.layout.height = height;
    this.layout.work.height = height;
    this.rig.height = height;
    this.sizeCanvas();
    this.draw();
  }

  // ---- Commands (the menu, the panel and the terminal call these) -----------------------------

  push(strength = 1) {
    if (!this.up) {
      return;
    }
    this.rig.kick(strength);
    this.wake();
  }

  reset() {
    if (this.up) {
      this.setup();
    }
  }

  /** Breeze or "swing on his own" changed. Starting a swing from still gives him a push. */
  setFlags(changes) {
    const turnedOn = changes.AutoSwing === true;
    this.settings.set(changes);
    if (turnedOn && this.layout) {
      const anchorX = this.rig.anchor.x;
      const roomy = Rig.roomToSwing(anchorX, this.rig.ropeLength, this.layout.body, this.layout.work);
      if (Math.abs(roomy - anchorX) > 0.5) {
        this.moveAnchorTo(roomy);
        this.settings.set({ AnchorFraction: roomy / this.layout.width });
      }
      if (this.rig.motion() < 0.5) {
        this.rig.kick(0.8);
      }
    }
    this.wake();
    this.onChange();
  }

  /** "Take him down (exit)". On the web he can be hung back up. */
  takeDown() {
    this.up = false;
    this.animating = false;
    this.bubble.hide();
    this.clock.stop();
    this.canvas.hidden = true;
    this.setHit(false);
    this.onChange();
  }

  hangUp() {
    this.up = true;
    this.canvas.hidden = false;
    this.clock.start();
    this.setup();
    this.onChange();
  }

  remind(text) {
    if (!this.up) {
      return;
    }
    // The app adds a little swing here to catch the eye; on the site he stays still for it.
    this.bubble.show(text);
    this.placeBubble();
    this.wake();
  }

  restartReminders() {
    if (this.up) {
      this.clock.start();
    }
  }

  setSkeleton(on) {
    this.skeleton = on;
    this.wake();
    this.draw();
  }

  /** The app's "stats" line, then the counters start again. */
  statsLine() {
    const s = this.stats;
    const fps = s.time > 0 ? s.frames / s.time : 0;
    const line = `Frames: ${s.frames} in ${s.time.toFixed(1)} s = ${fps.toFixed(1)} per second, worst gap ${Math.round(s.worst * 1000)} ms, ` +
      `dropped (gap over 25 ms) ${s.slow}, animating ${this.animating}, look ${this.stage.look ? this.stage.look.name : 'drawn'}, pose ${this.stage.currentPose}, ` +
      `rope angle ${(this.rig.ropeAngle * 180 / Math.PI).toFixed(1)}, web at ${Math.round(this.rig.anchor.x)}`;
    this.stats = { frames: 0, time: 0, worst: 0, slow: 0 };
    return line;
  }

  /** Saves his own drawing (never the page behind him) on a dark background, as the app does. */
  snapshot(file) {
    if (!this.layout || !this.up) {
      return false;
    }
    const out = document.createElement('canvas');
    out.width = Math.round(this.layout.width);
    out.height = Math.round(this.layout.height);
    const c = out.getContext('2d');
    c.fillStyle = 'rgb(40, 40, 40)';
    c.fillRect(0, 0, out.width, out.height);
    this.stage.draw(c);
    out.toBlob((blob) => {
      if (!blob) {
        return;
      }
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = file.split(/[\\/]/).pop() || 'spidey.png';
      a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    }, 'image/png');
    return true;
  }

  /** Live numbers for the "under the hood" panel. */
  readout() {
    const rig = this.rig;
    return {
      up: this.up,
      animating: this.animating,
      pose: this.stage.currentPose,
      ropeAngle: rig.particles.length ? rig.ropeAngle * 180 / Math.PI : 0,
      bodyLean: rig.particles.length ? rig.bodyOffRopeEnd() * 180 / Math.PI : 0,
      stretch: rig.particles.length ? rig.ropeStretch : 1,
      fps: this.fps,
      segments: Math.max(0, rig.ropeCount - 1),
    };
  }

  // ---- Animation loop (hang-view.js) ---------------------------------------------------------

  wake() {
    this.quietTime = 0;
    this.lastActive = performance.now();
    if (this.animating || !this.layout || !this.up || document.hidden) {
      return;
    }
    this.animating = true;
    this.lastFrame = 0;
    this.accumulator = 0;
    requestAnimationFrame((t) => this.frame(t));
    this.onChange();
  }

  draw() {
    const ctx = this.ctx;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    if (!this.up) {
      return;
    }
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    this.stage.draw(ctx);
    if (this.skeleton) {
      this.drawSkeleton(ctx);
    }
  }

  /** The physics underneath: rope points, links, the ankle, the head and the body link. */
  drawSkeleton(ctx) {
    const rig = this.rig;
    ctx.save();
    ctx.lineWidth = 1;
    ctx.strokeStyle = 'rgba(232, 179, 58, 0.9)';
    ctx.beginPath();
    for (const { a, b } of rig.links) {
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(b.x, b.y);
    }
    ctx.stroke();
    for (let i = 0; i < rig.particles.length; i++) {
      const p = rig.particles[i];
      const special = p === rig.anchor || p === rig.ankle || p === rig.head;
      ctx.beginPath();
      ctx.arc(p.x, p.y, special ? 5 : 2.5, 0, Math.PI * 2);
      ctx.fillStyle = special ? '#0a84ff' : '#e8b33a';
      ctx.fill();
    }
    ctx.font = '600 11px "JetBrains Mono", monospace';
    ctx.fillStyle = '#0e0e14';
    ctx.strokeStyle = 'rgba(245, 245, 245, 0.9)';
    ctx.lineWidth = 3;
    for (const [p, label] of [[rig.anchor, 'anchor'], [rig.ankle, 'ankle'], [rig.head, 'head']]) {
      ctx.strokeText(label, p.x + 9, p.y + 4);
      ctx.fillText(label, p.x + 9, p.y + 4);
    }
    ctx.restore();
  }

  frame(nowMs) {
    if (!this.animating) {
      return;
    }
    const flags = this.flags;
    const now = nowMs / 1000;
    const calm = (flags.autoSwing || flags.breeze) && !this.dragged && !this.draggingAnchor && !this.bubble.visible &&
      nowMs - this.lastActive > CALM_AFTER_MS;
    const interval = calm ? CALM_FRAME : FULL_FRAME;
    if (this.lastFrame > 0 && now - this.lastFrame < interval - 0.004) {
      requestAnimationFrame((t) => this.frame(t));
      return;
    }
    let frameDt = this.lastFrame > 0 ? Math.min(0.05, now - this.lastFrame) : 1 / 60;
    if (frameDt <= 0) {
      frameDt = 1 / 60;
    }
    this.lastFrame = now;
    this.recordFrame(frameDt);

    this.accumulator += frameDt;
    while (this.accumulator >= STEP) {
      this.rig.simulate(this.simTime, flags.breeze, flags.autoSwing, this.dragged, this.dragTarget);
      this.accumulator -= STEP;
      this.simTime += STEP;
    }
    this.stage.blend = this.accumulator / STEP;
    this.stage.dragging = this.dragged !== null;
    this.stage.advance(frameDt);
    this.draw();
    this.placeBubble();

    const still = !flags.breeze && !flags.autoSwing && !this.dragged && !this.draggingAnchor &&
      this.rig.motion() < 0.02 && this.stage.settled;
    this.quietTime = still ? this.quietTime + frameDt : 0;
    if (this.quietTime > 0.5) {
      this.rig.freeze();
      this.stage.blend = 1;
      this.draw();
      this.animating = false;
      this.fps = 0;
      this.onChange();
      return;
    }
    requestAnimationFrame((t) => this.frame(t));
  }

  recordFrame(frameDt) {
    const s = this.stats;
    s.frames++;
    s.time += frameDt;
    s.worst = Math.max(s.worst, frameDt);
    if (frameDt > 0.025) {
      s.slow++;
    }
    this.fps += (1 / frameDt - this.fps) * 0.1;
  }

  // ---- Reminder bubble -------------------------------------------------------------------------

  placeBubble() {
    if (!this.bubble.visible || !this.layout) {
      return;
    }
    const rig = this.rig;
    const face = this.stage.facePoint() || { x: rig.head.x, y: rig.head.y, r: this.layout.body * 0.12 };
    const lo = 0;
    const hi = this.layout.width;
    const side = rig.anchor.x - lo >= hi - rig.anchor.x ? 'left' : 'right';
    const room = BUBBLE.MAX_WIDTH + 14;
    const reach = face.r * 0.75;
    const x = side === 'left' ? Math.max(lo + room, face.x - reach) : Math.min(hi - room, face.x + reach);
    const tall = this.bubble.height || 60;
    const y = Math.max(tall + 6, Math.min(this.layout.height - 4, face.y - face.r * 0.85));
    this.bubble.place(x, y, side);
  }

  // ---- Pointer -------------------------------------------------------------------------------

  alphaAt(x, y) {
    const px = Math.round(x * this.dpr);
    const py = Math.round(y * this.dpr);
    if (px < 0 || py < 0 || px >= this.canvas.width || py >= this.canvas.height) {
      return 0;
    }
    return this.ctx.getImageData(px, py, 1, 1).data[3];
  }

  over(pt) {
    return this.up && this.layout !== null && this.stage.hitTest(pt, (x, y) => this.alphaAt(x, y));
  }

  setHit(hit) {
    this.hit = hit;
    this.canvas.classList.toggle('is-hit', hit);
    this.canvas.classList.toggle('is-grabbing', this.dragged !== null || this.draggingAnchor);
  }

  /** Lets the pointer through everywhere except over what is drawn (or while dragging). */
  updateHit(pt) {
    this.setHit(this.dragged !== null || this.draggingAnchor || this.over(pt));
  }

  listen() {
    const local = (e) => ({ x: e.clientX, y: e.clientY });

    window.addEventListener('resize', () => this.onResize());
    document.addEventListener('visibilitychange', () => {
      if (!document.hidden) {
        this.wake();
      }
    });

    // Touch has no hover, so the layer cannot switch itself on before a finger lands. Claim the
    // touch here when it starts on him, and stop the page from scrolling under the drag.
    window.addEventListener('touchstart', (e) => {
      const t = e.touches[0];
      if (t && e.touches.length === 1 && this.over({ x: t.clientX, y: t.clientY })) {
        e.preventDefault();
      }
    }, { passive: false });

    window.addEventListener('pointerdown', (e) => {
      if (e.button !== 0 || !this.up || !this.layout) {
        return;
      }
      const pt = local(e);
      if (this.rig.nearAnchor(pt)) {
        this.draggingAnchor = true;
      } else if (this.over(pt)) {
        this.dragged = this.rig.pick(pt);
        if (!this.dragged) {
          return;
        }
        this.dragStart = pt;
        this.dragTarget = pt;
        this.dragMoved = false;
      } else {
        return;
      }
      e.preventDefault();
      try {
        this.canvas.setPointerCapture(e.pointerId);
      } catch {
        // The pointer already ended.
      }
      if (e.pointerType !== 'mouse') {
        clearTimeout(this.pressTimer);
        this.pressTimer = setTimeout(() => {
          if (!this.dragMoved) {
            this.endDrag();
            this.onMenu(pt.x, pt.y);
          }
        }, LONG_PRESS_MS);
      }
      this.updateHit(pt);
      this.wake();
    }, true);

    window.addEventListener('pointermove', (e) => {
      if (!this.layout || !this.up) {
        return;
      }
      const pt = local(e);
      if (this.draggingAnchor) {
        this.moveAnchorTo(pt.x);
        return;
      }
      if (this.dragged) {
        this.dragTarget = pt;
        if (Math.hypot(pt.x - this.dragStart.x, pt.y - this.dragStart.y) > 4) {
          this.dragMoved = true;
          clearTimeout(this.pressTimer);
        }
        return;
      }
      if (e.pointerType === 'mouse') {
        this.brushPast(pt);
        this.updateHit(pt);
      }
    }, { passive: true });

    const release = (e) => {
      clearTimeout(this.pressTimer);
      if (!this.dragged && !this.draggingAnchor) {
        return;
      }
      // A plain click on him (no drag) gives a nudge away from the click.
      if (this.dragged && !this.dragMoved && e.type === 'pointerup') {
        const pt = local(e);
        this.rig.kick(0.9, pt.x < (this.rig.ankle.x + this.rig.head.x) / 2 ? 1 : -1);
      }
      try {
        this.canvas.releasePointerCapture(e.pointerId);
      } catch {
        // Not captured.
      }
      this.endDrag();
      this.updateHit(local(e));
      this.wake();
    };
    window.addEventListener('pointerup', release);
    window.addEventListener('pointercancel', release);

    window.addEventListener('contextmenu', (e) => {
      const pt = local(e);
      if (this.over(pt) || (this.bubble.visible && this.bubble.contains(pt))) {
        e.preventDefault();
        this.onMenu(pt.x, pt.y);
      }
    });

    this.bubbleEl.addEventListener('click', () => this.bubble.hide());
  }

  endDrag() {
    if (this.draggingAnchor) {
      let dropped = this.rig.anchor.x;
      // Dropped too close to an edge while swinging on his own: slide back in so he can keep swinging.
      if (this.flags.autoSwing) {
        const roomy = Rig.roomToSwing(dropped, this.rig.ropeLength, this.layout.body, this.layout.work);
        if (Math.abs(roomy - dropped) > 0.5) {
          this.moveAnchorTo(roomy);
          dropped = roomy;
        }
      }
      this.settings.set({ AnchorFraction: dropped / this.layout.width });
    }
    this.dragged = null;
    this.draggingAnchor = false;
    this.canvas.classList.remove('is-grabbing');
  }

  /** Moving the cursor across him without clicking pushes him, like brushing past a real charm. */
  brushPast(pt) {
    const now = performance.now() / 1000;
    if (this.lastHoverTime >= 0 && now - this.lastHoverTime < 0.1) {
      const dt = Math.max(0.004, now - this.lastHoverTime);
      const speedX = clamp((pt.x - this.lastHover.x) / dt, -1500, 1500);
      const part = this.rig.pickBody(pt);
      if (part && Math.abs(speedX) > 60) {
        Rig.nudge(part, speedX * 0.15);
        this.wake();
      }
    }
    this.lastHover = pt;
    this.lastHoverTime = now;
  }

  /** Moves the web knot along the top of the page. He follows on his rope. */
  moveAnchorTo(x) {
    this.rig.moveAnchor(clamp(x, 20, this.layout.width - 20));
    this.wake();
  }
}
