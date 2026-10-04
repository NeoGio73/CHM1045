// The 3D side of the game: the map, the molecule, the turrets and the device.
// main.js drives it through the object returned by createWorld().

import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { settle, BOND, LONE } from './vsepr.js';
import { CONFIG, ELEMENTS, MODELS, CHAMBERS } from './content.js';
import { ROOMS } from './rooms.js';

const BLUE = 0x1e9bff;
const ORANGE = 0xff8a1e;
const CORE_RADIUS = 0.42;
const BOND_LENGTH = 1.3;
const ATOM_RADIUS = 0.27;
const MOLECULE_SCALE = 0.7; // shrink the whole molecule to suit the rooms
const NARRATOR_SCALE = 0.7;
const MAX_TURRETS = 4;
const UP = new THREE.Vector3(0, 1, 0);
const DOWN = new THREE.Vector3(0, -1, 0);

const easeOutBack = (t) => 1 + 2.7 * Math.pow(t - 1, 3) + 1.7 * Math.pow(t - 1, 2);

// Darken thin lines on a 64-unit grid so flat walls read as test-chamber panels.
function addPanelLines(material) {
  material.onBeforeCompile = (shader) => {
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vPanelPos;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvPanelPos = (modelMatrix * vec4(transformed, 1.0)).xyz;');
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vPanelPos;')
      .replace('#include <color_fragment>', `#include <color_fragment>
        {
          vec3 pp = vPanelPos / 1.2192;
          pp.y -= 0.5;
          vec3 pn = abs(normalize(cross(dFdx(vPanelPos), dFdy(vPanelPos))));
          vec2 puv = pn.y > 0.7 ? pp.xz : (pn.x > 0.7 ? pp.zy : pp.xy);
          vec2 pg = abs(fract(puv - 0.5) - 0.5);
          vec2 pw = fwidth(puv) * 1.2 + 0.006;
          float pl = min(smoothstep(0.0, pw.x, pg.x), smoothstep(0.0, pw.y, pg.y));
          diffuseColor.rgb *= mix(0.74, 1.0, pl);
        }`);
  };
}

function textSprite(text, { color = '#ffffff', size = 0.3 } = {}) {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d');
  g.font = `700 ${text.length > 1 ? 68 : 84}px system-ui, "Segoe UI", sans-serif`;
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.lineWidth = 12;
  g.strokeStyle = 'rgba(10, 14, 20, 0.85)';
  g.strokeText(text, 64, 68);
  g.fillStyle = color;
  g.fillText(text, 64, 68);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true }));
  sprite.scale.setScalar(size);
  return sprite;
}

function radialTexture(inner, outer) {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d');
  const grad = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  grad.addColorStop(0, inner);
  grad.addColorStop(1, outer);
  g.fillStyle = grad;
  g.fillRect(0, 0, 128, 128);
  return new THREE.CanvasTexture(c);
}

// --- Props. Every model file is 1 unit along its longest side. The numbers here
// turn each one to face +z and size it for the chambers. ---

const CORE_MODEL_SCALE = 1.16; // makes the ball of the core about CORE_RADIUS
const TURRET_HEIGHT = { turret: 1.2, 'turret-defective': 0.93 };
const DEVICE_LENGTH = 0.42;

function makeCore(model) {
  const core = new THREE.Group();
  model.rotation.y = -Math.PI / 2; // the eye is on the +x side of the model
  model.scale.setScalar(CORE_MODEL_SCALE);
  core.add(model);
  return core;
}

function makeTurret(model, height) {
  const turret = new THREE.Group();
  model.scale.setScalar(height);
  turret.add(model);
  turret.updateMatrixWorld(true);
  // The eye has its own material: use it to find where the laser starts, and
  // give each turret a private copy so its eye can be switched off alone.
  const eyeBox = new THREE.Box3();
  let eyeMat = null;
  model.traverse((o) => {
    if (!o.isMesh || o.material.name !== 'turret_eye') return;
    o.material = o.material.clone();
    eyeMat = o.material;
    eyeBox.expandByObject(o);
  });
  const eye = new THREE.Object3D();
  if (eyeMat) eyeBox.getCenter(eye.position);
  else eye.position.set(0, height * 0.7, height * 0.15);
  turret.add(eye);
  const laser = new THREE.Line(
    new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3(0, 0, 1)]),
    new THREE.LineBasicMaterial({ color: 0xff3020, transparent: true, opacity: 0.85 }),
  );
  laser.frustumCulled = false;
  turret.userData = { eye, eyeMat, laser, active: false, disabled: false, tip: 0, baseY: 0, side: 1 };
  return turret;
}

function makeDevice(model) {
  const device = new THREE.Group();
  model.rotation.y = Math.PI; // the barrel is on the +z side of the model; the camera looks down -z
  model.scale.setScalar(DEVICE_LENGTH);
  // the glass tube and a glow at the muzzle show the colour of the last shot
  const tubeMat = new THREE.MeshBasicMaterial({ color: BLUE, transparent: true, opacity: 0.75 });
  model.traverse((o) => { if (o.isMesh && o.material.name === 'portalgun_glass') o.material = tubeMat; });
  const glowMat = new THREE.SpriteMaterial({ map: radialTexture('rgba(255,255,255,0.9)', 'rgba(255,255,255,0)'), color: BLUE, transparent: true, opacity: 0.85, depthWrite: false });
  const glow = new THREE.Sprite(glowMat);
  const muzzle = new THREE.Vector3(0, 0, -DEVICE_LENGTH / 2);
  glow.position.copy(muzzle);
  glow.scale.setScalar(0.05);
  device.add(model, glow);
  device.userData = { recoil: 0, muzzle, setColor: (c) => { tubeMat.color.set(c); glowMat.color.set(c); } };
  return device;
}

export async function createWorld(canvas, stage, onProgress = () => {}) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x0b0d11);
  const camera = new THREE.PerspectiveCamera(62, 1, 0.05, 250);
  scene.add(camera);

  scene.add(new THREE.HemisphereLight(0xffffff, 0x9aa0aa, 1.5));
  const key = new THREE.DirectionalLight(0xffffff, 1.3);
  key.position.set(3, 8, 6);
  scene.add(key);
  const lamp = new THREE.PointLight(0xffffff, 14, 14, 1.6);
  scene.add(lamp);

  // soft reflections so the metal parts of the models do not render black
  scene.environment = new THREE.PMREMGenerator(renderer).fromScene(new RoomEnvironment(), 0.04).texture;
  scene.environmentIntensity = 0.35;

  // --- map and models ---
  const subjects = CHAMBERS.flatMap((c) => c.subjects);
  const loader = new GLTFLoader();
  const files = [...new Set(['map', MODELS.device, MODELS.narrator, ...MODELS.turrets, ...subjects.map((s) => s.core)])];
  let loaded = 0;
  const assets = Object.fromEntries(await Promise.all(files.map(async (name) => {
    const gltf = await loader.loadAsync(`assets/${name}.glb`);
    onProgress(++loaded / files.length);
    return [name, gltf.scene];
  })));
  const seen = new Set();
  assets.map.traverse((o) => {
    if (!o.isMesh || seen.has(o.material)) return;
    const m = o.material;
    seen.add(m);
    m.metalness = 0;
    m.roughness = 0.85;
    if (m.transparent) m.depthWrite = false;
    if (m.emissiveIntensity > 2) m.emissiveIntensity = 2;
    if (/^(PLASTIC\/PLASTICWALL|CONCRETE\/|METAL\/METALWALL|METAL\/METAL_MODULAR)/.test(m.name)) addPanelLines(m);
  });
  scene.add(assets.map);
  scene.updateMatrixWorld(true);

  const controls = new OrbitControls(camera, canvas);
  controls.enablePan = false;
  controls.enableDamping = true;
  controls.dampingFactor = 0.09;
  controls.minDistance = 2.1;
  controls.maxDistance = 4.6;
  controls.minPolarAngle = 0.3;
  controls.maxPolarAngle = Math.PI - 0.55;

  // --- the room in use (filled in by enterChamber) ---
  const center = new THREE.Vector3();
  const boxMin = new THREE.Vector3();
  const boxMax = new THREE.Vector3();
  const cameraStart = new THREE.Vector3();
  const away = new THREE.Vector3(); // from the starting camera towards the molecule, level
  const side = new THREE.Vector3();
  const narratorSpot = new THREE.Vector3();
  let floorY = 0;

  const mapRay = new THREE.Raycaster();
  const normal = new THREE.Vector3();
  function floorBelow(x, y, z) {
    mapRay.set(new THREE.Vector3(x, y, z), DOWN);
    mapRay.far = 30;
    for (const hit of mapRay.intersectObject(assets.map, true)) {
      normal.copy(hit.face.normal).transformDirection(hit.object.matrixWorld);
      if (normal.y > 0.5) return hit.point.y;
    }
    return y - 2.4;
  }

  // --- molecule ---
  const molecule = new THREE.Group();
  molecule.scale.setScalar(MOLECULE_SCALE);
  scene.add(molecule);
  const core = new THREE.Group(); // turns so the eye follows the viewer
  molecule.add(core);
  const coreModels = {};
  for (const s of subjects) {
    if (coreModels[s.core]) continue;
    coreModels[s.core] = makeCore(assets[s.core]);
    coreModels[s.core].visible = false;
    core.add(coreModels[s.core]);
  }
  let coreLabel = null;

  // the supervising core watches from its perch and bobs when it speaks
  const narrator = makeCore(assets[MODELS.narrator].clone(true));
  narrator.scale.setScalar(NARRATOR_SCALE);
  scene.add(narrator);
  const narratorLook = new THREE.Object3D();
  let speaking = 0;

  const shadow = new THREE.Mesh(
    new THREE.CircleGeometry(1.4, 40),
    new THREE.MeshBasicMaterial({ map: radialTexture('rgba(0,0,0,0.38)', 'rgba(0,0,0,0)'), transparent: true, depthWrite: false }),
  );
  shadow.rotation.x = -Math.PI / 2;
  scene.add(shadow);

  const stickGeo = new THREE.CylinderGeometry(0.06, 0.06, 1, 16).translate(0, 0.5, 0);
  const atomGeo = new THREE.SphereGeometry(ATOM_RADIUS, 32, 24);
  const lobeGeo = new THREE.SphereGeometry(1, 32, 24);
  const dotGeo = new THREE.SphereGeometry(0.07, 16, 12);
  const stickMat = new THREE.MeshStandardMaterial({ color: 0xcfe9ff, emissive: BLUE, emissiveIntensity: 0.55, roughness: 0.4 });
  const lobeMat = new THREE.MeshStandardMaterial({ color: ORANGE, emissive: ORANGE, emissiveIntensity: 0.35, transparent: true, opacity: 0.62, depthWrite: false, roughness: 0.3 });
  const dotMat = new THREE.MeshBasicMaterial({ color: 0x2a1300 });
  const atomMats = {};
  const atomMat = (el) => (atomMats[el] ??= new THREE.MeshStandardMaterial({ color: ELEMENTS[el].color, roughness: 0.3 }));
  const labels = new THREE.Group();
  scene.add(labels);

  let terminals = [{ el: 'F', order: 1 }];
  const domains = []; // { type, dir, target, group, age, label, reach }
  const leaving = [];
  const listeners = new Set();
  const notify = (event) => listeners.forEach((fn) => fn(event));

  // A bond is drawn as one, two or three sticks; it is still one electron domain.
  const STICK_OFFSETS = { 1: [0], 2: [-0.075, 0.075], 3: [-0.115, 0, 0.115] };

  function buildDomain(type, atom) {
    const group = new THREE.Group();
    let label = null;
    let reach = 0;
    if (type === BOND) {
      const size = ELEMENTS[atom.el].size ?? 1;
      reach = BOND_LENGTH * (size < 1 ? 0.9 : 1);
      for (const x of STICK_OFFSETS[atom.order] ?? STICK_OFFSETS[1]) {
        const stick = new THREE.Mesh(stickGeo, stickMat);
        stick.position.set(x, CORE_RADIUS - 0.04, 0);
        stick.scale.set(atom.order > 1 ? 0.7 : 1, reach - CORE_RADIUS, atom.order > 1 ? 0.7 : 1);
        group.add(stick);
      }
      const ball = new THREE.Mesh(atomGeo, atomMat(atom.el));
      ball.position.y = reach;
      ball.scale.setScalar(size);
      group.add(ball);
      label = textSprite(atom.el, { size: 0.26 * MOLECULE_SCALE * Math.max(size, 0.85) });
      label.userData.offset = (ATOM_RADIUS * size + 0.03) * MOLECULE_SCALE;
      labels.add(label);
    } else {
      const lobe = new THREE.Mesh(lobeGeo, lobeMat);
      lobe.scale.set(0.33, 0.47, 0.33);
      lobe.position.y = 0.78;
      lobe.renderOrder = 2;
      const a = new THREE.Mesh(dotGeo, dotMat);
      const b = new THREE.Mesh(dotGeo, dotMat);
      a.position.set(-0.11, 0.95, 0);
      b.position.set(0.11, 0.95, 0);
      group.add(lobe, a, b);
    }
    group.scale.setScalar(0.001);
    molecule.add(group);
    return { group, label, reach };
  }

  function retarget() {
    if (!domains.length) return false;
    const before = domains.map((d) => d.target.clone());
    const targets = settle(domains.map((d) => d.dir.toArray()), domains.map((d) => d.type));
    domains.forEach((d, i) => d.target.fromArray(targets[i]));
    // Report whether existing domains had to move noticeably to make room.
    return domains.some((d, i) => i < before.length - 1 && before[i].angleTo(d.target) > 0.25);
  }

  function addDomain(type, hitDir) {
    const dir = hitDir.clone();
    for (let tries = 0; tries < 8 && domains.some((d) => d.dir.dot(dir) > 0.96); tries++) {
      dir.add(new THREE.Vector3().randomDirection().multiplyScalar(0.35)).normalize();
    }
    // outer atoms are handed out in the order the subject lists them
    const bondsSoFar = domains.filter((d) => d.type === BOND).length;
    const atom = terminals[Math.min(bondsSoFar, terminals.length - 1)];
    const { group, label, reach } = buildDomain(type, atom);
    domains.push({ type, dir, target: dir.clone(), group, label, reach, age: 0 });
    const shuffled = retarget();
    notify({ kind: 'added', type, shuffled });
  }

  function dismiss(d) {
    d.leavingFor = 0;
    leaving.push(d);
  }

  function removeLast() {
    const d = domains.pop();
    if (!d) return false;
    dismiss(d);
    retarget();
    notify({ kind: 'removed' });
    return true;
  }

  function clearDomains() {
    const had = domains.length > 0;
    while (domains.length) dismiss(domains.pop());
    while (shots.length) scene.remove(shots.pop().mesh); // anything still in flight
    notify({ kind: 'cleared' });
    return had;
  }

  function counts() {
    const bonds = domains.filter((d) => d.type === BOND).length;
    return { bonds, lone: domains.length - bonds, total: domains.length };
  }

  function showCore(subject, withLabel) {
    for (const [name, model] of Object.entries(coreModels)) model.visible = name === subject.core;
    if (coreLabel) { labels.remove(coreLabel); coreLabel.material.map.dispose(); coreLabel = null; }
    if (!withLabel) return;
    coreLabel = textSprite(subject.central, { size: 0.34 * MOLECULE_SCALE });
    labels.add(coreLabel);
  }

  function setSubject(subject) {
    clearDomains();
    terminals = subject.terminals;
    showCore(subject, true);
  }

  // --- device and shots ---
  const device = makeDevice(assets[MODELS.device]);
  camera.add(device);
  const shots = [];
  const shotGeo = new THREE.SphereGeometry(0.08, 16, 12);
  const glowTex = radialTexture('rgba(255,255,255,0.9)', 'rgba(255,255,255,0)');

  function fire(type) {
    if (domains.length + shots.length >= CONFIG.maxDomains) { notify({ kind: 'overflow' }); return false; }
    const color = type === BOND ? BLUE : ORANGE;
    device.userData.setColor(color);
    device.userData.recoil = 1;
    const from = device.localToWorld(device.userData.muzzle.clone());
    const hit = from.clone().sub(center).normalize();
    const mesh = new THREE.Mesh(shotGeo, new THREE.MeshBasicMaterial({ color }));
    const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, color, transparent: true, opacity: 0.6, blending: THREE.AdditiveBlending, depthWrite: false }));
    glow.scale.setScalar(0.34);
    mesh.add(glow);
    mesh.position.copy(from);
    scene.add(mesh);
    shots.push({ mesh, from, to: center.clone().addScaledVector(hit, CORE_RADIUS * MOLECULE_SCALE), hit, type, t: 0 });
    return true;
  }

  // --- turrets: one per subject, standing behind the molecule ---
  const usedTurretModels = new Set();
  const turrets = Array.from({ length: MAX_TURRETS }, (_, i) => {
    const name = MODELS.turrets[i % MODELS.turrets.length];
    const model = usedTurretModels.has(name) ? assets[name].clone(true) : assets[name];
    usedTurretModels.add(name);
    const t = makeTurret(model, TURRET_HEIGHT[name] ?? 1.2);
    t.userData.side = i === 0 ? 1 : -1; // which way it falls
    t.visible = false;
    scene.add(t, t.userData.laser);
    return t;
  });
  let alarm = 0;

  function setTurretDisabled(index, disabled) {
    const u = turrets[index].userData;
    u.disabled = disabled;
    if (u.eyeMat) u.eyeMat.emissiveIntensity = disabled ? 0 : 1;
  }

  function enterChamber(chamber) {
    const room = ROOMS[chamber.room];
    center.fromArray(room.center);
    boxMin.fromArray(room.min);
    boxMax.fromArray(room.max);
    cameraStart.fromArray(room.camera);
    away.set(center.x - cameraStart.x, 0, center.z - cameraStart.z).normalize();
    side.set(-away.z, 0, away.x);
    floorY = floorBelow(center.x, center.y, center.z);

    clearDomains();
    showCore(chamber.subjects[0], false);
    molecule.position.copy(center);
    shadow.position.set(center.x, floorY + 0.02, center.z);
    lamp.position.copy(center).add(new THREE.Vector3(-0.8, 1.7, 1.2));
    lamp.intensity = room.lamp ?? 14;
    controls.target.copy(center);
    camera.position.copy(cameraStart);
    controls.update();

    const count = Math.min(chamber.subjects.length, MAX_TURRETS);
    turrets.forEach((t, i) => {
      const u = t.userData;
      u.active = i < count;
      u.tip = 0;
      t.visible = u.active;
      u.laser.visible = u.active;
      setTurretDisabled(i, false);
      if (!u.active) return;
      let x; let z;
      if (room.turrets?.[i]) [x, z] = room.turrets[i];
      else {
        const along = (i - (count - 1) / 2) * 1.9;
        x = center.x + away.x * 2.8 + side.x * along;
        z = center.z + away.z * 2.8 + side.z * along;
      }
      u.baseY = floorBelow(x, center.y, z);
      t.position.set(x, u.baseY, z);
      t.rotation.set(0, Math.atan2(cameraStart.x - x, cameraStart.z - z), 0);
    });

    if (room.narrator) narratorSpot.fromArray(room.narrator);
    else narratorSpot.copy(center).addScaledVector(away, 1.2).addScaledVector(side, -3.0).clamp(boxMin, boxMax);
    narrator.position.copy(narratorSpot);
    narratorLook.position.copy(narratorSpot);
  }

  // --- frame loop ---
  const clock = new THREE.Clock();
  const tmp = new THREE.Vector3();
  const look = new THREE.Object3D();
  molecule.add(look);

  function placeDevice() {
    const d = 0.72;
    const h = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) * d;
    const w = h * camera.aspect;
    device.visible = camera.aspect > 0.8;
    device.position.set(Math.min(w * 0.7, 0.6), -h * 0.7, -d + device.userData.recoil * 0.05);
    device.rotation.set(0.12, 0.38, 0);
  }

  function resize() {
    const w = stage.clientWidth;
    const h = stage.clientHeight;
    if (!w || !h) return;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }
  new ResizeObserver(resize).observe(stage);
  resize();

  let time = 0;
  function step(dt) {
    time += dt;

    controls.update();
    camera.position.clamp(boxMin, boxMax);
    camera.lookAt(center);
    camera.updateMatrixWorld();

    device.userData.recoil = Math.max(0, device.userData.recoil - dt * 6);
    placeDevice();

    // the core's eye follows the viewer
    look.lookAt(camera.position);
    core.quaternion.slerp(look.quaternion, 1 - Math.exp(-dt * 4));
    molecule.position.y = center.y + Math.sin(time * 1.1) * 0.03;

    narratorLook.lookAt(camera.position);
    narrator.quaternion.slerp(narratorLook.quaternion, 1 - Math.exp(-dt * 3));
    speaking = Math.max(0, speaking - dt * 1.6);
    narrator.position.y = narratorSpot.y + Math.abs(Math.sin(speaking * Math.PI * 3)) * speaking * 0.07;

    const follow = 1 - Math.exp(-dt * 5.5);
    for (const d of domains) {
      d.age += dt;
      const angle = d.dir.angleTo(d.target);
      if (angle > 1e-4) {
        tmp.crossVectors(d.dir, d.target);
        if (tmp.lengthSq() < 1e-8) tmp.set(d.dir.y, -d.dir.x, 0).cross(d.dir); // opposite: any perpendicular axis
        d.dir.applyAxisAngle(tmp.normalize(), angle * follow).normalize();
      }
      d.group.quaternion.setFromUnitVectors(UP, d.dir);
      d.group.scale.setScalar(easeOutBack(Math.min(d.age / 0.4, 1)));
    }
    for (let i = leaving.length - 1; i >= 0; i--) {
      const d = leaving[i];
      d.leavingFor += dt;
      const s = Math.max(1 - d.leavingFor / 0.22, 0);
      d.group.scale.setScalar(s);
      if (d.label) d.label.visible = false;
      if (s === 0) {
        molecule.remove(d.group);
        if (d.label) { labels.remove(d.label); d.label.material.map.dispose(); d.label.material.dispose(); }
        leaving.splice(i, 1);
      }
    }
    // element labels sit on the side of each atom that faces the viewer
    for (const d of domains) {
      if (!d.label) continue;
      d.label.position.copy(molecule.position).addScaledVector(d.dir, d.reach * d.group.scale.x * MOLECULE_SCALE);
      tmp.subVectors(camera.position, d.label.position).normalize();
      d.label.position.addScaledVector(tmp, d.label.userData.offset);
    }
    if (coreLabel) {
      coreLabel.position.copy(molecule.position);
      tmp.subVectors(camera.position, molecule.position).normalize();
      coreLabel.position.addScaledVector(tmp, (CORE_RADIUS + 0.08) * MOLECULE_SCALE);
      coreLabel.position.y -= 0.36 * MOLECULE_SCALE; // below the eye
    }

    for (let i = shots.length - 1; i >= 0; i--) {
      const s = shots[i];
      s.t += dt / 0.24;
      s.mesh.position.lerpVectors(s.from, s.to, Math.min(s.t, 1));
      if (s.t >= 1) {
        scene.remove(s.mesh);
        s.mesh.material.dispose();
        shots.splice(i, 1);
        addDomain(s.type, s.hit);
      }
    }

    alarm = Math.max(0, alarm - dt);
    turrets.forEach((t, i) => {
      const u = t.userData;
      if (!u.active) return;
      u.tip += ((u.disabled ? 1 : 0) - u.tip) * (1 - Math.exp(-dt * 5));
      t.rotation.z = u.tip * 1.48 * u.side;
      t.position.y = u.baseY + u.tip * 0.2;
      u.laser.visible = !u.disabled;
      if (!u.disabled) {
        const from = u.eye.getWorldPosition(tmp);
        const pos = u.laser.geometry.attributes.position;
        pos.setXYZ(0, from.x, from.y, from.z);
        if (alarm > 0) {
          pos.setXYZ(1, camera.position.x, camera.position.y - 0.12, camera.position.z);
        } else {
          // idle: sweep a spot on the floor between the molecule and the viewer
          const sweep = Math.sin(time * 0.7 + i * 2.1) * 0.9;
          const reach = 1.4 + Math.cos(time * 0.5 + i) * 0.6;
          pos.setXYZ(1, center.x - away.x * reach + side.x * sweep, floorY + 0.02, center.z - away.z * reach + side.z * sweep);
        }
        pos.needsUpdate = true;
      }
    });

    renderer.render(scene, camera);
  }
  renderer.setAnimationLoop(() => step(Math.min(clock.getDelta(), 0.05)));

  return {
    canvas,
    fire,
    undo: removeLast,
    clear: clearDomains,
    counts,
    enterChamber,
    setSubject,
    setTurretDisabled,
    raiseAlarm: () => { alarm = 1.4; },
    speak: () => { speaking = 1; },
    resetView: () => { camera.position.copy(cameraStart); controls.update(); },
    onChange: (fn) => { listeners.add(fn); },
    // for checking the result while developing
    debug: {
      scene, camera, controls, domains, turrets, narrator, THREE,
      advance: (seconds) => { for (let t = 0; t < seconds; t += 1 / 60) step(1 / 60); },
    },
  };
}
