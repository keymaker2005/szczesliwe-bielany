import * as THREE from 'three/webgpu';
import { pass, mrt, output, normalView, positionView, metalness, roughness, vec2, smoothstep } from 'three/tsl';
import { ssr } from 'three/addons/tsl/display/SSRNode.js';
import { createPostProcessing } from './post-processing.js';
import { ClusteredLighting } from 'three/addons/lighting/ClusteredLighting.js';
import { getLocationLabel, isTypingInField, ROADS, LANDMARKS, TELEPORT_LOCATIONS } from './city-config.js';
import { buildCityGrid } from './city-grid.js';
import { buildCityBlocks } from './buildings.js';
import { buildLandmarks, landmarkBuildingIds } from './landmarks.js';
import { buildStreetDetails } from './street-details.js';
import { createTrafficSystem, createHighwayTraffic } from './traffic.js';
import { createTrams } from './trams.js';
import { buildRoadPaint } from './road-paint.js';
import { ThirdPersonControllerManager } from './controllers.js';
import { TouchControls } from './touch-controls.js';
import { GamepadControls } from './gamepad-controls.js';
import { CameraSystem, CAMERA_PRESETS } from './cameras.js';
import { LightingSystem } from './lighting.js';
import { NYCMapSystem } from './nyc-map.js';
import { setupSceneCulling, updateSceneCulling } from './scene-culling.js';
import { CityAudioSystem } from './audio-system.js';
import { GEO } from './bielany-geodata.js';
import { loadTerrain, groundY } from './terrain.js';
import { buildForest } from './forest.js';
import { buildWater } from './water.js';
import { buildBridges } from './bridges.js';
import { MissionEngine, ARRIVE_RADIUS } from './missions.js';
import { createMissionMarker } from './mission-marker.js';
import { findRoute, limitAt } from './gps-route.js';
import { Phone } from './phone.js';
import { Courier, COMPANY } from './courier.js';
import { Guide } from './guide.js';
import { Taxi, BRAND as TAXI_BRAND } from './taxi.js';
import { createPassenger } from './passenger.js';
import { Medic, DISPATCH } from './medic.js';
import { createAmbulance } from './ambulance.js';
import { PhotoMode } from './photo-mode.js';
import { Postcards } from './postcards.js';
import { createFallingLeaves } from './falling-leaves.js';
import { nearestOnStreet } from './gps-route.js';

// js/main.js
// Main entry point for Szczęśliwe Bielany (Warsaw, along the M1 metro line) in Three.js WebGPURenderer & TSL (three.js dev @ fae8734, pinned in index.html)

async function initApp() {
  const container = document.getElementById('canvas-container');
  const loadingOverlay = document.getElementById('loading-overlay');
  const loadingStatus = document.getElementById('loading-status');
  const loadingTrack = loadingOverlay ? loadingOverlay.querySelector('.loader-track') : null;
  const loadingFill = document.getElementById('loading-progress');
  // The loading bar sweeps while the city is being built (the main thread is busy) and fills as the shaders compile
  const setLoadingProgress = (p) => {
    if (!loadingFill) return;
    if (loadingTrack) loadingTrack.classList.remove('is-indeterminate');
    loadingFill.style.transform = `scaleX(${Math.min(1, Math.max(0, p))})`;
  };

  if (loadingStatus) {
    loadingStatus.textContent = `Uruchamianie three.js r${THREE.REVISION}, WebGPU i shaderów TSL...`;
  }

  // 1. Initialize Three.js WebGPURenderer with 32-bit float reversedDepthBuffer
  const renderer = new THREE.WebGPURenderer({
    antialias: true,
    powerPreference: 'high-performance',
    reversedDepthBuffer: true
  });
  renderer.setPixelRatio(1.0);
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.shadowMap.enabled = true;
  renderer.lighting = new ClusteredLighting(256, 32, 28, 48);
  container.appendChild(renderer.domElement);

  // Start-up phase timings (logged once as "[init] ...") to keep load-time regressions traceable
  let initTimings = [];
  let initMark = performance.now();
  const markInit = (label) => {
    const now = performance.now();
    initTimings.push(`${label} ${Math.round(now - initMark)}ms`);
    initMark = now;
  };

  await renderer.init();
  markInit('renderer');

  // 2. Build Scene & Physical Atmospheric Sky / PMREM IBL / 4096x4096 Shadow Lighting
  const scene = new THREE.Scene();
  const lightingSystem = new LightingSystem(scene, renderer);
  markInit('lighting');

  if (loadingStatus) {
    loadingStatus.textContent = 'Budowanie ulic Bielan...';
  }

  // 3. Build the ground & streets of Bielany, the LoD1 buildings, street details & traffic. First the terrain (the
  // escarpment and the Vistula valley below the plateau): everything below stands on it
  // (?plaski: the flat world of Faza 2, to compare)
  if (!new URLSearchParams(location.search).has('plaski')) await loadTerrain(new URL('./bielany-terrain.bin', import.meta.url));
  markInit('terrain');
  const cityGrid = buildCityGrid(scene);
  buildWater(scene); // the Vistula, the ponds, the beaches
  const bridges = buildBridges(scene); // the Skłodowska-Curie bridge and the viaducts
  markInit('cityGrid');
  const cityBlocks = buildCityBlocks(scene, { skip: landmarkBuildingIds() });
  markInit('buildings');
  const landmarks = buildLandmarks(scene);
  markInit('landmarks');
  const allColliders = [...cityBlocks.colliders, ...landmarks.colliders, ...(cityGrid.colliders || []), ...bridges.colliders];

  const streetDetails = buildStreetDetails(scene);
  const forest = buildForest(scene); // the undergrowth of the woods
  // Mission goal pillar: in the scene (far below the ground) from the start, so the warm-up frame compiles it
  const missionMarker = createMissionMarker(ARRIVE_RADIUS);
  missionMarker.group.position.set(0, -500, 0);
  scene.add(missionMarker.group);
  const fallingLeaves = createFallingLeaves(scene);
  markInit('streetDetails');
  // Oriented colliders (buildings along the streets) reach past their footprints with their world bounds: they stay
  // inside the property line anyway, so the road network (lanes & sidewalks) doesn't need them.
  // Elevated sections that clear even a bus don't obstruct ground traffic.
  const trafficSystem = createTrafficSystem(scene, cityGrid.sidewalks, [
    ...cityGrid.footprints,
    ...streetDetails.footprints,
    ...allColliders.filter((c) => !c.obb && (c.minY ?? 0) - (c.base ?? 0) < 3.5)
  ]);
  markInit('traffic');
  const trams = createTrams(scene, { blockers: trafficSystem.blockers });
  markInit('trams');
  streetDetails.addSignals(trafficSystem.network); // the signal heads stand at the junctions the network signals
  const highwayTraffic = createHighwayTraffic(scene, cityGrid.highwayLanes);
  buildRoadPaint(scene, trafficSystem.network);
  markInit('roadPaint');

  // 4. Initialize Third-Person Controllers (Person, Car, Cyclist, Helicopter) & Multi-Camera System
  // Saved players (Bielany frame; the New York saves under 'nyc-player-state' are left alone)
  const PLAYER_STATE_KEY = 'bielany-player-state';
  const controllerManager = new ThirdPersonControllerManager(scene, allColliders);
  // Reuse teleport placement so saved players return at rest, close to their last positions.
  try {
    const saved = JSON.parse(localStorage.getItem(PLAYER_STATE_KEY));
    if (saved?.version === 1) {
      for (const mode of Object.keys(controllerManager.entities)) {
        const p = saved.entities?.[mode];
        if (!p || ![p.x, p.y, p.z, p.heading].every(Number.isFinite)) continue;
        controllerManager.setMode(mode);
        controllerManager.teleportActiveTo(p.x, p.z, p.heading, p.y);
      }
      controllerManager.setMode(Object.hasOwn(controllerManager.entities, saved.activeMode) ? saved.activeMode : 'car');
    }
  } catch { /* Missing or unavailable storage does not prevent playing. */ }

  function savePlayerState() {
    try {
      const entities = Object.fromEntries(Object.entries(controllerManager.entities).map(([mode, entity]) => [mode, {
        x: entity.position.x, y: entity.position.y, z: entity.position.z, heading: entity.heading
      }]));
      localStorage.setItem(PLAYER_STATE_KEY, JSON.stringify({ version: 1, activeMode: controllerManager.activeMode, entities }));
    } catch { /* Storage may be disabled or full. */ }
  }

  const cameraSystem = new CameraSystem(renderer.domElement, controllerManager);
  const touchControls = new TouchControls(controllerManager);
  const soundButton = document.getElementById('btn-sound');
  const audioSystem = new CityAudioSystem({ controllerManager, trafficSystem, highwayTraffic, streetDetails }, {
    onStateChange: updateSoundButton
  });
  function updateSoundButton() {
    if (!soundButton) return;
    soundButton.disabled = !audioSystem.supported;
    soundButton.setAttribute('aria-pressed', String(audioSystem.enabled));
    soundButton.setAttribute('aria-label', audioSystem.enabled ? 'Mute sound' : 'Enable sound');
    soundButton.title = audioSystem.supported ? `${audioSystem.enabled ? 'Wycisz' : 'Włącz'} dźwięk [N]` : 'Dźwięk niedostępny w tej przeglądarce';
    soundButton.querySelector('use').setAttribute('href', audioSystem.enabled ? '#i-sound' : '#i-sound-off');
  }
  soundButton?.addEventListener('click', () => audioSystem.setEnabled(!audioSystem.enabled));
  updateSoundButton();
  // pagehide also covers navigation away on mobile; preserve the context across back-forward cache restores.
  window.addEventListener('pagehide', (event) => {
    savePlayerState();
    if (!event.persisted) audioSystem.dispose();
  });
  document.addEventListener('visibilitychange', () => { if (document.hidden) savePlayerState(); });
  markInit('controllers');

  // Area-wide static geometry: chunk & distance-cull the small props, shadow stand-ins for the big casters
  // (scene-culling.js)
  const cullingRoots = ['BielanyCityGrid', 'BielanyBuildings', 'BielanyLandmarks', 'BielanyStreetDetails']
    .map((name) => scene.getObjectByName(name))
    .filter(Boolean);
  setupSceneCulling(scene, cullingRoots, lightingSystem.sunLight.shadow);
  markInit('culling');

  // On WebGPU, small InstancedMeshes (<= 1000 instances) keep their matrices in uniform buffers that three.js
  // re-uploads on every draw of every pass (~2.5 MB/frame with the shadow cascades, stalling the GPU queue).
  // Storage attributes only upload when needed; WebGL2 needs ordinary instanced attributes for correct transforms.
  if (renderer.backend.isWebGPUBackend) {
    scene.traverse((object) => {
      if (object.isInstancedMesh) {
        object.instanceMatrix = new THREE.StorageInstancedBufferAttribute(object.instanceMatrix.array, 16);
      }
    });
  }

  // 5. TSL RenderPipeline with Half-Res Screen Space Reflections (SSRNode), Bloom & Filmic Toning
  //    Fade out distant and matte surfaces so SSR spends its rays on visible glossy reflections.
  const scenePass = pass(scene, cameraSystem.camera);
  // The multisampled colour attachments (output, normal, metalRough) only need resolving, never storing: discarding
  // them spares the GPU writing 3 x 4 samples per pixel to memory every frame (transient, memoryless attachments where
  // the browser supports them). The multisampled depth stays stored: SSR reads it.
  scenePass.renderTarget.storeMultisampledColorBuffer = false;
  const ssrFade = smoothstep(360.0, 180.0, positionView.z.negate());
  const maxSSRRoughness = 0.75;
  const sceneMRT = mrt({
    output: output,
    normal: normalView,
    metalRough: vec2(roughness.lessThan(maxSSRRoughness).select(metalness.mul(ssrFade), 0), roughness)
  });
  sceneMRT.setBlendMode('normal', new THREE.BlendMode(THREE.MaterialBlending));
  sceneMRT.setBlendMode('metalRough', new THREE.BlendMode(THREE.MaterialBlending));
  scenePass.setMRT(sceneMRT);

  const scenePassColor = scenePass.getTextureNode('output');
  const scenePassDepth = scenePass.getTextureNode('depth');
  const scenePassNormal = scenePass.getTextureNode('normal');
  const scenePassMetalRough = scenePass.getTextureNode('metalRough');

  const ssrPass = ssr(scenePassColor, scenePassDepth, scenePassNormal, {
    metalnessNode: scenePassMetalRough.r,
    roughnessNode: scenePassMetalRough.g,
    camera: cameraSystem.camera
  });
  ssrPass.resolutionScale = 0.5;
  ssrPass.blurQuality = 1;
  ssrPass.maxDistance.value = 42;
  ssrPass.thickness.value = 0.85;
  // Fewer coarse steps, then refine detected hits to keep reflection edges precise.
  ssrPass.quality.value = 0.25;
  ssrPass.binaryRefine = true;
  ssrPass.intensity.value = 0.50;
  ssrPass.screenEdgeFadeBlack = true;

  // Roughness mip blur must not spread reflections back onto matte or nonreflective surfaces.
  const reflectionMask = scenePassMetalRough.r.greaterThan(0).select(smoothstep(maxSSRRoughness, 0.55, scenePassMetalRough.g), 0);
  const reflections = ssrPass.mul(reflectionMask);
  const colorGrade = createPostProcessing(renderer, scenePassColor, reflections);
  const renderPipeline = new THREE.RenderPipeline(renderer, colorGrade.outputNode);

  // 6. Wire UI Controls (Strictly using safe DOM APIs: textContent, classList, addEventListener)
  const modeButtons = document.querySelectorAll('[data-mode]');
  const cameraButtons = document.querySelectorAll('[data-camera]');
  const timeButtons = document.querySelectorAll('[data-time]');
  const teleportButtons = document.querySelectorAll('[data-teleport]');
  const hudToggleBtn = document.getElementById('btn-toggle-hud');
  const modeSwitch = document.getElementById('mode-switch');
  touchControls.onAvailabilityChange = placeModeIndicator;

  const elFps = document.getElementById('hud-fps');
  const elMode = document.getElementById('hud-active-mode');
  const elCamera = document.getElementById('hud-active-camera');
  const elSpeed = document.getElementById('hud-speed');
  const elSpeedMeter = document.getElementById('hud-speed-meter');
  const elAltitude = document.getElementById('hud-altitude');
  const elLocation = document.getElementById('hud-location');
  const elControlsHint = document.getElementById('hud-controls-hint');
  const gamepadControls = new GamepadControls(controllerManager, cameraSystem, {
    onCycleMode: (step) => {
      const modes = ['person', 'car', 'cyclist', 'helicopter'];
      selectMode(modes[(modes.indexOf(controllerManager.activeMode) + step + modes.length) % modes.length]);
    },
    onCycleCamera: cycleCamera,
    onToggleMap: () => mapSystem.toggleFullMap(!mapSystem.isFullMapOpen),
    onCloseMap: () => mapSystem.toggleFullMap(false)
  });

  // Keyboard guide for each mode: [keys, action]
  const controlHints = {
    person: [[['W', 'S'], 'Idź'], [['A', 'D'], 'Skręt'], [['Shift'], 'Bieg'], [['Space'], 'Skok'], [['Drag'], 'Obrót kamery']],
    car: [[['W', 'S'], 'Jazda / wstecz'], [['A', 'D'], 'Skręt'], [['Shift'], 'Szybciej'], [['B'], 'Klakson'], [['Drag'], 'Obrót kamery']],
    cyclist: [[['W', 'S'], 'Pedałuj / hamuj'], [['A', 'D'], 'Przechył i skręt'], [['Shift'], 'Sprint'], [['Drag'], 'Obrót kamery']],
    helicopter: [[['W', 'S'], 'Pochylenie'], [['A', 'D'], 'Obrót'], [['Space', 'E'], 'W górę'], [['Q', 'C'], 'W dół'], [['Shift'], 'Szybciej']]
  };
  // Boosted top speeds in km/h (controllers.js caps them at 8.2, 36, 19 & 52 m/s): full scale of the speed meter
  const topSpeedKmh = { person: 30, car: 130, cyclist: 68, helicopter: 187 };

  function renderControlHints(mode) {
    if (!elControlsHint) return;
    const items = (controlHints[mode] || []).map(([keys, action]) => {
      const item = document.createElement('span');
      item.className = 'hint';
      for (const key of keys) {
        const kbd = document.createElement('kbd');
        kbd.textContent = key;
        item.appendChild(kbd);
      }
      const label = document.createElement('span');
      label.className = 'hint-label';
      label.textContent = action;
      item.appendChild(label);
      return item;
    });
    elControlsHint.replaceChildren(...items);
  }

  // The taxi-yellow pill under the selected mode glides from button to button
  function placeModeIndicator() {
    const active = modeSwitch ? modeSwitch.querySelector('.mode-btn.active') : null;
    if (!active) return;
    modeSwitch.style.setProperty('--ind-x', `${active.offsetLeft}px`);
    modeSwitch.style.setProperty('--ind-w', `${active.offsetWidth}px`);
  }

  function selectMode(mode) {
    // the new character or vehicle comes to where the player is (out of the cab onto the street, the cab to the
    // walker), at a safe spot nearby (never inside a building)
    const prevMode = controllerManager.activeMode;
    const prev = controllerManager.getActiveEntity();
    const from = prev ? { x: prev.position.x, z: prev.position.z, heading: prev.heading } : null;
    controllerManager.setMode(mode);
    if (from && prevMode !== controllerManager.activeMode) {
      controllerManager.teleportActiveTo(from.x, from.z, from.heading);
      cameraSystem.resetForTeleport();
    }
    touchControls.setMode(controllerManager.activeMode);
    gamepadControls.reset();
    modeButtons.forEach((btn) => {
      btn.classList.toggle('active', btn.getAttribute('data-mode') === mode);
    });
    document.body.dataset.mode = mode;
    placeModeIndicator();
    const ent = controllerManager.getActiveEntity();
    if (elMode) elMode.textContent = ent.label;
    renderControlHints(mode);

    // If currently on a static scenic camera, switch to 3rd-Person Chase so user sees their selected character/vehicle
    const currentCam = cameraSystem.getActivePreset();
    if (currentCam.category !== 'follow') {
      selectCamera('chase', false);
    }
  }

  function selectCamera(camId, snap = false) {
    cameraSystem.setCameraPreset(camId, snap);
    cameraButtons.forEach((btn) => {
      btn.classList.toggle('active', btn.getAttribute('data-camera') === camId);
    });
    const preset = cameraSystem.getActivePreset();
    if (elCamera) elCamera.textContent = preset.name;
  }

  // Steps through CAMERA_PRESETS (V / Shift+V, and the arrows either side of the camera name)
  function cycleCamera(step) {
    const n = CAMERA_PRESETS.length;
    const idx = CAMERA_PRESETS.findIndex((p) => p.id === cameraSystem.activePresetId);
    selectCamera(CAMERA_PRESETS[(idx + step + n) % n].id, true);
  }

  function selectTime(timeId) {
    lightingSystem.applyPreset(timeId);
    colorGrade.applyPreset(lightingSystem.activePresetId);
    timeButtons.forEach((btn) => {
      btn.classList.toggle('active', btn.getAttribute('data-time') === timeId);
    });
  }

  // Popovers (native [popover]: light dismiss & Esc for free) open against the control that toggles them: data-anchor
  // names the element they sit above / below, data-align the one whose right edge they line up with
  const popovers = document.querySelectorAll('.popover[popover]');
  const supportsPopover = typeof HTMLElement.prototype.togglePopover === 'function';
  function closePopovers() {
    if (!supportsPopover) return;
    popovers.forEach((pop) => {
      if (pop.matches(':popover-open')) pop.hidePopover();
    });
  }
  popovers.forEach((pop) => {
    const invoker = document.querySelector(`[popovertarget="${pop.id}"]`);
    pop.addEventListener('beforetoggle', (e) => {
      const open = e.newState === 'open';
      if (invoker) invoker.classList.toggle('is-open', open);
      if (!open) return;
      const anchor = document.getElementById(pop.dataset.anchor) || invoker;
      const align = document.getElementById(pop.dataset.align) || invoker;
      if (!anchor || !align) return;
      const r = anchor.getBoundingClientRect();
      const spaceAbove = Math.max(0, r.top - 20);
      const spaceBelow = Math.max(0, window.innerHeight - r.bottom - 20);
      let above = pop.dataset.side === 'above';
      // The camera control moves to the top on touch screens; open toward the available space.
      if ((above ? spaceAbove : spaceBelow) < 160) above = spaceAbove > spaceBelow;
      pop.style.right = `${Math.max(8, window.innerWidth - align.getBoundingClientRect().right)}px`;
      if (above) {
        pop.style.top = 'auto';
        pop.style.bottom = `${window.innerHeight - r.top + 8}px`;
        pop.style.maxHeight = `${spaceAbove}px`;
      } else {
        pop.style.bottom = 'auto';
        pop.style.top = `${r.bottom + 8}px`;
        pop.style.maxHeight = `${spaceBelow}px`;
      }
    });
  });

  modeButtons.forEach((btn) => {
    btn.addEventListener('click', () => {
      selectMode(btn.getAttribute('data-mode'));
    });
  });

  cameraButtons.forEach((btn) => {
    btn.addEventListener('click', () => {
      selectCamera(btn.getAttribute('data-camera'), true);
      closePopovers();
    });
  });

  const camPrevBtn = document.getElementById('cam-prev');
  const camNextBtn = document.getElementById('cam-next');
  if (camPrevBtn) camPrevBtn.addEventListener('click', () => cycleCamera(-1));
  if (camNextBtn) camNextBtn.addEventListener('click', () => cycleCamera(1));

  timeButtons.forEach((btn) => {
    btn.addEventListener('click', () => {
      selectTime(btn.getAttribute('data-time'));
    });
  });

  // A mouse click mustn't leave the focus on a HUD button, or Space (jump / ascend) and Enter would press it again
  document.addEventListener('click', (e) => {
    const btn = e.target instanceof Element ? e.target.closest('button') : null;
    if (btn && e.detail > 0) btn.blur();
  });

  // Where you are: the place's name over its street corner, drawn as a pair of NYC street-name signs
  const roadNames = new Set(ROADS.map((r) => r.name));
  const placeNames = new Set(LANDMARKS.map((l) => l.name));
  let locationText = '';
  function renderLocation(label) {
    if (!elLocation || label === locationText) return;
    locationText = label;
    let place = '';
    let streets = label;
    const split = label.indexOf(' · ');
    if (split >= 0) {
      place = label.slice(0, split);
      streets = label.slice(split + 3);
    } else if (placeNames.has(label) || (!label.includes(' & ') && !roadNames.has(label))) {
      place = label;
      streets = '';
    }
    const nodes = [];
    if (place) {
      const el = document.createElement('div');
      el.className = 'location-place';
      el.textContent = place;
      nodes.push(el);
    }
    if (streets) {
      const row = document.createElement('div');
      row.className = 'location-signs';
      if (streets.startsWith('near ')) {
        streets = streets.slice(5);
        const near = document.createElement('span');
        near.className = 'location-near';
        near.textContent = 'w pobliżu';
        row.appendChild(near);
      }
      for (const name of streets.split(' & ')) {
        const sign = document.createElement('span');
        sign.className = 'street-sign';
        sign.textContent = name;
        row.appendChild(sign);
      }
      nodes.push(row);
    }
    elLocation.replaceChildren(...nodes);
  }

  function teleportTo(x, z, heading = Math.PI) {
    const destination = controllerManager.teleportActiveTo(x, z, heading);
    touchControls.reset();
    gamepadControls.reset();
    cameraSystem.resetForTeleport();
    selectCamera('chase', true);
    // an active mission keeps its goal as the waypoint
    const goal = missions.goal();
    mapSystem.waypoint = goal ? { x: goal.x, z: goal.z, name: goal.name } : {
      x: destination.x,
      z: destination.z,
      name: getLocationLabel(destination.x, destination.z)
    };
    return destination;
  }

  const mapSystem = new NYCMapSystem({
    controllerManager,
    cameraSystem,
    trafficSystem,
    allBlocks: cityBlocks.allBlocks,
    onToggle: (open) => {
      controllerManager.resetInput();
      touchControls.setEnabled(!open);
      gamepadControls.setEnabled(!open);
      const mapHint = document.getElementById('fullmap-hover-info');
      if (open && touchControls.available && mapHint) {
        mapHint.textContent = 'Stuknij, by się teleportować · przeciągnij, by przesunąć · + / − przybliża';
      }
    },
    onTeleport: teleportTo
  });

  teleportButtons.forEach((btn) => {
    btn.addEventListener('click', () => {
      const key = btn.getAttribute('data-teleport');
      const loc = TELEPORT_LOCATIONS[key];
      if (loc) {
        teleportTo(loc.x, loc.z, loc.heading);
      }
      closePopovers();
    });
  });

  const openMapBtn = document.getElementById('btn-open-map');
  if (openMapBtn) openMapBtn.addEventListener('click', () => mapSystem.toggleFullMap(true));

  if (hudToggleBtn) {
    hudToggleBtn.addEventListener('click', () => {
      document.body.classList.toggle('hud-minimized');
      const isMin = document.body.classList.contains('hud-minimized');
      hudToggleBtn.setAttribute('aria-pressed', String(isMin));
      hudToggleBtn.setAttribute('aria-label', isMin ? 'Show HUD' : 'Hide HUD');
      hudToggleBtn.title = isMin ? 'Pokaż interfejs [H]' : 'Czysty widok: ukryj interfejs [H]';
      if (isMin) closePopovers();
    });
  }

  // Global keyboard shortcuts for modes (1-4), cameras (V / 5-0), and HUD (H)
  window.addEventListener('keydown', (e) => {
    if (isTypingInField(e)) return;
    switch (e.code) {
      case 'Digit1':
        selectMode('person');
        break;
      case 'Digit2':
        selectMode('car');
        break;
      case 'Digit3':
        selectMode('cyclist');
        break;
      case 'Digit4':
        selectMode('helicopter');
        break;
      case 'Digit5':
        selectCamera('chase', true);
        break;
      case 'Digit6':
        selectCamera('action', true);
        break;
      case 'Digit7':
        selectCamera('pov', true);
        break;
      case 'Digit8':
        selectCamera('fifthAve', true);
        break;
      case 'Digit9':
        selectCamera('timesSquare', true);
        break;
      case 'Digit0':
        selectCamera('chryslerGCT', true);
        break;
      case 'KeyV':
        cycleCamera(e.shiftKey ? -1 : 1);
        break;
      case 'KeyH':
        if (hudToggleBtn) hudToggleBtn.click();
        break;
      case 'KeyF': { // the camera app (photo mode handles F itself while it is on)
        const ph = globalThis.bielany?.photo;
        if (!e.repeat && ph && !ph.active && !mapSystem.isFullMapOpen) ph.enter();
        break;
      }
      case 'KeyK': { // the ambulance's siren (set up further down, after the missions)
        const amb = globalThis.bielany?.ambulance;
        if (!e.repeat && amb?.active) amb.setSiren(!amb.siren, audioSystem.enabled);
        break;
      }
      case 'KeyN':
        if (!e.repeat && !e.metaKey && !e.ctrlKey && !e.altKey) audioSystem.setEnabled(!audioSystem.enabled);
        break;
      case 'KeyB':
        if (!e.repeat && !e.metaKey && !e.ctrlKey && !e.altKey && !mapSystem.isFullMapOpen) audioSystem.honk(controllerManager.getActiveEntity());
        break;
    }
  });

  window.addEventListener('resize', () => {
    cameraSystem.onResize(window.innerWidth, window.innerHeight);
    renderer.setSize(window.innerWidth, window.innerHeight);
    placeModeIndicator();
    if (mapSystem.isFullMapOpen) {
      mapSystem.resizeFullCanvas();
      mapSystem.renderFullMap();
    }
  });

  // 5c. Missions (js/missions.js): the goal as the GPS waypoint and the pillar of light, a panel with the clock, a card
  //     with the stars at the end. bielany.testDelivery() in the console offers & accepts a delivery near the player.
  const missions = new MissionEngine();
  const elMission = document.getElementById('mission-hud');
  const elMissionTitle = document.getElementById('mission-title');
  const elMissionClock = document.getElementById('mission-clock');
  const elMissionGoal = document.getElementById('mission-goal');
  const elMissionNote = document.getElementById('mission-note');
  const elMissionResult = document.getElementById('mission-result');
  const MODE_NAMES = { person: 'pieszo', cyclist: 'rowerem', car: 'autem', helicopter: 'helikopterem' };
  const clock = (s) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
  let missionNote = null;
  let resultTimer = 0;
  missions.on('state', (m) => {
    const goal = missions.goal();
    if (goal) {
      missionMarker.show(goal.x, goal.z);
      mapSystem.waypoint = { x: goal.x, z: goal.z, name: goal.name };
    } else {
      missionMarker.hide();
    }
    if (elMission) elMission.classList.toggle('hidden', !missions.active);
    if (['delivered', 'late', 'abandoned'].includes(m.state) && elMissionResult) {
      const stars = '★'.repeat(m.stars) + '☆'.repeat(3 - m.stars);
      elMissionResult.innerHTML = m.state === 'abandoned'
        ? `Zlecenie przerwane: ${m.title}`
        : `${m.state === 'late' ? 'Spóźnione' : 'Dostarczone'} w ${clock(m.time)} · <span class="stars">${stars}</span> · ${m.paid} zł${m.shortcut ? ` · skrót +${m.shortcut} zł` : ''}${m.role === 'taxi' ? ` · komfort ${m.comfort}/100 · napiwek ${m.tip} zł` : ''}`;
      elMissionResult.classList.remove('hidden');
      clearTimeout(resultTimer);
      resultTimer = setTimeout(() => elMissionResult.classList.add('hidden'), 6000);
    }
  });
  function renderMission() {
    const m = missions.active;
    if (!m || !elMission) return;
    const goal = missions.goal();
    const route = mapSystem.route;
    const dist = route ? route.length : Math.hypot(goal.x - controllerManager.getActiveEntity().position.x, goal.z - controllerManager.getActiveEntity().position.z);
    elMissionTitle.textContent = m.title;
    elMissionClock.textContent = m.state === 'enRoute' ? `${clock(m.time)} / ${clock(m.par)}`
      : m.role === 'medic' ? `dojazd ${clock(medic.response)} / ${clock(m.responsePar || 0)}` : 'odbiór';
    elMissionClock.classList.toggle('is-late', m.time > m.limit);
    elMissionGoal.textContent = `${m.state === 'accepted' ? 'Odbierz' : 'Dostarcz'}: ${goal.name} · ${dist < 1000 ? `${Math.round(dist / 10) * 10} m` : `${(dist / 1000).toFixed(1)} km`}`;
    const comfort = m.role === 'taxi' && m.state === 'enRoute' && taxi.ride ? ` · komfort ${Math.max(0, Math.round(taxi.ride.comfort))}/100` : '';
    elMissionGoal.textContent += comfort;
    elMissionNote.textContent = taxiNote && performance.now() < taxiNoteUntil
      ? `Pasażer: ${COMFORT_NOTES[taxiNote]}!`
      : missionNote === 'wrong-vehicle'
      ? `Tu się nie da ${MODE_NAMES[controllerManager.activeMode]}: ${m.vehicles.map((v) => MODE_NAMES[v]).join(' lub ')}`
      : m.state === 'enRoute' || m.state === 'accepted' ? 'Zatrzymaj się w żółtym kręgu' : '';
  }
  // A delivery to a random address minDist-maxDist m (along the streets) from the player, picked up where it stands;
  // par time from the route at a steady pace of the current mode
  const PACE = { person: 1.6, cyclist: 5.5, car: 8, helicopter: 8 }; // m/s, junctions and lights included
  let deliveryCount = 0;
  function testDelivery(minDist = 300, maxDist = 900) {
    const p = controllerManager.getActiveEntity().position;
    const { streets, list } = GEO.addresses;
    const near = list.filter((a) => {
      const d = Math.hypot(a[4] - p.x, a[5] - p.z);
      return d >= minDist * 0.7 && d <= maxDist;
    });
    for (let tries = 0; tries < 20 && near.length; tries++) {
      const a = near[Math.floor(Math.random() * near.length)];
      const r = findRoute(p.x, p.z, a[4], a[5], { oneWay: controllerManager.activeMode === 'car' });
      if (!r || r.length < minDist || r.length > maxDist * 1.4) continue;
      const pace = PACE[controllerManager.activeMode] || PACE.cyclist;
      const id = `test-${++deliveryCount}`;
      missions.offer({
        id, role: 'courier', title: 'Paczka (test)', start: null,
        target: { x: a[4], z: a[5], name: `${streets[a[0]]} ${a[1]}` },
        vehicles: ['person', 'cyclist', 'car'], par: Math.round(r.length / pace + 15), reward: 30,
      });
      missions.accept(id);
      return missions.missions.get(id);
    }
    return null;
  }
  // 5d. The courier (js/courier.js) and the phone (js/phone.js): errands, the map, text messages
  const courier = new Courier(missions);
  courier.near = () => controllerManager.getActiveEntity().position;
  // 5d'. The taxi driver (js/taxi.js): fares from passengers waving nearby, rated for time and comfort
  const taxi = new Taxi(missions, trafficSystem.network);
  taxi.near = () => controllerManager.getActiveEntity().position;
  const passenger = createPassenger();
  scene.add(passenger.group);
  let taxiNote = null, taxiNoteUntil = 0;
  // 5d''. The paramedic (js/medic.js): calls from the dispatcher, the ambulance (js/ambulance.js) on the player's car
  const medic = new Medic(missions);
  medic.near = () => controllerManager.getActiveEntity().position;
  const ambulance = createAmbulance();
  // 5f. The camera app (js/photo-mode.js) and the postcards album (js/postcards.js)
  const postcards = new Postcards();
  const photo = new PhotoMode({
    canvas: renderer.domElement,
    camera: cameraSystem.camera,
    place: () => getLocationLabel(cameraSystem.camera.position.x, cameraSystem.camera.position.z),
    onShot: (blob, meta) => postcards.add(blob, meta).then((p) => phone.addSms({ id: `photo-${p.id}`, from: 'Aparat', text: `Zapisano pocztówkę: ${p.place} (${p.filter}). Zobacz w Pocztówkach.` })),
  });
  const phone = new Phone({
    onCamera: () => photo.enter(),
    postcards,
    root: document.getElementById('phone'),
    button: document.getElementById('btn-phone'),
    missions,
    jobs: () => [...medic.jobs(), ...taxi.jobs(), ...courier.jobs()],
    onOpenMap: () => mapSystem.toggleFullMap(true),
    status: () => (missions.active ? `W drodze: ${missions.goal().name}` : controllerManager.activeMode === 'car' ? taxi.statusLine() : courier.statusLine()),
  });
  phone.addSms({
    id: 'hello', from: COMPANY,
    text: 'Dzień dobry! Mamy paczki do rozwiezienia po Bielanach. Zlecenia w telefonie (P): odbierz paczkę przy stacji metra i dowieź rowerem lub autem. Szybciej niż GPS = premia za skrót.',
  });
  // 5e. The guide's messages at the landmarks, the mayor's at the start and after deliveries
  const guide = new Guide(phone);
  guide.start();
  missions.on('state', (m) => {
    if (m.role !== 'medic') return;
    if (m.state === 'accepted') {
      if (controllerManager.activeMode !== 'car') selectMode('car');
      ambulance.attach(controllerManager.entities.car);
      ambulance.setSiren(true, audioSystem.enabled);
      if (elMode) elMode.textContent = controllerManager.getActiveEntity().label;
      phone.addSms({ id: `${m.id}-call`, from: DISPATCH, text: `Wezwanie: ${m.start.name.replace(/^pacjent, /, '')} — ${m.reason || 'pacjent potrzebuje pomocy'}. Jedź na sygnale (K włącza i wyłącza syrenę).` });
    } else if (m.state === 'enRoute') {
      phone.addSms({ id: `${m.id}-picked`, from: DISPATCH, text: `Pacjent w karetce. Dojazd w ${clock(m.responseTime || 0)}. Teraz SOR Szpitala Bielańskiego.` });
    } else if (['delivered', 'late', 'abandoned'].includes(m.state)) {
      ambulance.detach();
      if (elMode) elMode.textContent = controllerManager.getActiveEntity().label;
      if (m.state !== 'abandoned') {
        phone.addSms({
          id: `${m.id}-done`, from: DISPATCH,
          text: `Pacjent przekazany na SOR. Dojazd ${clock(m.responseTime || 0)} (${'★'.repeat(m.responseStars) || 'za długo'}), transport ${clock(m.time)} (${'★'.repeat(m.transportStars) || 'za długo'}). ${m.paid} zł. Dziękujemy.`,
        });
      }
    }
  });
  const COMFORT_NOTES = { brake: 'ostre hamowanie', crash: 'stłuczka', red: 'czerwone światło' };
  missions.on('state', (m) => {
    if (m.role !== 'taxi') return;
    if (m.state === 'accepted') {
      // the passenger waits on the sidewalk, facing the street
      const s = nearestOnStreet(m.start.x, m.start.z);
      passenger.show(m.start.x, m.start.z, s ? s.x - m.start.x : 0, s ? s.z - m.start.z : 1);
      phone.addSms({ id: `${m.id}-call`, from: TAXI_BRAND, text: `Nowy kurs: pasażer czeka przy ${m.start.name.replace(/^pasażer, /, '')}. Cel: ${m.target.name}.` });
    } else {
      passenger.hide();
    }
    if (m.state === 'delivered' || m.state === 'late') {
      const n = m.rideNotes || {};
      const issues = [n.brakes && `${n.brakes}× ostre hamowanie`, n.crashes && `${n.crashes}× stłuczka`, n.reds && `${n.reds}× czerwone`].filter(Boolean).join(', ');
      phone.addSms({
        id: `${m.id}-done`, from: TAXI_BRAND,
        text: `Kurs zakończony w ${clock(m.time)}, ${'★'.repeat(m.stars) || 'po czasie'}. Komfort pasażera ${m.comfort}/100${issues ? ` (${issues})` : ''}. Napiwek ${m.tip} zł, razem ${m.paid} zł.`,
      });
      setTimeout(() => guide.delivered(courier.stats.deliveries + taxi.stats.rides), 5000);
    }
  });
  missions.on('state', (m) => {
    if (m.role !== 'courier' || !m.id.startsWith('poczt-')) return;
    if (m.state === 'delivered' || m.state === 'late') setTimeout(() => guide.delivered(courier.stats.deliveries), 5000);
    if (m.state === 'enRoute') phone.addSms({ id: `${m.id}-picked`, from: COMPANY, text: `Paczka odebrana. Adres: ${m.target.name}. Na trzy gwiazdki masz ${clock(m.par)}.` });
    if (m.state === 'delivered' || m.state === 'late') {
      phone.addSms({
        id: `${m.id}-done`, from: COMPANY,
        text: m.state === 'late'
          ? `Spóźnione o ${clock(m.time - m.limit)}, ale doręczone. Wypłata ${m.paid} zł. Następne zlecenia czekają w telefonie.`
          : `Doręczone w ${clock(m.time)}, ${'★'.repeat(m.stars)}. Wypłata ${m.paid} zł${m.shortcut ? ` (w tym ${m.shortcut} zł za skrót)` : ''}. Razem: ${courier.stats.earned} zł.`,
      });
    }
  });

  globalThis.bielany = { missions, testDelivery, abandon: () => missions.abandon(), teleport: (x, z, heading) => teleportTo(x, z, heading), marker: missionMarker, phone, courier, guide, scene, renderer, lightingSystem, trams, taxi, medic, ambulance, controllerManager, photo, postcards, fallingLeaves, trafficSystem };

  // Initialize the UI and chase camera around the restored player, or the default taxi on a first visit.
  selectMode(controllerManager.activeMode);
  selectCamera('chase', true);
  selectTime('autumn');
  // the web fonts change the buttons' widths once they arrive
  if (document.fonts) document.fonts.ready.then(placeModeIndicator);
  markInit('ui');

  // The loading screen stays up while the shaders compile (precompileShaders() & the warm-up frame, see the loop) and
  // until the first frame is on screen
  if (loadingStatus) {
    loadingStatus.textContent = 'Kompilowanie shaderów...';
  }

  // 6b. Shader pre-compilation behind the loading screen. compileAsync() builds the node graphs in slices and has the GPU
  //     process compile the pipelines in parallel, but after every 8 ms slice it waits for a rendered frame, which
  //     leaves the main thread idle about half the time while nothing else animates; several calls side by side keep
  //     it busy (warm cache: 2.1 s instead of 4.0 s). (Rendering straight away compiled ~500 pipelines one after
  //     another: ~25 s with a cold shader cache.)
  const COMPILE_POOL = 16;
  const nextTask = () => (globalThis.scheduler?.yield ? globalThis.scheduler.yield() : new Promise((resolve) => setTimeout(resolve, 0)));
  async function precompileShaders() {
    // An empty frame first: it sets up the post-processing chain, which configures the scene pass's render target
    // (MSAA samples, depth format), so the pipelines compiled below are the very ones the scene pass asks for
    scene.visible = false;
    renderPipeline.render();
    scene.visible = true;
    markInit('postFX');

    // Every visible object with frustum culling off (like the warm-up frame, see the loop). Plain meshes that share
    // a material share its shader, so one job compiles them in turn (the first build serves the rest); every
    // instanced mesh gets a build of its own unless its chunks share a pipeline
    const culled = [];
    const jobs = [];
    const jobByMaterial = new Map();
    const pipelines = new Set();
    scene.traverseVisible((o) => {
      if (o.frustumCulled) {
        culled.push(o);
        o.frustumCulled = false;
      }
      if (!o.isMesh && !o.isLine && !o.isPoints && !o.isSprite) return;
      // Use the first visible chunk: the original representative may be in an inactive tree cell. Shadow stand-ins
      // only draw in the shadow maps (the warm-up frame compiles those).
      if (o.userData.shadowProxy) return;
      const pipeline = o.userData.sharesPipelineWith || o;
      if (pipelines.has(pipeline)) return;
      pipelines.add(pipeline);
      if (o.isInstancedMesh || Array.isArray(o.material)) {
        jobs.push([o]);
        return;
      }
      let job = jobByMaterial.get(o.material);
      if (!job) {
        job = [];
        jobByMaterial.set(o.material, job);
        jobs.push(job);
      }
      job.push(o);
    });

    renderer.setRenderTarget(scenePass.renderTarget);
    renderer.setMRT(sceneMRT);
    const compile = async (object) => {
      // Each compile starts in a task of its own: compileAsync() keeps one precompilation state on the renderer,
      // which must not be mid-step for two of them in the same microtask checkpoint
      await nextTask();
      try {
        await renderer.compileAsync(object, cameraSystem.camera, scene);
      } catch (e) {
        console.warn('[compile]', e); // the warm-up frame compiles it instead
      }
    };
    let next = 0;
    let done = 0;
    const worker = async () => {
      while (next < jobs.length) {
        const job = jobs[next++];
        for (const object of job) await compile(object);
        done++;
        if (loadingStatus) {
          loadingStatus.textContent = `Kompilowanie shaderów... ${Math.round((done / jobs.length) * 100)}%`;
        }
        setLoadingProgress(done / jobs.length);
      }
    };
    await Promise.all(Array.from({ length: COMPILE_POOL }, worker));
    renderer.setMRT(null);
    renderer.setRenderTarget(null);
    for (const o of culled) o.frustumCulled = true;
  }

  await precompileShaders();
  markInit('compile');

  // 6. Animation Loop
  let lastTime = performance.now();
  let elapsed = 0;
  let frameCount = 0;
  let fpsTimer = 0;
  let nextPlayerSave = 0;
  let warmedUp = false; // see the first frame below

  if (elFps) elFps.textContent = '60';

  let speedLimit = 50, limitTimer = 0; // km/h, the cab's limit where it is
  const elLimit = document.getElementById('hud-limit');
  renderer.setAnimationLoop((now) => {
    const rawDt = (now - lastTime) * 0.001;
    lastTime = now;
    const dt = Math.min(Math.max(rawDt, 0.001), 0.05);
    elapsed += dt;

    // Update 3rd-person controllers, camera, signals, traffic & vehicle collisions, building LODs, and dynamic shadow focus
    gamepadControls.update(dt);
    if (!photo.active) controllerManager.update(dt, elapsed); // photo mode freezes the player
    // the cab keeps to the street's speed limit (OpenStreetMap maxspeed, else the urban default), unless boosting
    if (controllerManager.activeMode === 'car') {
      const car = controllerManager.getActiveEntity();
      limitTimer -= dt;
      if (limitTimer <= 0) {
        limitTimer = 0.25;
        const l = limitAt(car.position.x, car.position.z);
        if (l) speedLimit = l;
      }
      const cap = (ambulance.siren ? Math.min(90, speedLimit + 30) : speedLimit) / 3.6; // on lights: +30 km/h
      if (car.speed > cap && !controllerManager.keys.boost) car.speed = cap; // Shift (boost) ignores the limit
    }
    if (!photo.active) cameraSystem.update(dt, elapsed);
    photo.update(dt);
    fallingLeaves.update(dt, elapsed, cameraSystem.camera.position);
    streetDetails.signalClock.value = elapsed;
    trafficSystem.update(
      dt,
      elapsed,
      cameraSystem.currentPos,
      controllerManager.getActiveEntity(),
      controllerManager.activeMode,
      cameraSystem.camera
    );
    highwayTraffic.update(dt, cameraSystem.camera, controllerManager.getActiveEntity(), controllerManager.activeMode);
    trams.update(dt, controllerManager.activeMode === 'helicopter' ? null : controllerManager.getActiveEntity().position);
    if (!document.hidden && now >= nextPlayerSave) {
      savePlayerState();
      nextPlayerSave = now + 5000;
    }
    if (streetDetails.update) streetDetails.update(cameraSystem.camera);
    forest.update(cameraSystem.camera);
    lightingSystem.update(cameraSystem.currentPos);
    mapSystem.update();
    {
      const ent = controllerManager.getActiveEntity();
      missionNote = missions.update(dt, { x: ent.position.x, z: ent.position.z, speed: ent.speed, mode: controllerManager.activeMode });
      if (warmedUp && !missions.active) missionMarker.hide();
      if (warmedUp) guide.update(dt, ent.position);
      const note = taxi.update(dt, { x: ent.position.x, z: ent.position.z, speed: ent.speed, mode: controllerManager.activeMode, heading: ent.heading }, elapsed);
      if (note) { taxiNote = note; taxiNoteUntil = performance.now() + 2500; }
      passenger.update(elapsed);
      medic.update(dt);
      ambulance.update(elapsed);
      trafficSystem.yieldTo.active = ambulance.siren && controllerManager.activeMode === 'car';
      trafficSystem.yieldTo.heading = controllerManager.entities.car.heading;
      missionMarker.update(elapsed);
    }
    audioSystem.update(dt, elapsed, cameraSystem.camera, lightingSystem.activePresetId === 'midnight');
    if (warmedUp) updateSceneCulling(cameraSystem.camera.position); // the warm-up frame draws every chunk

    // Render frame via TSL RenderPipeline (SSR + Bloom)
    if (!warmedUp) {
      // First frame = pipeline warm-up behind the loading screen, for what precompileShaders() can't reach (the shadow
      // map passes): with frustum culling off, every visible material's pipelines compile now instead of stalling the
      // first time the camera turns towards it (one chunk / shadow stand-in per shared pipeline is enough)
      const culled = [];
      const pipelines = new Set();
      scene.traverseVisible((o) => {
        const pipeline = o.userData.sharesPipelineWith || o;
        if (pipelines.has(pipeline)) return;
        pipelines.add(pipeline);
        if (o.frustumCulled) {
          culled.push(o);
          o.frustumCulled = false;
        }
      });
      renderPipeline.render();
      for (const o of culled) o.frustumCulled = true;
      markInit('warmup');
    }
    renderPipeline.render();
    photo.afterRender();
    if (!warmedUp) {
      warmedUp = true;
      markInit('firstFrame');
      // The loading screen stays up until the GPU has got through the first frame (and the pipelines its warm-up
      // compiled), i.e. until the city is actually on screen
      const device = renderer.backend.device;
      Promise.resolve(device && device.queue.onSubmittedWorkDone()).catch(() => {}).then(() => {
        markInit('gpu');
        console.log(`[init] ${initTimings.join(', ')}`);
        initTimings = null;
        if (loadingOverlay) loadingOverlay.classList.add('hidden');
        audioSystem.ready = true;
        setLoadingProgress(1);
      });
    }

    // Telemetry uses wall time, not the clamped simulation step, so slow frames and high-refresh displays report
    // their actual frame rate (updates DOM every 250ms).
    frameCount++;
    fpsTimer += Math.max(0, rawDt);
    if (fpsTimer >= 0.25) {
      const currentFps = Math.round(frameCount / fpsTimer);
      frameCount = 0;
      fpsTimer = 0;

      const activeEnt = controllerManager.getActiveEntity();
      const mode = controllerManager.activeMode;
      const kmh = Math.round(Math.abs(activeEnt.speed) * 3.6);
      const altM = Math.max(0, Math.round(activeEnt.position.y - groundY(activeEnt.position.x, activeEnt.position.z))); // above the ground

      if (elFps) {
        elFps.textContent = String(currentFps);
        elFps.className = currentFps >= 50 ? 'fps-ok' : currentFps >= 30 ? 'fps-warn' : 'fps-bad';
      }
      if (elSpeed) elSpeed.textContent = String(kmh);
      if (elLimit) {
        elLimit.hidden = mode !== 'car';
        elLimit.textContent = String(speedLimit);
      }
      if (elSpeedMeter) elSpeedMeter.style.transform = `scaleX(${Math.min(1, kmh / (topSpeedKmh[mode] || 130))})`;
      document.body.classList.toggle('is-boosting', controllerManager.keys.boost && kmh > 0);
      if (elAltitude) elAltitude.textContent = altM.toLocaleString('pl-PL');
      // The street corner of the player on the follow cameras, of the camera itself on the scenic ones
      const where = cameraSystem.getActivePreset().category === 'follow' ? activeEnt.position : cameraSystem.currentPos;
      renderLocation(getLocationLabel(where.x, where.z));
      renderMission();
    }
  });
}

initApp();
