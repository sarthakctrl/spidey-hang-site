/*
 * The hero gallery: tapping a card hangs that hero from the web at the top of the page, the same as
 * his Hero menu. The drawn Spider-Man's card is drawn with the app's own figure code.
 */
import { SpideyFigure, STAGE } from '../../vendor/spidey/index.js';

const { SILK } = STAGE;

function drawPreview(canvas) {
  const ctx = canvas.getContext('2d');
  const web = (alpha) => `rgba(${SILK[0]}, ${SILK[1]}, ${SILK[2]}, ${alpha})`;
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  // His web, then him hanging upside down from it, as on the page.
  ctx.strokeStyle = 'rgba(94, 103, 114, 0.9)';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(canvas.width / 2, 0);
  ctx.lineTo(canvas.width / 2, 70);
  ctx.stroke();
  ctx.save();
  ctx.translate(canvas.width / 2, 70);
  ctx.rotate(Math.PI);
  ctx.scale(2.5, 2.5);
  SpideyFigure.draw(ctx, 0.15, web);
  ctx.restore();
}

export function initHeroes({ settings, actions }) {
  const cards = [...document.querySelectorAll('[data-hero]')];
  for (const card of cards) {
    card.addEventListener('click', () => actions.setHero(card.dataset.hero));
  }
  const preview = document.querySelector('[data-drawn-preview]');
  if (preview) {
    drawPreview(preview);
  }
  return () => {
    const current = settings.get('Hero');
    for (const card of cards) {
      card.setAttribute('aria-pressed', String(card.dataset.hero === current));
    }
  };
}
