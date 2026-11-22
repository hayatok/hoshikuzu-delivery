import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

const ISLAND_R = 29, TOTAL = 8, TIME_LIMIT = 120, HOVER_Y = 1.4;
const GOAL = { x: 0, z: -22, r: 6 }; // 灯台の配達判定半径
const app = document.getElementById('app');
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x342a5e);
scene.fog = new THREE.Fog(0x4a3566, 55, 130);
const camera = new THREE.PerspectiveCamera(55, innerWidth / innerHeight, 0.1, 400);
camera.position.set(0, 18, 24);
const renderer = new THREE.WebGLRenderer({ antialias: true });
window.__gameBooted = true;
renderer.setSize(innerWidth, innerHeight);
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
app.appendChild(renderer.domElement);

scene.add(new THREE.HemisphereLight(0xffd9a0, 0x33406e, 1.1));
const sun = new THREE.DirectionalLight(0xffb36b, 1.8);
sun.position.set(-30, 38, -18); sun.castShadow = true;
sun.shadow.camera.left = -40; sun.shadow.camera.right = 40; sun.shadow.camera.top = 40; sun.shadow.camera.bottom = -40;
scene.add(sun);
const beaconLight = new THREE.PointLight(0xffe27a, 60, 40); beaconLight.position.set(0, 13, -22); scene.add(beaconLight);

// stars in the sky
{
  const g = new THREE.BufferGeometry(), pts = [];
  for (let i = 0; i < 600; i++) { const a = Math.random() * Math.PI * 2, r = 90 + Math.random() * 60, y = 25 + Math.random() * 70; pts.push(Math.cos(a) * r, y, Math.sin(a) * r); }
  g.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
  scene.add(new THREE.Points(g, new THREE.PointsMaterial({ color: 0xfff6c9, size: 0.7 })));
}
// sea plane far below
{
  const sea = new THREE.Mesh(new THREE.CircleGeometry(160, 40), new THREE.MeshStandardMaterial({ color: 0x27356e, roughness: 1 }));
  sea.rotation.x = -Math.PI / 2; sea.position.y = -6; scene.add(sea);
}

const loader = new GLTFLoader();
async function loadModel(name, fallback) {
  try { const g = await loader.loadAsync(`${import.meta.env.BASE_URL}models/${name}.glb`); return g.scene; }
  catch (e) { console.warn('model fallback', name, e); return fallback(); }
}
const mat = (c, o = {}) => new THREE.MeshStandardMaterial({ color: c, roughness: .85, ...o });
function fbIsland() { const grp = new THREE.Group(); const d = new THREE.Mesh(new THREE.CylinderGeometry(29, 24, 3, 28), mat(0x69b96a)); d.position.y = -0.5; grp.add(d); const s = new THREE.Mesh(new THREE.CylinderGeometry(31, 29, 1.2, 28), mat(0xe8cf9a)); s.position.y = -1.4; grp.add(s); return grp; }
function fbDrone() { const grp = new THREE.Group(); const b = new THREE.Mesh(new THREE.SphereGeometry(.8, 20, 14), mat(0xffffff)); b.scale.y = .65; grp.add(b); const eye = new THREE.Mesh(new THREE.SphereGeometry(.42, 16, 12), mat(0x66ccff, { emissive: 0x2266aa })); eye.position.set(0, .18, .55); grp.add(eye); return grp; }
function fbSimple(geo, c) { return () => { const grp = new THREE.Group(); grp.add(new THREE.Mesh(geo, mat(c))); return grp; }; }

// fixed layout
const TREES = [[-14,-8],[10,-14],[18,4],[-20,6],[-8,16],[14,16],[22,-10],[-24,-14],[6,22],[-16,-20],[24,12],[0,-6]];
const ROCKS = [[-10,-16],[16,-4],[-22,14],[8,8],[-4,-22],[20,20],[-26,-2],[12,-22]];
const HOUSES = [[-12,10,0.5],[16,10,-0.4],[4,-14,0.1]];
const CRYSTALS = [[-18,-10],[12,-18],[20,8],[-8,20],[0,10],[-24,2],[8,-6],[18,20]];
const colliders = [];
let crystals = [];

const player = new THREE.Group(); scene.add(player);
let droneVisual = null;

async function buildWorld() {
  const island = await loadModel('island', fbIsland); scene.add(island);
  const lighthouse = await loadModel('lighthouse', fbSimple(new THREE.CylinderGeometry(1.6, 2.2, 9, 12), 0xffffff));
  lighthouse.position.set(GOAL.x, 1.0, GOAL.z); scene.add(lighthouse); colliders.push({ x: GOAL.x, z: GOAL.z, r: 3.2, goal: true });
  for (const [x, z] of TREES) { const t = await loadModel('tree', fbSimple(new THREE.ConeGeometry(1.6, 4.5, 8), 0x2e8b57)); t.position.set(x, 1.0, z); t.rotation.y = Math.random() * 6; scene.add(t); colliders.push({ x, z, r: 1.1 }); }
  for (const [x, z] of ROCKS) { const r = await loadModel('rock', fbSimple(new THREE.IcosahedronGeometry(1.3, 0), 0x8d8d99)); r.position.set(x, 1.0, z); r.rotation.set(Math.random(), Math.random(), Math.random()); scene.add(r); colliders.push({ x, z, r: 1.5 }); }
  for (const [x, z, ry] of HOUSES) { const h = await loadModel('house', fbSimple(new THREE.BoxGeometry(3.4, 2.6, 3), 0xffe6bd)); h.position.set(x, 1.0, z); h.rotation.y = ry; scene.add(h); colliders.push({ x, z, r: 2.6 }); }
  droneVisual = await loadModel('drone', fbDrone); player.add(droneVisual);
  for (const [x, z] of CRYSTALS) {
    const c = await loadModel('crystal', fbSimple(new THREE.OctahedronGeometry(0.8, 0), 0x7ee8ff));
    c.position.set(x, 2, z); c.userData.home = { x, z }; scene.add(c); crystals.push(c);
  }
}

// game state
let state = 'title', collected = 0, timeLeft = TIME_LIMIT, vy = 0, msgTimer = 0;
const vel = new THREE.Vector3();
const keys = {};
addEventListener('keydown', e => { keys[e.code] = true; if (e.code === 'Space') e.preventDefault(); });
addEventListener('keyup', e => keys[e.code] = false);

// touch input (virtual joystick + buttons), merged with keyboard in animate()
const touch = { x: 0, y: 0, dash: false, jump: false };
{
  const joy = document.getElementById('joystick'), knob = document.getElementById('joystick-knob');
  let joyId = null;
  const setJoy = e => {
    const r = joy.getBoundingClientRect(), cx = r.left + r.width / 2, cy = r.top + r.height / 2;
    let dx = e.clientX - cx, dy = e.clientY - cy;
    const max = r.width / 2 - 8, len = Math.hypot(dx, dy);
    if (len > max) { dx *= max / len; dy *= max / len; }
    touch.x = dx / max; touch.y = dy / max;
    knob.style.transform = `translate(${dx}px, ${dy}px)`;
  };
  const resetJoy = () => { joyId = null; touch.x = 0; touch.y = 0; knob.style.transform = ''; };
  joy.addEventListener('pointerdown', e => { joyId = e.pointerId; joy.setPointerCapture(joyId); setJoy(e); e.preventDefault(); });
  joy.addEventListener('pointermove', e => { if (e.pointerId === joyId) setJoy(e); });
  joy.addEventListener('pointerup', resetJoy);
  joy.addEventListener('pointercancel', resetJoy);
  const bindBtn = (id, prop) => {
    const b = document.getElementById(id);
    const on = e => { touch[prop] = true; b.classList.add('active'); e.preventDefault(); };
    const off = () => { touch[prop] = false; b.classList.remove('active'); };
    b.addEventListener('pointerdown', on);
    b.addEventListener('pointerup', off);
    b.addEventListener('pointercancel', off);
    b.addEventListener('pointerleave', off);
    b.addEventListener('contextmenu', e => e.preventDefault());
  };
  bindBtn('btn-dash', 'dash');
  bindBtn('btn-jump', 'jump');
}
const $ = id => document.getElementById(id);
function say(t, sec = 3) { $('message').textContent = t; msgTimer = sec; }
function reset() {
  collected = 0; timeLeft = TIME_LIMIT; vy = 0; player.position.set(0, HOVER_Y, 14); player.rotation.set(0, 0, 0);
  for (const c of crystals) c.visible = true;
  $('count').textContent = '0'; $('timer').textContent = String(TIME_LIMIT);
}
function end(win) {
  state = win ? 'win' : 'lose';
  $('end-title').textContent = win ? '🎉 配達完了！' : '⏰ 時間切れ…';
  $('end-text').textContent = win ? `星屑を全部届けたよ！ 残り時間 ${Math.ceil(timeLeft)} 秒` : `集めた星屑は ${collected} / ${TOTAL} 個だったよ。もう一度挑戦しよう！`;
  $('end-screen').classList.remove('hidden'); $('hud').classList.add('hidden'); $('touch-controls').classList.add('hidden');
}
$('start-btn').onclick = () => { $('overlay').classList.add('hidden'); $('hud').classList.remove('hidden'); $('touch-controls').classList.remove('hidden'); reset(); state = 'play'; say('星屑を8つ集めよう！', 4); };
$('restart-btn').onclick = () => { $('end-screen').classList.add('hidden'); $('hud').classList.remove('hidden'); $('touch-controls').classList.remove('hidden'); reset(); state = 'play'; say('もう一度！星屑を集めよう！', 3); };

const clock = new THREE.Clock();
const camTarget = new THREE.Vector3();
function animate() {
  requestAnimationFrame(animate);
  const dt = Math.min(clock.getDelta(), 0.05), t = clock.elapsedTime;
  // crystals spin & bob
  for (const c of crystals) if (c.visible) { c.rotation.y += dt * 1.6; c.position.y = 2 + Math.sin(t * 2 + c.userData.home.x) * 0.35; }
  beaconLight.intensity = 50 + Math.sin(t * 3) * 18;
  if (droneVisual) droneVisual.position.y = Math.sin(t * 2.4) * 0.08;

  if (state === 'play') {
    timeLeft -= dt; if (timeLeft <= 0) { timeLeft = 0; end(false); }
    $('timer').textContent = String(Math.ceil(timeLeft));
    if (msgTimer > 0) { msgTimer -= dt; if (msgTimer <= 0) $('message').textContent = ''; }

    let fwd = (keys.KeyW || keys.ArrowUp ? 1 : 0) - (keys.KeyS || keys.ArrowDown ? 1 : 0);
    let side = (keys.KeyD || keys.ArrowRight ? 1 : 0) - (keys.KeyA || keys.ArrowLeft ? 1 : 0);
    // merge touch joystick: x = right, y = down on screen
    side += touch.x; fwd += -touch.y;
    const mlen = Math.hypot(side, fwd);
    if (mlen > 1) { side /= mlen; fwd /= mlen; }
    const dash = (keys.ShiftLeft || keys.ShiftRight || touch.dash) ? 2 : 1;
    const speed = 11 * dash;
    vel.x = side * speed; vel.z = -fwd * speed;
    const prevX = player.position.x, prevZ = player.position.z;
    player.position.x += vel.x * dt; player.position.z += vel.z * dt;
    // island edge
    const d = Math.hypot(player.position.x, player.position.z);
    if (d > ISLAND_R) { player.position.x *= ISLAND_R / d; player.position.z *= ISLAND_R / d; }
    // collisions (radius)
    for (const c of colliders) { if (c.goal && collected >= TOTAL) continue; const dd = Math.hypot(player.position.x - c.x, player.position.z - c.z); if (dd < c.r + 0.8) { player.position.x = prevX; player.position.z = prevZ; break; } }
    // face movement direction + tilt
    if (vel.lengthSq() > 0.1) { player.rotation.y = Math.atan2(vel.x, -vel.z) + Math.PI; player.rotation.z = THREE.MathUtils.lerp(player.rotation.z, -side * 0.14, 0.2); player.rotation.x = THREE.MathUtils.lerp(player.rotation.x, fwd * 0.12, 0.2); }
    // hover jump
    if ((keys.Space || touch.jump) && player.position.y <= HOVER_Y + 0.01) vy = 6.5;
    vy -= 16 * dt; player.position.y += vy * dt;
    if (player.position.y < HOVER_Y) { player.position.y = HOVER_Y; vy = 0; }
    // collect
    for (const c of crystals) if (c.visible && player.position.distanceTo(c.position) < 2.0) {
      c.visible = false; collected++; $('count').textContent = String(collected);
      say(collected >= TOTAL ? '全部集めた！灯台へ届けよう！💡' : `星屑ゲット！ あと ${TOTAL - collected} 個`, 3);
    }
    // goal
    if (collected >= TOTAL && Math.hypot(player.position.x - GOAL.x, player.position.z - GOAL.z) < GOAL.r) end(true);
  }
  // smooth follow camera
  camTarget.set(player.position.x, player.position.y + 16, player.position.z + 21);
  camera.position.lerp(camTarget, 0.06);
  camera.lookAt(player.position.x, player.position.y, player.position.z - 2);
  renderer.render(scene, camera);
}
addEventListener('resize', () => { camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix(); renderer.setSize(innerWidth, innerHeight); });

player.position.set(0, HOVER_Y, 14);
buildWorld().then(() => console.log('world ready'));
animate();
