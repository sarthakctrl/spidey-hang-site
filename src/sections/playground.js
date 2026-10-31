/*
 * The playground's flat copy of the menu, the feature panels' "try it" buttons, and the
 * under-the-hood skeleton and meters. Returns a refresh function that re-reads the settings.
 */
export function initPlayground({ settings, spidey, menu, actions }) {
  for (const btn of document.querySelectorAll('[data-act]')) {
    btn.addEventListener('click', () => {
      switch (btn.dataset.act) {
        case 'swing':
          actions.swing();
          break;
        case 'push':
          actions.swing(Number(btn.dataset.strength) || 1);
          break;
        case 'reset':
          actions.reset();
          break;
        case 'menu': {
          const r = btn.getBoundingClientRect();
          menu.open(r.left, r.bottom + 6, btn);
          break;
        }
        default:
          break;
      }
    });
  }

  for (const btn of document.querySelectorAll('[data-pos]')) {
    btn.addEventListener('click', () => actions.relayout({ AnchorFraction: Number(btn.dataset.pos) }));
  }

  const radios = {
    pos: (v) => actions.relayout({ AnchorFraction: Number(v) }),
    size: (v) => actions.relayout({ Size: v }),
    rope: (v) => actions.relayout({ Rope: v }),
  };
  for (const [name, apply] of Object.entries(radios)) {
    for (const input of document.querySelectorAll(`input[name="${name}"]`)) {
      input.addEventListener('change', () => input.checked && apply(input.value));
    }
  }

  for (const input of document.querySelectorAll('[data-flag]')) {
    input.addEventListener('change', () => actions.setFlags({ [input.dataset.flag]: input.checked }));
  }

  const skeleton = document.querySelector('[data-skeleton]');
  skeleton?.addEventListener('change', () => {
    spidey.setSkeleton(skeleton.checked);
    if (skeleton.checked) {
      actions.swing(1.2);
    }
  });

  // Meters: updated a few times a second, only while someone can see them.
  const meters = Object.fromEntries([...document.querySelectorAll('[data-meter]')].map((el) => [el.dataset.meter, el]));
  const drawingLabels = document.querySelectorAll('[data-live="drawing"]');
  const updateMeters = () => {
    const r = spidey.readout();
    const drawing = !r.up ? 'taken down' : r.animating ? 'yes' : 'asleep (no CPU)';
    if (meters.ropeAngle) {
      meters.ropeAngle.textContent = `${r.ropeAngle.toFixed(1)}°`;
      meters.bodyLean.textContent = `${r.bodyLean.toFixed(1)}°`;
      meters.stretch.textContent = r.stretch.toFixed(3);
      meters.fps.textContent = r.animating ? Math.round(r.fps) : '0';
      meters.pose.textContent = r.pose;
      meters.drawing.textContent = drawing;
    }
    for (const el of drawingLabels) {
      el.textContent = drawing;
    }
  };
  let timer = 0;
  const watched = document.querySelectorAll('#hood, #features');
  const visible = new Set();
  const io = new IntersectionObserver((entries) => {
    for (const e of entries) {
      if (e.isIntersecting) {
        visible.add(e.target);
      } else {
        visible.delete(e.target);
      }
    }
    clearInterval(timer);
    if (visible.size) {
      timer = setInterval(updateMeters, 150);
      updateMeters();
    }
  });
  watched.forEach((el) => io.observe(el));

  return () => {
    const v = settings.values;
    for (const input of document.querySelectorAll('input[name="pos"]')) {
      input.checked = Math.abs(Number(input.value) - v.AnchorFraction) < 0.005;
    }
    for (const input of document.querySelectorAll('input[name="size"]')) {
      input.checked = input.value === v.Size;
    }
    for (const input of document.querySelectorAll('input[name="rope"]')) {
      input.checked = input.value === v.Rope;
    }
    for (const input of document.querySelectorAll('[data-flag]')) {
      input.checked = Boolean(v[input.dataset.flag]);
    }
    updateMeters();
  };
}
