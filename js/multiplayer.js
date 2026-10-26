// js/multiplayer.js
// Playing with others, the drawing side (step 5.2): the other players in their colours, with names over their heads.
// Network and smoothing live in js/multiplayer-net.js. Built from the models the traffic already uses, so no new
// shaders compile mid-game: instanced sedans in the player's paint (same material as the traffic), skinned people
// (pedestrians.js, read only), a light bicycle and the sightseeing helicopter. At most MAX_DRAWN players (the nearest)
// are drawn; the others are ghosts: you drive through them (decision 5 of docs/plan-fazy-5.md).
import * as THREE from 'three/webgpu';
import {
  BODY_SPECS, buildCarGeometry, buildCarProxyGeometry, buildSteerableWheelGeo, createLoftedCarMaterial,
  buildHelicopterBodyGeometry, buildHelicopterMainRotorGeometry, buildHelicopterTailRotorGeometry, createLoftedHelicopterMaterial
} from './actor-models.js';
import { PersonCrowd, PersonRig } from './pedestrians.js';
import { GESTURES, GESTURE_SHOW_MS } from './multiplayer-net.js';

const MAX_DRAWN = 20;
const DRAW_DISTANCE = 1200; // metres; farther players are only on the map
const CAR_PROXY_DISTANCE = 140; // the low-poly car beyond this
const NAME_DISTANCE = 150;
const SPEC = BODY_SPECS.sedan;
const BIKE = { // same frame as the player's bicycle (controllers.js), so the rider's pose fits
  seat: new THREE.Vector3(0, 0.98, -0.28), bars: new THREE.Vector3(0, 0.98, 0.4), gripHalf: 0.22,
  bracket: new THREE.Vector3(0, 0.34, -0.145), crankLength: 0.17
};

const _m = new THREE.Matrix4();
const _w = new THREE.Matrix4();
const _q = new THREE.Quaternion();
const _qs = new THREE.Quaternion();
const _p = new THREE.Vector3();
const _s = new THREE.Vector3(1, 1, 1);
const _v = new THREE.Vector3();
const _c = new THREE.Color();
const UP = new THREE.Vector3(0, 1, 0);
const AX = new THREE.Vector3(1, 0, 0);

// One invisible (zero-size) instance until the first update, so the pipelines compile in the game's warm-up frame
function warmUp(mesh) {
  mesh.setMatrixAt(0, new THREE.Matrix4().makeScale(0, 0, 0));
  mesh.count = 1;
}

const remoteGround = (owner) => owner.y;
const gestureText = (g) => { const x = GESTURES.find((e) => e.id === g); return x ? `${x.icon} ${x.text}` : ''; }; // the sender's own height: it already sits on the street, bridge or kerb

export class RemotePlayers {
  constructor(scene, { overlay = null } = {}) {
    this.scene = scene;
    this.overlay = overlay;
    this.views = new Map(); // id -> per-player drawing state
    this.time = 0;

    // Cars: full model near, proxy far; wheels instanced like the traffic's
    const carMat = createLoftedCarMaterial(SPEC); // the traffic's material: per-instance paint, already compiled
    const instanced = (geo) => {
      geo.setAttribute('paintColor', new THREE.InstancedBufferAttribute(new Float32Array(MAX_DRAWN * 3), 3));
      geo.setAttribute('carState', new THREE.InstancedBufferAttribute(new Float32Array(MAX_DRAWN * 4), 4));
      const mesh = new THREE.InstancedMesh(geo, carMat, MAX_DRAWN);
      warmUp(mesh);
      mesh.frustumCulled = false;
      mesh.castShadow = mesh.receiveShadow = true;
      mesh.name = 'RemoteCars';
      scene.add(mesh);
      return mesh;
    };
    this.carNear = instanced(buildCarGeometry(SPEC, false));
    this.carFar = instanced(buildCarProxyGeometry(SPEC));
    const wheelMat = createLoftedCarMaterial(SPEC, 0xffbe14); // the traffic's wheel material
    this.wheels = [-1, 1].map((side) => {
      const mesh = new THREE.InstancedMesh(buildSteerableWheelGeo(SPEC, side), wheelMat, MAX_DRAWN * 2);
      warmUp(mesh);
      mesh.frustumCulled = false;
      mesh.castShadow = true;
      scene.add(mesh);
      return mesh;
    });

    // People on foot and on bikes share one skinned crowd
    this.crowd = new PersonCrowd(MAX_DRAWN);
    this.crowd.meshes.forEach((m) => { m.frustumCulled = false; scene.add(m); });

    // Bicycle parts, shared by every remote bike; the frame and helmet take the player's colour
    this.bikeGeo = {
      wheel: new THREE.TorusGeometry(0.35, 0.038, 10, 20).rotateY(Math.PI * 0.5),
      tube: new THREE.CylinderGeometry(0.024, 0.024, 1, 8),
      helmet: new THREE.SphereGeometry(0.125, 12, 10),
    };
    this.tireMat = new THREE.MeshStandardNodeMaterial({ color: 0x181a1e, roughness: 0.6 });
    this.paints = new Map(); // css colour -> material

    // Helicopters, made when the first one is needed
    this.heliMat = null;
    this.heliGeo = null;

    this.names = overlay ? new Map() : null; // id -> label element
  }

  paint(css) {
    if (!this.paints.has(css)) this.paints.set(css, new THREE.MeshStandardNodeMaterial({ color: new THREE.Color(css), roughness: 0.35, metalness: 0.3 }));
    return this.paints.get(css);
  }

  makeBike(css) {
    const root = new THREE.Group();
    const lean = new THREE.Group();
    root.add(lean);
    const g = this.bikeGeo;
    const frame = this.paint(css);
    const wheels = [0.58, -0.58].map((z) => {
      const w = new THREE.Mesh(g.wheel, this.tireMat);
      w.position.set(0, 0.38, z);
      lean.add(w);
      return w;
    });
    for (const [len, rx, y, z] of [[0.72, Math.PI * 0.46, 0.78, 0.04], [0.78, Math.PI * 0.28, 0.58, 0.16], [0.64, -0.22, 0.66, -0.22], [0.68, -0.24, 0.68, 0.48]]) {
      const t = new THREE.Mesh(g.tube, frame);
      t.scale.set(1, len, 1);
      t.rotation.x = rx;
      t.position.set(0, y, z);
      lean.add(t);
    }
    const bar = new THREE.Mesh(g.tube, this.tireMat);
    bar.scale.set(0.8, 0.48, 0.8);
    bar.rotation.z = Math.PI * 0.5;
    bar.position.set(0, 0.98, 0.4);
    lean.add(bar);
    const helmet = new THREE.Mesh(g.helmet, frame);
    helmet.scale.set(0.95, 0.68, 1.28);
    root.traverse((o) => { if (o.isMesh) o.castShadow = true; });
    this.scene.add(root, helmet);
    return { root, lean, wheels, helmet, crank: 0 };
  }

  makeHeli() {
    if (!this.heliMat) {
      this.heliMat = createLoftedHelicopterMaterial();
      this.heliGeo = { body: buildHelicopterBodyGeometry(), main: buildHelicopterMainRotorGeometry(), tail: buildHelicopterTailRotorGeometry() };
    }
    const root = new THREE.Group();
    const tilt = new THREE.Group();
    root.add(tilt);
    const body = new THREE.Mesh(this.heliGeo.body, this.heliMat);
    body.castShadow = true;
    tilt.add(body);
    const main = new THREE.Group();
    main.position.set(0, 2.66, -0.35);
    main.add(new THREE.Mesh(this.heliGeo.main, this.heliMat));
    tilt.add(main);
    const tail = new THREE.Group();
    tail.position.set(0.18, 2.02, -5.62);
    tail.add(new THREE.Mesh(this.heliGeo.tail, this.heliMat));
    tilt.add(tail);
    this.scene.add(root);
    return { root, tilt, main, tail };
  }

  view(player) {
    let v = this.views.get(player.id);
    if (!v) {
      v = { id: player.id, pose: { x: 0, y: 0, z: 0, h: 0, m: 'person', v: 0 }, rig: null, rigPlaced: false, bike: null, heli: null, wheelSpin: 0, lastH: 0, lean: 0,
        audio: { type: 'car', position: { x: 0, y: 0, z: 0 }, heading: 0 } }; // the horn's sound source (audio-system.js honk)
      this.views.set(player.id, v);
    }
    return v;
  }

  // Players gone from the room lose their meshes and labels
  prune(players) {
    for (const [id, v] of this.views) {
      if (players.has(id)) continue;
      if (v.bike) this.scene.remove(v.bike.root, v.bike.helmet);
      if (v.heli) this.scene.remove(v.heli.root);
      this.views.delete(id);
    }
    if (this.names) {
      for (const [id, el] of this.names) if (!players.has(id)) { el.remove(); this.names.delete(id); }
    }
  }

  // client: MultiplayerClient; camera: the game camera; now: performance.now(); self: my { x, y, z, m } (my gesture's
  // bubble). Call only after the warm-up frame.
  update(dt, client, camera, now, self = null) {
    this.time += dt;
    const players = client.players;
    this.prune(players);
    const cam = camera.position;

    // Who to draw: the nearest MAX_DRAWN within DRAW_DISTANCE
    const list = [];
    for (const p of players.values()) {
      const v = this.view(p);
      if (!p.track.sample(now, v.pose)) { v.visible = false; continue; }
      v.dist = Math.hypot(v.pose.x - cam.x, v.pose.y - cam.y, v.pose.z - cam.z);
      v.visible = false;
      if (v.dist <= DRAW_DISTANCE) list.push([p, v]);
    }
    list.sort((a, b) => a[1].dist - b[1].dist);
    if (list.length > MAX_DRAWN) list.length = MAX_DRAWN;

    let near = 0, far = 0, wheel = 0;
    this.crowd.begin();
    for (const [p, v] of list) {
      v.visible = true;
      const { x, y, z, h, m } = v.pose;
      const speed = v.pose.v;
      const turn = THREE.MathUtils.euclideanModulo(h - v.lastH + Math.PI, Math.PI * 2) - Math.PI;
      v.lastH = h;
      v.audio.position.x = x; v.audio.position.y = y; v.audio.position.z = z; v.audio.heading = h;
      const css = client.colorOf(p);
      if (m !== 'cyclist' && v.bike) { v.bike.root.visible = v.bike.helmet.visible = false; }
      if (m !== 'helicopter' && v.heli) v.heli.root.visible = false;
      if (m !== 'person' && m !== 'cyclist') v.rigPlaced = false;

      if (m === 'car') {
        _q.setFromAxisAngle(UP, h);
        _p.set(x, y, z);
        _m.compose(_p, _q, _s);
        const mesh = v.dist > CAR_PROXY_DISTANCE ? this.carFar : this.carNear;
        const i = v.dist > CAR_PROXY_DISTANCE ? far++ : near++;
        mesh.setMatrixAt(i, _m);
        _c.set(css);
        mesh.geometry.attributes.paintColor.setXYZ(i, _c.r, _c.g, _c.b);
        if (mesh === this.carNear) {
          v.wheelSpin += (speed / SPEC.wheelRadius) * dt;
          for (const [k, wz] of [[0, SPEC.wheelZ], [1, SPEC.wheelZ], [0, -SPEC.wheelZ], [1, -SPEC.wheelZ]]) {
            const side = k === 0 ? -1 : 1;
            _qs.setFromAxisAngle(AX, v.wheelSpin);
            _p.set(side * SPEC.wheelX, SPEC.wheelRadius, wz);
            _w.compose(_p, _qs, _s).premultiply(_m);
            this.wheels[k].setMatrixAt(wheel + (wz > 0 ? 0 : 1), _w);
          }
          wheel += 2;
        }
      } else if (m === 'person' || m === 'cyclist') {
        if (!v.rig) v.rig = new PersonRig({ seed: 3.1 + p.id * 1.7, scale: 0.96 + (p.id % 5) * 0.02, girth: 1.0, hair: (p.id % 4) * 0.15 });
        const owner = { y };
        if (m === 'person') {
          if (!v.rigPlaced) { v.rig.reset(x, z, h, remoteGround, owner); v.rigPlaced = true; }
          const air = Math.max(0, y - (v.groundY ?? y));
          v.rig.update(dt, x, z, h, remoteGround, owner, air > 0.3 ? air : 0);
          v.groundY = y;
        } else {
          if (!v.bike) v.bike = this.makeBike(css);
          const b = v.bike;
          b.root.visible = b.helmet.visible = true;
          b.root.position.set(x, y, z);
          b.root.rotation.y = h;
          v.lean += (THREE.MathUtils.clamp(-turn / Math.max(dt, 1e-3) * 0.12, -0.34, 0.34) * Math.min(1, speed / 9) - v.lean) * Math.min(1, dt * 6);
          b.lean.rotation.z = v.lean;
          const spin = (speed / 0.35) * dt;
          for (const w of b.wheels) w.rotation.x += spin;
          if (speed > 0.5) b.crank += spin / 3.2;
          v.rig.ride(b.lean, b.crank, BIKE);
          b.helmet.quaternion.copy(v.rig.headQuaternion);
          b.helmet.position.set(0, 0.175, -0.012).applyQuaternion(b.helmet.quaternion).add(v.rig.headPosition);
          v.rigPlaced = false;
        }
        this.crowd.add(v.rig, v.dist);
      } else if (m === 'helicopter') {
        if (!v.heli) v.heli = this.makeHeli();
        const hl = v.heli;
        hl.root.visible = true;
        hl.root.position.set(x, y, z);
        hl.root.rotation.y = h;
        hl.tilt.rotation.x += (Math.min(0.24, speed / 52 * 0.24) - hl.tilt.rotation.x) * Math.min(1, dt * 4);
        hl.main.rotation.y += dt * 38;
        hl.tail.rotation.x += dt * 52;
      }
    }
    this.crowd.end();

    for (const [mesh, n] of [[this.carNear, near], [this.carFar, far]]) {
      mesh.count = n;
      if (n) {
        mesh.instanceMatrix.needsUpdate = true;
        mesh.geometry.attributes.paintColor.needsUpdate = true;
      }
    }
    for (const w of this.wheels) {
      w.count = wheel;
      if (wheel) w.instanceMatrix.needsUpdate = true;
    }
    for (const v of this.views.values()) {
      if (v.visible) continue;
      if (v.bike) v.bike.root.visible = v.bike.helmet.visible = false;
      if (v.heli) v.heli.root.visible = false;
    }
    this.updateNames(client, camera, players, now);
    this.updateSelf(client, camera, now, self);
  }

  // Another player's horn, from their car (the game's own horn sound, positioned and following the car)
  honk(player, audio) {
    const v = this.views.get(player.id);
    if (v?.visible && v.pose.m === 'car') audio.honk(v.audio);
  }

  // My own gesture, over my head for a moment
  updateSelf(client, camera, now, self) {
    if (!this.overlay) return;
    if (!this.selfEl) {
      this.selfEl = document.createElement('div');
      this.selfEl.className = 'player-name is-self';
      this.selfEl.innerHTML = '<span class="bubble"></span>';
      this.overlay.appendChild(this.selfEl);
    }
    const g = client.myGesture;
    const fresh = self && g && now - g.t < GESTURE_SHOW_MS && client.status === 'online';
    if (!fresh) { this.selfEl.style.display = 'none'; return; }
    const head = self.m === 'car' ? 2.1 : self.m === 'helicopter' ? 3.6 : 2.25;
    _v.set(self.x, self.y + head, self.z).project(camera);
    if (_v.z > 1 || _v.z < -1) { this.selfEl.style.display = 'none'; return; }
    this.selfEl.style.display = '';
    this.selfEl.style.transform = `translate(${((_v.x + 1) / 2) * this.overlay.clientWidth}px, ${((1 - _v.y) / 2) * this.overlay.clientHeight}px) translate(-50%, -100%)`;
    const text = gestureText(g.g);
    if (this.selfEl.firstChild.textContent !== text) this.selfEl.firstChild.textContent = text;
  }

  // One HTML label per player over the head, up to NAME_DISTANCE; projected every frame
  updateNames(client, camera, players, now) {
    if (!this.names) return;
    const w = this.overlay.clientWidth, h = this.overlay.clientHeight;
    for (const p of players.values()) {
      const v = this.views.get(p.id);
      let el = this.names.get(p.id);
      const show = v?.visible && v.dist <= NAME_DISTANCE;
      if (!show) { if (el) el.style.display = 'none'; continue; }
      if (!el) {
        el = document.createElement('div');
        el.className = 'player-name';
        el.innerHTML = '<span class="dot"></span><span class="txt"></span><span class="bubble"></span>';
        this.overlay.appendChild(el);
        this.names.set(p.id, el);
      }
      const head = v.pose.m === 'car' ? 2.1 : v.pose.m === 'helicopter' ? 3.6 : 2.25;
      _v.set(v.pose.x, v.pose.y + head, v.pose.z).project(camera);
      if (_v.z > 1 || _v.z < -1) { el.style.display = 'none'; continue; }
      el.style.display = '';
      // Nearer names on top and bigger, so a crowd far away doesn't hide the one next to you
      const k = Math.min(1, v.dist / NAME_DISTANCE);
      el.style.transform = `translate(${((_v.x + 1) / 2) * w}px, ${((1 - _v.y) / 2) * h}px) translate(-50%, -100%) scale(${1 - 0.35 * k})`;
      el.style.opacity = String(1 - 0.6 * k);
      el.style.zIndex = String(1000 - Math.round(v.dist));
      const txt = el.children[1];
      if (txt.textContent !== p.name) txt.textContent = p.name;
      const bubble = el.children[2];
      const said = p.gesture && now - p.gesture.t < GESTURE_SHOW_MS ? gestureText(p.gesture.g) : '';
      if (bubble.textContent !== said) { bubble.textContent = said; el.classList.toggle('has-bubble', Boolean(said)); }
      const css = client.colorOf(p);
      if (el.dataset.color !== css) { el.dataset.color = css; el.firstChild.style.background = css; }
    }
  }

  // Map and radar dots: [{ x, z, color, name, mode }]
  dots(client, now) {
    const out = [];
    for (const p of client.players.values()) {
      const v = this.views.get(p.id);
      const pose = v?.pose && !p.track.empty ? (p.track.sample(now, v.pose) || null) : null;
      if (pose) out.push({ x: pose.x, z: pose.z, color: client.colorOf(p), name: p.name, mode: pose.m });
    }
    return out;
  }
}
