// js/photo-mode.js
// The camera app: photo mode freezes the player, hides the interface and frees the camera (W/S/A/D or the arrows to
// move, Q/E down and up, drag to look, the wheel to zoom), with five autumn filters (F) previewed live on the canvas.
// Space (or the shutter) takes the picture: the rendered frame, filtered and with a small caption, as a JPEG for the
// postcards album (js/postcards.js). Esc leaves.

import * as THREE from 'three/webgpu';
import { groundY } from './terrain.js';

const FILTERS = [
  { name: 'Naturalny', css: 'none' },
  { name: 'Złota jesień', css: 'sepia(0.25) saturate(1.35) contrast(1.05) brightness(1.04) hue-rotate(-8deg)' },
  { name: 'Mgła poranna', css: 'contrast(0.82) brightness(1.1) saturate(0.85)' },
  { name: 'Retro', css: 'sepia(0.6) contrast(1.1) saturate(0.9)' },
  { name: 'Czarno-białe', css: 'grayscale(1) contrast(1.15)' },
];
const SPEED = 12; // m/s
const MAX_W = 1600; // px of the saved photo

class PhotoMode {
  /**
   * { canvas, camera (THREE.PerspectiveCamera), onShot(blob, meta), place: () => 'street name' }
   */
  constructor({ canvas, camera, onShot, place }) {
    this.canvas = canvas;
    this.camera = camera;
    this.onShot = onShot;
    this.place = place || (() => '');
    this.active = false;
    this.filter = 1;
    this.keys = new Set();
    this.yaw = 0;
    this.pitch = 0;
    this.fov = 50;
    this.pending = null; // a shot to take after the next render
    this.ui = document.createElement('div');
    this.ui.className = 'photo-ui hidden';
    this.ui.innerHTML = `<div class="photo-frame"></div>
      <div class="panel photo-bar"><span class="photo-filter"></span>
        <button type="button" class="photo-shutter" aria-label="Zrób zdjęcie"></button>
        <span class="photo-help">Spacja: zdjęcie · F: filtr · WASD/QE, przeciągnij: kamera · kółko: zoom · Esc: wyjście</span></div>
      <div class="photo-flash"></div>`;
    document.body.appendChild(this.ui);
    this.ui.querySelector('.photo-shutter').addEventListener('click', () => this.shoot());

    window.addEventListener('keydown', (e) => {
      if (!this.active) return;
      if (e.code === 'Escape') { this.exit(); e.stopImmediatePropagation(); return; }
      if (e.code === 'Space') { this.shoot(); e.preventDefault(); return; }
      if (e.code === 'KeyF' && !e.repeat) { this.filter = (this.filter + 1) % FILTERS.length; this.applyFilter(); return; }
      this.keys.add(e.code);
    }, true);
    window.addEventListener('keyup', (e) => this.keys.delete(e.code), true);
    let drag = null;
    canvas.addEventListener('pointerdown', (e) => { if (this.active) drag = { x: e.clientX, y: e.clientY }; });
    window.addEventListener('pointerup', () => { drag = null; });
    window.addEventListener('pointermove', (e) => {
      if (!this.active || !drag) return;
      this.yaw -= (e.clientX - drag.x) * 0.004;
      this.pitch = Math.max(-1.3, Math.min(1.3, this.pitch - (e.clientY - drag.y) * 0.004));
      drag = { x: e.clientX, y: e.clientY };
    });
    canvas.addEventListener('wheel', (e) => {
      if (!this.active) return;
      e.preventDefault();
      this.fov = Math.max(15, Math.min(80, this.fov + Math.sign(e.deltaY) * 3));
    }, { passive: false });
  }

  applyFilter() {
    this.canvas.style.filter = this.active ? FILTERS[this.filter].css : '';
    this.ui.querySelector('.photo-filter').textContent = `Filtr: ${FILTERS[this.filter].name}`;
  }

  enter() {
    if (this.active) return;
    this.active = true;
    const d = new THREE.Vector3();
    this.camera.getWorldDirection(d);
    this.yaw = Math.atan2(d.x, d.z);
    this.pitch = Math.asin(Math.max(-1, Math.min(1, d.y)));
    this.fov = this.camera.fov;
    this.savedFov = this.camera.fov;
    this.keys.clear();
    document.body.classList.add('photo-mode');
    this.ui.classList.remove('hidden');
    this.applyFilter();
  }

  exit() {
    if (!this.active) return;
    this.active = false;
    this.keys.clear();
    document.body.classList.remove('photo-mode');
    this.ui.classList.add('hidden');
    this.canvas.style.filter = '';
    this.camera.fov = this.savedFov;
    this.camera.updateProjectionMatrix();
  }

  // the free camera, after the game's camera update
  update(dt) {
    if (!this.active) return;
    const k = this.keys, c = this.camera;
    const fx = Math.sin(this.yaw), fz = Math.cos(this.yaw);
    let mx = 0, mz = 0, my = 0;
    if (k.has('KeyW') || k.has('ArrowUp')) { mx += fx; mz += fz; }
    if (k.has('KeyS') || k.has('ArrowDown')) { mx -= fx; mz -= fz; }
    if (k.has('KeyA') || k.has('ArrowLeft')) { mx += fz; mz -= fx; }
    if (k.has('KeyD') || k.has('ArrowRight')) { mx -= fz; mz += fx; }
    if (k.has('KeyE')) my += 1;
    if (k.has('KeyQ')) my -= 1;
    const sp = SPEED * (k.has('ShiftLeft') || k.has('ShiftRight') ? 3 : 1) * dt;
    c.position.x += mx * sp;
    c.position.z += mz * sp;
    c.position.y = Math.max(groundY(c.position.x, c.position.z) + 0.6, c.position.y + my * sp);
    const t = new THREE.Vector3(c.position.x + Math.sin(this.yaw) * Math.cos(this.pitch), c.position.y + Math.sin(this.pitch), c.position.z + Math.cos(this.yaw) * Math.cos(this.pitch));
    c.lookAt(t);
    if (c.fov !== this.fov) { c.fov = this.fov; c.updateProjectionMatrix(); }
  }

  shoot() {
    if (!this.active || this.pending) return;
    this.pending = true; // taken right after the next frame is rendered (afterRender)
    const flash = this.ui.querySelector('.photo-flash');
    flash.classList.remove('go');
    void flash.offsetWidth;
    flash.classList.add('go');
  }

  // Called by the game loop right after rendering: the canvas holds the frame now
  afterRender() {
    if (!this.pending) return;
    this.pending = null;
    const src = this.canvas;
    const scale = Math.min(1, MAX_W / src.width);
    const out = document.createElement('canvas');
    out.width = Math.round(src.width * scale);
    out.height = Math.round(src.height * scale);
    const g = out.getContext('2d');
    g.filter = FILTERS[this.filter].css;
    g.drawImage(src, 0, 0, out.width, out.height);
    g.filter = 'none';
    // caption: the place and "Szczęśliwe Bielany"
    const place = this.place();
    const h = Math.round(out.height * 0.045);
    g.font = `600 ${h}px "Inter", Arial, sans-serif`;
    g.textBaseline = 'bottom';
    g.fillStyle = 'rgba(0,0,0,0.35)';
    g.fillText(`${place} · Szczęśliwe Bielany`, h * 0.62, out.height - h * 0.48);
    g.fillStyle = '#ffffff';
    g.fillText(`${place} · Szczęśliwe Bielany`, h * 0.6, out.height - h * 0.5);
    out.toBlob((blob) => {
      if (blob && this.onShot) this.onShot(blob, { place, filter: FILTERS[this.filter].name, at: new Date().toISOString() });
    }, 'image/jpeg', 0.86);
  }
}

export { PhotoMode, FILTERS };
