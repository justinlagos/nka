import * as THREE from "three";

// The sky: a field of work hanging at depth in a bright, hazy sky, with clouds drifting through.
// Pieces sit in a ring around the centre so the headline stays clear. Flying forward recycles
// pieces and clouds to the back, so the field never ends.

export type SkyWork = { src: string; w: number; h: number; label: string; need: string };
export type SkyMode = "home" | "explore" | "focus";
export type SkyEvents = {
  onMode: (m: SkyMode) => void;
  onFocus: (w: SkyWork | null) => void;
  onHover: (label: string | null, x: number, y: number) => void;
  onReady: () => void;
};

const FOV = 46;
const HOME = new THREE.Vector3(0, 0, 10);
const FAR = 70; // depth of the field
const NEAR_FADE = 2.2;
const FOG = new THREE.Color("#d7e6f6");

// Hand-placed slots for the opening view, in screen units from the camera at HOME:
// u, v in -1..1 across the view, d = distance, s = height in world units. Mirrors the sketch:
// big pieces in the four corners, small ones drifting between, the centre kept clear.
// s is the length of the longer side.
const OPENING: { u: number; v: number; d: number; s: number }[] = [
  { u: -0.8, v: 0.5, d: 8.4, s: 2.6 },
  { u: -0.5, v: 0.74, d: 11.5, s: 1.25 },
  { u: -0.66, v: 0.02, d: 13, s: 1.2 },
  { u: -0.8, v: -0.56, d: 7.6, s: 2.7 },
  { u: 0.5, v: 0.76, d: 12, s: 1.2 },
  { u: 0.8, v: 0.48, d: 9, s: 2.6 },
  { u: 0.9, v: -0.04, d: 13.5, s: 1.15 },
  { u: 0.58, v: 0.06, d: 16, s: 1.0 },
  { u: 0.8, v: -0.58, d: 7.8, s: 2.7 },
  { u: -0.36, v: -0.86, d: 14, s: 1.15 },
  { u: 0.24, v: 0.9, d: 17, s: 1.05 },
  { u: 0.36, v: -0.88, d: 15, s: 1.1 },
];

function mulberry(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Tall screens: work above and below the copy instead of beside it.
const OPENING_TALL: { u: number; v: number; d: number; s: number }[] = [
  { u: -0.6, v: 0.8, d: 8.4, s: 1.7 },
  { u: 0.08, v: 0.9, d: 12, s: 1.1 },
  { u: 0.66, v: 0.76, d: 9, s: 1.7 },
  { u: -0.6, v: -0.84, d: 8.2, s: 1.8 },
  { u: 0.64, v: -0.86, d: 8.6, s: 1.8 },
  { u: 0.04, v: -0.95, d: 12.5, s: 1.1 },
  { u: -0.3, v: 0.7, d: 16, s: 0.9 },
  { u: 0.36, v: -0.72, d: 16, s: 0.9 },
];

// A point in the outer ring of the view: avoids the centre where the headline sits.
function ringPoint(rand: () => number, tall = false) {
  for (let i = 0; i < 20; i++) {
    const u = rand() * 2.2 - 1.1;
    const v = rand() * 2.0 - 1.0;
    if (tall ? Math.abs(v) > 0.66 : Math.abs(u) > 0.46 || Math.abs(v) > 0.6) return { u, v };
  }
  return { u: 0.9, v: 0.8 };
}

const VERT = /* glsl */ `
varying vec2 vUv;
varying float vDepth;
void main() {
  vUv = uv;
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  vDepth = -mv.z;
  gl_Position = projectionMatrix * mv;
}`;

const FRAG = /* glsl */ `
uniform sampler2D uMap;
uniform vec2 uSize;
uniform float uRadius;
uniform float uOpacity;
uniform float uHover;
uniform vec3 uFog;
uniform float uFogNear;
uniform float uFogFar;
uniform float uLoaded;
varying vec2 vUv;
varying float vDepth;
float rbox(vec2 p, vec2 b, float r) { vec2 q = abs(p) - b + r; return length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - r; }
void main() {
  vec2 p = (vUv - 0.5) * uSize;
  float d = rbox(p, uSize * 0.5, uRadius);
  float aa = fwidth(d);
  float mask = 1.0 - smoothstep(-aa, aa, d);
  vec3 col = mix(vec3(0.93, 0.95, 0.98), texture2D(uMap, vUv).rgb, uLoaded);
  col = mix(col, col * 1.06 + 0.02, uHover);
  float fog = smoothstep(uFogNear, uFogFar, vDepth);
  col = mix(col, uFog, fog);
  float nearFade = smoothstep(${NEAR_FADE.toFixed(1)}, ${(NEAR_FADE + 1.6).toFixed(1)}, vDepth);
  gl_FragColor = vec4(col, mask * uOpacity * nearFade);
  #include <colorspace_fragment>
}`;

// Soft cumulus texture painted on a canvas: many overlapping radial puffs with a flat-ish base.
function cloudTexture(seed: number) {
  const rand = mulberry(seed);
  const c = document.createElement("canvas");
  c.width = 512;
  c.height = 256;
  const g = c.getContext("2d")!;
  const puffs = 34;
  for (let i = 0; i < puffs; i++) {
    const t = i / puffs;
    const x = 70 + rand() * 372;
    const base = 190 - Math.sin(((x - 70) / 372) * Math.PI) * (70 + rand() * 40);
    const y = base + rand() * (200 - base);
    const r = 26 + rand() * 54 * (1 - Math.abs(t - 0.5));
    const grad = g.createRadialGradient(x, y - r * 0.2, 0, x, y, r);
    grad.addColorStop(0, "rgba(255,255,255,0.62)");
    grad.addColorStop(0.5, "rgba(250,252,255,0.32)");
    grad.addColorStop(1, "rgba(240,246,252,0)");
    g.fillStyle = grad;
    g.beginPath();
    g.arc(x, y, r, 0, Math.PI * 2);
    g.fill();
  }
  // Cool shading on the underside.
  const under = g.createLinearGradient(0, 120, 0, 240);
  under.addColorStop(0, "rgba(200,214,232,0)");
  under.addColorStop(1, "rgba(184,202,226,0.35)");
  g.globalCompositeOperation = "source-atop";
  g.fillStyle = under;
  g.fillRect(0, 0, 512, 256);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

type Piece = {
  mesh: THREE.Mesh<THREE.PlaneGeometry, THREE.ShaderMaterial>;
  work: SkyWork;
  base: THREE.Vector3;
  phase: number;
  hover: number;
};
type Cloud = { sprite: THREE.Sprite; drift: number; phase: number };

export function createSky(host: HTMLElement, works: SkyWork[], ev: SkyEvents) {
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const small = window.innerWidth < 760;
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: "high-performance" });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, small ? 1.5 : 1.75));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.setClearColor(0x000000, 0);
  host.appendChild(renderer.domElement);
  renderer.domElement.className = "sky-gl";

  const scene = new THREE.Scene();
  scene.fog = new THREE.Fog(FOG, 24, FAR + 30);
  const camera = new THREE.PerspectiveCamera(FOV, 1, 0.1, 220);
  camera.position.copy(HOME);

  const rand = mulberry(7);
  const loader = new THREE.TextureLoader();
  const maxAniso = renderer.capabilities.getMaxAnisotropy();

  // Each work appears twice in the field so it feels full; the first eleven take the opening slots.
  const count = small ? Math.max(works.length, 18) : works.length * 2;
  const pieces: Piece[] = [];
  const textures = new Map<string, THREE.Texture>();
  const loadedUniforms = new Map<string, { value: number }[]>();

  for (let i = 0; i < count; i++) {
    const work = works[i % works.length];
    const aspect = work.w / work.h;
    const loaded = { value: 0 };
    if (!loadedUniforms.has(work.src)) loadedUniforms.set(work.src, []);
    loadedUniforms.get(work.src)!.push(loaded);
    const mat = new THREE.ShaderMaterial({
      vertexShader: VERT,
      fragmentShader: FRAG,
      transparent: true,
      depthWrite: false,
      uniforms: {
        uMap: { value: null },
        uSize: { value: new THREE.Vector2(aspect, 1) },
        uRadius: { value: 0.045 },
        uOpacity: { value: 0 },
        uHover: { value: 0 },
        uFog: { value: FOG },
        uFogNear: { value: 24 },
        uFogFar: { value: FAR + 34 },
        uLoaded: loaded,
      },
    });
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(aspect, 1), mat);
    mesh.userData.index = i;
    scene.add(mesh);
    pieces.push({ mesh, work, base: new THREE.Vector3(), phase: rand() * Math.PI * 2, hover: 0 });
  }

  // Load textures in order: opening pieces first.
  let pending = new Set(works.map((w) => w.src)).size;
  const order = [...new Set(pieces.map((p) => p.work.src))];
  order.forEach((s) => {
    loader.load(s, (tex) => {
      tex.colorSpace = THREE.SRGBColorSpace;
      tex.anisotropy = Math.min(8, maxAniso);
      textures.set(s, tex);
      pieces.filter((p) => p.work.src === s).forEach((p) => (p.mesh.material.uniforms.uMap.value = tex));
      loadedUniforms.get(s)!.forEach((u) => (u.value = 1));
      pending -= 1;
      if (pending === 0) ev.onReady();
    });
  });

  const tanNow = () => Math.tan(((camera.fov / 2) * Math.PI) / 180);
  const halfH = (d: number) => d * tanNow();
  const halfW = (d: number) => d * tanNow() * camera.aspect;

  function place(p: Piece, u: number, v: number, d: number, s: number, from: THREE.Vector3) {
    p.base.set(from.x + u * halfW(d), from.y + v * halfH(d), from.z - d);
    p.mesh.position.copy(p.base);
    const aspect = p.work.w / p.work.h;
    const k = aspect > 1 ? s / aspect : s; // s is the longer side
    p.mesh.scale.setScalar(k);
    p.mesh.userData.s = k;
    p.mesh.rotation.set((rand() - 0.5) * 0.06, (rand() - 0.5) * 0.12, (rand() - 0.5) * 0.03);
  }

  const isTall = () => camera.aspect < 0.9;
  function layoutHome() {
    const open = isTall() ? OPENING_TALL : OPENING;
    pieces.forEach((p, i) => {
      if (i < open.length) {
        const o = open[i];
        place(p, o.u, o.v, o.d, o.s, HOME);
      } else {
        const r = ringPoint(rand, isTall());
        const d = 17 + ((i - open.length) / Math.max(1, count - open.length)) * (FAR - 20) + rand() * 3;
        place(p, r.u, r.v, d, 1.5 + rand() * 1.4, HOME);
      }
    });
  }

  // Clouds
  const cloudTex = [cloudTexture(11), cloudTexture(23), cloudTexture(37), cloudTexture(51)];
  const clouds: Cloud[] = [];
  const cloudCount = small ? 18 : 34;
  // Clouds sit low (a deck below us) or out to the sides, never across the flight path.
  function placeCloud(c: Cloud, d: number, from: THREE.Vector3) {
    const low = rand() < 0.6;
    const side = rand() < 0.5 ? -1 : 1;
    const u = low ? rand() * 2.8 - 1.4 : side * (0.75 + rand() * 0.7);
    const v = low ? -0.62 - rand() * 0.6 : rand() * 1.6 - 0.6;
    const w = (low ? 9 : 6) + rand() * (low ? 18 : 10);
    c.sprite.position.set(from.x + u * halfW(d), from.y + v * halfH(d), from.z - d);
    c.sprite.scale.set(w, w * 0.5, 1);
  }
  for (let i = 0; i < cloudCount; i++) {
    const mat = new THREE.SpriteMaterial({
      map: cloudTex[i % cloudTex.length],
      transparent: true,
      depthWrite: false,
      opacity: 0.75 + rand() * 0.25,
      fog: true,
    });
    const sprite = new THREE.Sprite(mat);
    const c = { sprite, drift: 0.04 + rand() * 0.12, phase: rand() * 10 };
    scene.add(sprite);
    clouds.push(c);
  }
  function layoutClouds() {
    clouds.forEach((c, i) => placeCloud(c, 9 + Math.pow(i / cloudCount, 1.2) * FAR + rand() * 2, HOME));
  }

  // Camera rig: `goal` is where we want to be; the camera eases toward it.
  const goal = HOME.clone();
  const vel = new THREE.Vector2();
  const mouse = new THREE.Vector2();
  const mouseSmooth = new THREE.Vector2();
  let wind = 0;
  let mode: SkyMode = "home";
  let focused: Piece | null = null;
  let fade = 0; // 0..1 global fade for relayout
  let fadeTarget = 1;
  let relayoutAfterFade = false;

  const setMode = (m: SkyMode) => {
    if (m === mode) return;
    mode = m;
    ev.onMode(m);
  };

  function resize() {
    const w = host.clientWidth;
    const h = host.clientHeight;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.fov = w / h < 0.8 ? FOV + 14 : FOV;
    camera.updateProjectionMatrix();
  }
  resize();
  layoutHome();
  layoutClouds();
  const ro = new ResizeObserver(() => {
    resize();
    if (mode === "home") layoutHome();
  });
  ro.observe(host);

  // Pointer input
  const ray = new THREE.Raycaster();
  const ndc = new THREE.Vector2();
  const pointers = new Map<number, { x: number; y: number }>();
  let downAt: { x: number; y: number; t: number } | null = null;
  let dragging = false;
  let pinchDist = 0;
  let hovered: Piece | null = null;
  const el = renderer.domElement;

  function pick(clientX: number, clientY: number): Piece | null {
    const r = el.getBoundingClientRect();
    ndc.set(((clientX - r.left) / r.width) * 2 - 1, -((clientY - r.top) / r.height) * 2 + 1);
    ray.setFromCamera(ndc, camera);
    const hits = ray.intersectObjects(
      pieces.filter((p) => p.mesh.material.uniforms.uOpacity.value > 0.15).map((p) => p.mesh),
      false,
    );
    const hit = hits.find((h) => h.distance > NEAR_FADE + 0.6);
    return hit ? pieces[hit.object.userData.index as number] : null;
  }

  const onMove = (e: PointerEvent) => {
    const r = el.getBoundingClientRect();
    const nx = ((e.clientX - r.left) / r.width) * 2 - 1;
    const ny = -((e.clientY - r.top) / r.height) * 2 + 1;
    wind += (nx - mouse.x) * 3;
    mouse.set(nx, ny);
    if (pointers.has(e.pointerId)) {
      const prev = pointers.get(e.pointerId)!;
      pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (pointers.size === 2) {
        const [a, b] = [...pointers.values()];
        const dist = Math.hypot(a.x - b.x, a.y - b.y);
        if (pinchDist) fly((pinchDist - dist) * 0.04);
        pinchDist = dist;
        return;
      }
      const dx = e.clientX - prev.x;
      const dy = e.clientY - prev.y;
      if (downAt && !dragging && Math.hypot(e.clientX - downAt.x, e.clientY - downAt.y) > 6) {
        dragging = true;
        host.classList.add("is-dragging");
        if (mode === "focus") unfocus();
        setMode("explore");
      }
      if (dragging) {
        const k = (2 * halfH(10)) / r.height;
        goal.x -= dx * k;
        goal.y += dy * k;
        vel.set(-dx * k, dy * k);
      }
      return;
    }
    if (e.pointerType === "mouse") {
      const p = pick(e.clientX, e.clientY);
      if (p !== hovered) {
        hovered = p;
        el.style.cursor = p ? "pointer" : "grab";
      }
      ev.onHover(p ? p.work.label : null, e.clientX - r.left, e.clientY - r.top);
    }
  };
  const onDown = (e: PointerEvent) => {
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pointers.size === 1) {
      downAt = { x: e.clientX, y: e.clientY, t: performance.now() };
      dragging = false;
      vel.set(0, 0);
    } else {
      pinchDist = 0;
      setMode(mode === "home" ? "explore" : mode);
    }
    el.setPointerCapture(e.pointerId);
  };
  const onUp = (e: PointerEvent) => {
    pointers.delete(e.pointerId);
    if (pointers.size < 2) pinchDist = 0;
    host.classList.remove("is-dragging");
    if (!dragging && downAt && pointers.size === 0) {
      const p = pick(e.clientX, e.clientY);
      if (p) focusOn(p);
      else if (mode === "focus") unfocus(true);
    }
    if (pointers.size === 0) {
      downAt = null;
      dragging = false;
    }
  };
  const onLeave = () => {
    mouse.set(0, 0);
    hovered = null;
    ev.onHover(null, 0, 0);
  };
  const onWheel = (e: WheelEvent) => {
    // On the opening view the wheel scrolls the page. Pinch (ctrl+wheel) or explore mode flies.
    if (mode === "home" && !e.ctrlKey) return;
    e.preventDefault();
    if (mode === "home") setMode("explore");
    if (mode === "focus") unfocus();
    fly(e.deltaY * (e.ctrlKey ? 0.05 : 0.008));
  };

  el.addEventListener("pointermove", onMove);
  el.addEventListener("pointerdown", onDown);
  el.addEventListener("pointerup", onUp);
  el.addEventListener("pointercancel", onUp);
  el.addEventListener("pointerleave", onLeave);
  el.addEventListener("wheel", onWheel, { passive: false });

  function fly(dz: number) {
    goal.z = Math.min(HOME.z + 8, goal.z + dz);
  }

  function focusOn(p: Piece) {
    focused = p;
    const h = p.mesh.userData.s as number;
    const w = h * (p.work.w / p.work.h);
    const fit = Math.max((h * 0.5) / (0.62 * tanNow()), (w * 0.5) / (0.72 * tanNow() * camera.aspect));
    goal.set(p.mesh.position.x, p.mesh.position.y, p.mesh.position.z + fit);
    vel.set(0, 0);
    setMode("focus");
    ev.onFocus(p.work);
  }
  function unfocus(toExplore = true) {
    if (!focused) return;
    focused = null;
    goal.z += 3;
    ev.onFocus(null);
    if (toExplore) setMode("explore");
  }

  // Public controls
  const api = {
    zoom(dir: 1 | -1) {
      if (mode === "home") setMode("explore");
      if (mode === "focus") unfocus();
      fly(dir * -5);
    },
    pan(dx: number, dy: number) {
      if (mode === "home") setMode("explore");
      goal.x += dx;
      goal.y += dy;
    },
    explore() {
      setMode("explore");
      fly(-6);
    },
    home() {
      focused = null;
      ev.onFocus(null);
      setMode("home");
      if (camera.position.distanceTo(HOME) > 6) {
        fadeTarget = 0;
        relayoutAfterFade = true;
      } else {
        goal.copy(HOME);
      }
    },
    destroy() {
      cancelAnimationFrame(raf);
      ro.disconnect();
      io.disconnect();
      el.removeEventListener("pointermove", onMove);
      el.removeEventListener("pointerdown", onDown);
      el.removeEventListener("pointerup", onUp);
      el.removeEventListener("pointercancel", onUp);
      el.removeEventListener("pointerleave", onLeave);
      el.removeEventListener("wheel", onWheel);
      pieces.forEach((p) => {
        p.mesh.geometry.dispose();
        p.mesh.material.dispose();
      });
      clouds.forEach((c) => c.sprite.material.dispose());
      cloudTex.forEach((t) => t.dispose());
      textures.forEach((t) => t.dispose());
      renderer.dispose();
      el.remove();
    },
  };

  // Render loop, paused when off screen or the tab is hidden.
  let visible = true;
  const io = new IntersectionObserver(([e]) => (visible = e.isIntersecting), { threshold: 0 });
  io.observe(host);
  let raf = 0;
  let last = performance.now();
  const tmp = new THREE.Vector3();

  const tick = (now: number) => {
    raf = requestAnimationFrame(tick);
    if (!visible || document.hidden) {
      last = now;
      return;
    }
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    const t = now / 1000;

    // Inertia after a drag.
    if (!dragging && vel.lengthSq() > 1e-6) {
      goal.x += vel.x;
      goal.y += vel.y;
      vel.multiplyScalar(Math.pow(0.0025, dt));
    }

    // Global fade for returning home from far away.
    fade += (fadeTarget - fade) * (1 - Math.exp(-dt * (fadeTarget ? 4 : 10)));
    if (relayoutAfterFade && fade < 0.02) {
      relayoutAfterFade = false;
      camera.position.copy(HOME);
      goal.copy(HOME);
      layoutHome();
      layoutClouds();
      fadeTarget = 1;
    }

    // Ease the camera toward the goal, plus a little look-around from the mouse.
    mouseSmooth.lerp(mouse, 1 - Math.exp(-dt * 3));
    const ease = 1 - Math.exp(-dt * (reduce ? 12 : mode === "focus" ? 3.2 : 4.5));
    camera.position.lerp(goal, ease);
    const look = mode === "focus" ? 0.12 : 0.55;
    tmp.set(
      camera.position.x + mouseSmooth.x * look,
      camera.position.y + mouseSmooth.y * look * 0.6,
      camera.position.z - 10,
    );
    camera.lookAt(tmp);

    // Recycle pieces that pass behind us, fall too far ahead or drift far off to the side.
    const cam = camera.position;
    pieces.forEach((p) => {
      const d = cam.z - p.base.z;
      const offX = Math.abs(p.base.x - cam.x) / halfW(Math.max(d, 1));
      const offY = Math.abs(p.base.y - cam.y) / halfH(Math.max(d, 1));
      if (p !== focused && (d < 0.4 || d > FAR + 6 || offX > 2.2 || offY > 2.2)) {
        const r = mode === "home" ? ringPoint(rand, isTall()) : { u: rand() * 2.4 - 1.2, v: rand() * 2 - 1 };
        const nd = d > FAR + 6 ? 6 + rand() * 6 : 22 + rand() * (FAR - 22);
        place(p, r.u, r.v, nd, 1.4 + rand() * 1.5, cam);
        p.mesh.material.uniforms.uOpacity.value = 0;
      }
      const bob = reduce ? 0 : Math.sin(t * 0.5 + p.phase) * 0.06;
      p.mesh.position.set(p.base.x, p.base.y + bob, p.base.z);
      const target = p === hovered || p === focused ? 1 : 0;
      p.hover += (target - p.hover) * (1 - Math.exp(-dt * 10));
      const u = p.mesh.material.uniforms;
      u.uHover.value = p.hover;
      let want = fade;
      if (focused && p !== focused) {
        const fd = cam.z - focused.base.z;
        want = d < fd + 0.5 ? 0 : fade * 0.55;
      }
      u.uOpacity.value += (want - u.uOpacity.value) * (1 - Math.exp(-dt * (want < u.uOpacity.value ? 8 : 3)));
      const s = p.mesh.userData.s as number;
      p.mesh.scale.setScalar(s * (1 + p.hover * 0.04));
      // Face the camera a little more as you come close.
      p.mesh.rotation.y += (-(p.base.x - cam.x) * 0.02 - p.mesh.rotation.y) * 0.02;
    });

    wind *= Math.pow(0.2, dt);
    clouds.forEach((c) => {
      const d = cam.z - c.sprite.position.z;
      if (d < 0.5 || d > FAR + 10) placeCloud(c, d < 0.5 ? 24 + rand() * (FAR - 24) : 9 + rand() * 4, cam);
      if (!reduce) c.sprite.position.x += (c.drift + wind * 0.4) * dt;
      const off = Math.abs(c.sprite.position.x - cam.x) / halfW(Math.max(d, 1));
      if (off > 2.4) placeCloud(c, Math.max(6, d), cam);
      const m = c.sprite.material;
      // Thin out as they come close, so flying through them stays clear.
      const close = Math.min(1, Math.max(0, (d - 2) / 9));
      m.opacity = Math.min(1, (m.userData.o ?? (m.userData.o = m.opacity)) * fade * close * (focused ? 0.5 : 1));
    });

    renderer.render(scene, camera);
  };
  raf = requestAnimationFrame(tick);
  return api;
}
