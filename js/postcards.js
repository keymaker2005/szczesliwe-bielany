// js/postcards.js
// The postcards album: photos from the camera app (js/photo-mode.js) kept in this browser (IndexedDB; in memory when
// that is unavailable), newest first, with a small thumbnail for the phone's grid. A photo can be saved as a file,
// shared (the device's share sheet with the picture where the browser supports it, else a post on X with a caption,
// the picture saved alongside to attach) or deleted.

const DB = 'bielany-postcards', STORE = 'photos', LIMIT = 60;
const SHARE_TEXT = 'Jesień na Bielanach w grze Szczęśliwe Bielany';
const SITE = 'https://bielany.zbigniew.ai';

function openDb() {
  return new Promise((resolve) => {
    try {
      const req = indexedDB.open(DB, 1);
      req.onupgradeneeded = () => req.result.createObjectStore(STORE, { keyPath: 'id' });
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => resolve(null);
    } catch { resolve(null); }
  });
}

async function thumbOf(blob) {
  const img = await createImageBitmap(blob);
  const c = document.createElement('canvas');
  c.width = 240;
  c.height = Math.round((240 * img.height) / img.width);
  c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
  return c.toDataURL('image/jpeg', 0.7);
}

class Postcards {
  constructor() {
    this.items = []; // { id, at, place, filter, thumb, blob }
    this.ready = this.load();
    this.listeners = [];
  }

  async load() {
    this.db = await openDb();
    if (!this.db) return;
    await new Promise((resolve) => {
      const tx = this.db.transaction(STORE, 'readonly');
      const req = tx.objectStore(STORE).getAll();
      req.onsuccess = () => { this.items = (req.result || []).sort((a, b) => (a.at < b.at ? 1 : -1)); resolve(); };
      req.onerror = () => resolve();
    });
  }

  onChange(fn) { this.listeners.push(fn); }
  changed() { for (const fn of this.listeners) fn(); }

  async add(blob, meta) {
    const item = { id: `p${Date.now()}`, ...meta, thumb: await thumbOf(blob), blob };
    this.items.unshift(item);
    const extra = this.items.splice(LIMIT);
    if (this.db) {
      const tx = this.db.transaction(STORE, 'readwrite');
      tx.objectStore(STORE).put(item);
      for (const old of extra) tx.objectStore(STORE).delete(old.id);
    }
    this.changed();
    return item;
  }

  remove(id) {
    this.items = this.items.filter((p) => p.id !== id);
    if (this.db) this.db.transaction(STORE, 'readwrite').objectStore(STORE).delete(id);
    this.changed();
  }

  get(id) { return this.items.find((p) => p.id === id) || null; }

  fileName(p) { return `bielany-${(p.place || 'pocztowka').toLowerCase().replace(/[^a-z0-9ąćęłńóśźż]+/gi, '-')}-${p.at.slice(0, 10)}.jpg`; }

  save(id) {
    const p = this.get(id);
    if (!p) return;
    const url = URL.createObjectURL(p.blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = this.fileName(p);
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 10000);
  }

  async share(id) {
    const p = this.get(id);
    if (!p) return;
    const text = `${SHARE_TEXT}: ${p.place}`;
    const file = new File([p.blob], this.fileName(p), { type: 'image/jpeg' });
    if (navigator.canShare?.({ files: [file] })) {
      try { await navigator.share({ files: [file], text, url: SITE }); return; } catch { /* cancelled: fall back */ }
    }
    // X cannot take the picture through a link: save it for attaching, and open the post with the caption
    this.save(id);
    window.open(`https://x.com/intent/post?text=${encodeURIComponent(text)}&url=${encodeURIComponent(SITE)}`, '_blank', 'noopener');
  }
}

export { Postcards };
