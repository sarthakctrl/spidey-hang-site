/** The reminder bubble's markup, as in the app's overlay.html. Styles come from vendor/spidey/bubble.css. */
export function makeBubble(extraClass = '') {
  const el = document.createElement('div');
  el.className = `bubble ${extraClass}`.trim();
  el.hidden = true;
  el.setAttribute('role', 'status');
  el.innerHTML = '<div class="bubble-pop"><div class="bubble-body"><span class="bubble-dots"><i></i><i></i><i></i></span>' +
    '<span class="bubble-text"></span><span class="bubble-caret"></span>' +
    '<svg class="bubble-tail" width="16" height="20" viewBox="0 0 16 20" aria-hidden="true"><path d="M0 0 C1 9 5 15 16 20 C8 20 3 18 0 15 Z"/></svg></div></div>';
  return el;
}
