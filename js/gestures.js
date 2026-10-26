// js/gestures.js
// The gesture wheel (step 5.4): T opens six ready-made phrases around the screen centre, a click or 1-6 sends one to
// the players nearby (js/multiplayer-net.js), T or Esc closes it. While it is open the digits pick a phrase instead of
// switching modes. Playing with others has no free chat: these phrases are all there is to say.
import { GESTURES } from './multiplayer-net.js';
import { isTypingInField } from './city-config.js';

const RADIUS = 132; // px from the centre

export class GestureWheel {
  // client: MultiplayerClient; blocked(): true while the full map or the photo mode is open
  constructor(client, { blocked = () => false } = {}) {
    this.client = client;
    this.blocked = blocked;
    this.open = false;
    this.el = document.createElement('div');
    this.el.id = 'gesture-wheel';
    this.el.className = 'hidden';
    this.el.setAttribute('role', 'menu');
    this.el.setAttribute('aria-label', 'Gesty i zwroty');
    document.body.appendChild(this.el);
    this.el.addEventListener('click', (e) => {
      const b = e.target.closest('button[data-g]');
      if (b) this.pick(b.dataset.g);
    });
    // Capture phase: runs before the game's own key handlers, so 1-6 pick a phrase while the wheel is open
    window.addEventListener('keydown', (e) => this.onKey(e), true);
  }

  onKey(e) {
    if (isTypingInField(e) || e.metaKey || e.ctrlKey || e.altKey) return;
    if (e.code === 'KeyT' && !e.repeat) {
      if (this.open) this.toggle(false);
      else if (!this.blocked() && !this.client.solo) this.toggle(true);
      return;
    }
    if (!this.open) return;
    const digit = /^Digit([1-6])$/.exec(e.code) || /^Numpad([1-6])$/.exec(e.code);
    if (digit) {
      e.preventDefault();
      e.stopImmediatePropagation();
      this.pick(GESTURES[Number(digit[1]) - 1].id);
    } else if (e.code === 'Escape') {
      e.stopImmediatePropagation();
      this.toggle(false);
    }
  }

  toggle(open) {
    this.open = open;
    this.el.classList.toggle('hidden', !open);
    if (!open) return;
    const online = this.client.status === 'online';
    const ready = this.client.gestureReady();
    const hint = !online ? 'Gra z innymi nie jest połączona (telefon → Gracze).'
      : ready ? 'Kliknij albo 1–6 · T zamyka' : 'Chwilę… (jeden zwrot na 2 s)';
    this.el.innerHTML = (online ? GESTURES.map((g, i) => {
      const a = (i / GESTURES.length) * Math.PI * 2 - Math.PI / 2;
      return `<button type="button" role="menuitem" data-g="${g.id}" style="left:${Math.round(Math.cos(a) * RADIUS)}px;top:${Math.round(Math.sin(a) * RADIUS * 0.72)}px"${ready ? '' : ' disabled'}><kbd>${i + 1}</kbd>${g.icon} ${g.text}</button>`;
    }).join('') : '') + `<div class="gw-hint" style="left:0;top:${online ? Math.round(RADIUS * 0.72) + 44 : 0}px">${hint}</div>`;
  }

  pick(id) {
    this.client.gesture(id);
    this.toggle(false);
  }
}
