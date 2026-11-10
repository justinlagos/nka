import * as THREE from "three";
import type { Media, Project } from "@/content/projects";

// The sky: a bounded world of work hanging in a matte blue atmosphere.
// Layer 2 (featured) sits around the headline in the opening view. Layer 3 (the rest) is arranged in
// project groups deeper in, found by flying forward. Nothing repeats and nothing is recycled: what you
// see is a place you can return to.

export type SkyMode = "home" | "explore" | "tour" | "open";
export type SkyEvents = {
  onMode: (m: SkyMode) => void;
  onReady: () => void;
  onOpen: (id: string, index: number, rect: { x: number; y: number; w: number; h: number } | null) => void;
};

type Slot = { u: number; v: number; d: number; s: number };

const FOV = 46;
const HOME = new THREE.Vector3(0, 0, 10);
const NEAR_FADE = 2.0;
const HAZE = new THREE.Color("#5f82b4"); // the colour distant work dissolves into
const SHADE = new THREE.Color("#1c3156"); // cool slate for shadows

// Opening view. u, v: -1..1 across the view from HOME; d: distance; s: longer side in world units.
// Four large films hold the corners, smaller pieces sit between, the centre stays clear for the copy.
const OPEN_WIDE: Record<string, Slot> = {
  "halden/0": { u: -0.74, v: 0.5, d: 8.6, s: 3.0 },
  "runa/0": { u: -0.76, v: -0.54, d: 8.0, s: 2.9 },
  "northlight/0": { u: 0.75, v: 0.5, d: 9.0, s: 3.0 },
  "haulo/0": { u: 0.77, v: -0.54, d: 8.2, s: 2.9 },
  "boba/0": { u: -0.36, v: 0.8, d: 13, s: 1.75 },
  "workspace/0": { u: 0.34, v: -0.83, d: 13.5, s: 1.75 },
  "kofi/0": { u: 0.42, v: 0.79, d: 15, s: 1.7 },
  "studio/0": { u: -0.38, v: -0.83, d: 14.5, s: 1.7 },
  "apparel/0": { u: -0.97, v: 0.02, d: 15.5, s: 1.8 },
  "studio/1": { u: 0.98, v: 0.0, d: 16, s: 1.7 },
};
// Tall screens: work above and below the copy.
const OPEN_TALL: Record<string, Slot> = {
  "halden/0": { u: -0.5, v: 0.78, d: 8.6, s: 2.2 },
  "northlight/0": { u: 0.52, v: 0.66, d: 10, s: 2.0 },
  "boba/0": { u: 0.02, v: 0.95, d: 13, s: 1.4 },
  "runa/0": { u: -0.5, v: -0.78, d: 8.4, s: 2.2 },
  "haulo/0": { u: 0.52, v: -0.68, d: 10, s: 2.0 },
  "kofi/0": { u: 0.04, v: -0.95, d: 14, s: 1.4 },
};
// Order of the project groups deeper in. "studio" takes two photos each time it comes up,
// so people at work turn up between the projects.
const DEEP = [
  "pocketa", "studio", "bright", "ewa", "studio", "ozo", "koko", "shoot", "studio", "vela",
  "editorial", "books", "studio", "ori", "fernline", "shelf", "studio", "apparel", "workspace", "studio",
];
// Films that loop quietly on the opening view. The rest play when you point at them.
const AUTOPLAY = new Set(["halden/0", "haulo/0", "boba/0"]);

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
uniform float uLift;
uniform float uDim;
uniform float uLoaded;
uniform float uFar;
uniform vec3 uHaze;
varying vec2 vUv;
varying float vDepth;
float rbox(vec2 p, vec2 b, float r) { vec2 q = abs(p) - b + r; return length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - r; }
void main() {
  vec2 p = (vUv - 0.5) * uSize;
  float d = rbox(p, uSize * 0.5, uRadius);
  float aa = fwidth(d);
  float mask = 1.0 - smoothstep(-aa, aa, d);
  vec3 col = mix(vec3(0.62, 0.71, 0.83), texture2D(uMap, vUv).rgb, uLoaded);
  // Atmosphere: distant work takes on the sky's colour, then dissolves into it.
  float haze = smoothstep(9.0, uFar * 0.7, vDepth) * (1.0 - uLift);
  col = mix(col, uHaze, haze * 0.5 + uDim * 0.18);
  float far = 1.0 - smoothstep(uFar - 14.0, uFar, vDepth);
  float near = smoothstep(${NEAR_FADE.toFixed(1)}, ${(NEAR_FADE + 1.8).toFixed(1)}, vDepth);
  gl_FragColor = vec4(col, mask * uOpacity * far * near);
  #include <colorspace_fragment>
}`;

// A soft, low shadow behind each piece so it sits in the air rather than on the screen.
const SHADOW_FRAG = /* glsl */ `
uniform vec2 uSize;
uniform float uOpacity;
uniform vec3 uShade;
varying vec2 vUv;
varying float vDepth;
float rbox(vec2 p, vec2 b, float r) { vec2 q = abs(p) - b + r; return length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - r; }
void main() {
  vec2 p = (vUv - 0.5) * uSize;
  float d = rbox(p, uSize * 0.5 - 0.16, 0.08);
  float a = 1.0 - smoothstep(-0.02, 0.16, d);
  float far = 1.0 - smoothstep(18.0, 40.0, vDepth);
  gl_FragColor = vec4(uShade, a * 0.26 * uOpacity * far);
  #include <colorspace_fragment>
}`;

function mulberry(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Low-contrast cloud: overlapping soft puffs, tinted to the sky, with a cool slate underside.
function cloudTexture(seed: number) {
  const rand = mulberry(seed);
  const c = document.createElement("canvas");
  c.width = 512;
  c.height = 256;
  const g = c.getContext("2d")!;
  for (let i = 0; i < 30; i++) {
    const t = i / 30;
    const x = 80 + rand() * 352;
    const base = 186 - Math.sin(((x - 80) / 352) * Math.PI) * (60 + rand() * 36);
    const y = base + rand() * (196 - base);
    const r = 28 + rand() * 50 * (1 - Math.abs(t - 0.5));
    const grad = g.createRadialGradient(x, y - r * 0.25, 0, x, y, r);
    grad.addColorStop(0, "rgba(233,240,249,0.42)");
    grad.addColorStop(0.55, "rgba(214,226,242,0.2)");
    grad.addColorStop(1, "rgba(200,216,236,0)");
    g.fillStyle = grad;
    g.beginPath();
    g.arc(x, y, r, 0, Math.PI * 2);
    g.fill();
  }
  const under = g.createLinearGradient(0, 110, 0, 230);
  under.addColorStop(0, "rgba(90,120,165,0)");
  under.addColorStop(1, "rgba(62,92,138,0.4)");
  g.globalCompositeOperation = "source-atop";
  g.fillStyle = under;
  g.fillRect(0, 0, 512, 256);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

type Piece = {
  key: string;
  project: Project;
  index: number;
  media: Media;
  mesh: THREE.Mesh<THREE.PlaneGeometry, THREE.ShaderMaterial>;
  shadow: THREE.Mesh<THREE.PlaneGeometry, THREE.ShaderMaterial>;
  base: THREE.Vector3;
  rot: THREE.Euler;
  size: number; // world height
  featured: boolean;
  tier: 0 | 1 | 2; // 0 featured, 1 waiting behind a featured lead, 2 deeper in
  shown: number;
  phase: number;
  bobRate: number;
  lift: number;
  appear: number;
  state: "idle" | "loading" | "loaded";
  video?: { el: HTMLVideoElement; tex: THREE.VideoTexture; live: boolean };
  caption?: HTMLElement;
};
type Cloud = { sprite: THREE.Sprite; drift: number; o: number };

export function createSky(host: HTMLElement, projects: Project[], ev: SkyEvents) {
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const small = window.innerWidth < 760;
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: "high-performance" });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, small ? 1.5 : 1.75));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.setClearColor(0x000000, 0);
  host.appendChild(renderer.domElement);
  renderer.domElement.className = "sky-gl";

  // Labels drawn in the page, positioned from the scene each frame.
  const labels = document.createElement("div");
  labels.className = "sky-labels";
  labels.setAttribute("aria-hidden", "true");
  host.appendChild(labels);
  const tip = document.createElement("div");
  tip.className = "sky-tip";
  labels.appendChild(tip);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(FOV, 1, 0.1, 160);
  camera.position.copy(HOME);
  const rand = mulberry(11);
  const loader = new THREE.TextureLoader();
  const maxAniso = renderer.capabilities.getMaxAnisotropy();

  const tanNow = () => Math.tan(((camera.fov / 2) * Math.PI) / 180);
  const halfH = (d: number) => d * tanNow();
  const halfW = (d: number) => d * tanNow() * camera.aspect;

  function resize() {
    const w = host.clientWidth;
    const h = host.clientHeight;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.fov = w / h < 0.8 ? FOV + 14 : FOV;
    camera.updateProjectionMatrix();
  }
  resize();

  // ---- Build the pieces from the projects
  const geo = new THREE.PlaneGeometry(1, 1);
  const pieces: Piece[] = [];
  const all = projects.flatMap((p) =>
    p.media.map((m, i) => ({ key: `${p.id}/${i}`, project: p, index: i, media: m })).filter((x) => !(x.media.kind === "image" && x.media.derived)),
  );
  for (const item of all) {
    const aspect = item.media.w / item.media.h;
    const mat = new THREE.ShaderMaterial({
      vertexShader: VERT,
      fragmentShader: FRAG,
      transparent: true,
      depthWrite: false,
      uniforms: {
        uMap: { value: null },
        uSize: { value: new THREE.Vector2(aspect, 1) },
        uRadius: { value: 0.022 },
        uOpacity: { value: 0 },
        uLift: { value: 0 },
        uDim: { value: 0 },
        uLoaded: { value: 0 },
        uFar: { value: 64 },
        uHaze: { value: HAZE },
      },
    });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.scale.set(aspect, 1, 1);
    const smat = new THREE.ShaderMaterial({
      vertexShader: VERT,
      fragmentShader: SHADOW_FRAG,
      transparent: true,
      depthWrite: false,
      uniforms: { uSize: { value: new THREE.Vector2(aspect * 1.22, 1.3) }, uOpacity: { value: 0 }, uShade: { value: SHADE } },
    });
    const shadow = new THREE.Mesh(geo, smat);
    shadow.scale.set(1.22, 1.3, 1);
    shadow.position.set(0.02, -0.07, -0.06);
    mesh.add(shadow);
    mesh.userData.index = pieces.length;
    scene.add(mesh);
    pieces.push({
      ...item,
      mesh,
      shadow,
      base: new THREE.Vector3(),
      rot: new THREE.Euler(),
      size: 1,
      featured: false,
      tier: 2,
      shown: 0,
      phase: rand() * Math.PI * 2,
      bobRate: 0.28 + rand() * 0.34,
      lift: 0,
      appear: 0,
      state: "idle",
    });
  }
  const byKey = new Map(pieces.map((p) => [p.key, p]));

  // ---- Layout
  let zMin = -40;
  let open: Record<string, Slot> = OPEN_WIDE;
  const isTall = () => camera.aspect < 0.9;

  function setPiece(p: Piece, pos: THREE.Vector3, s: number, rot: THREE.Euler) {
    const aspect = p.media.w / p.media.h;
    const h = aspect > 1 ? s / aspect : s; // s is the longer side
    p.size = h;
    p.base.copy(pos);
    p.rot.copy(rot);
    p.mesh.position.copy(pos);
    p.mesh.rotation.copy(rot);
    p.mesh.scale.set(h * aspect, h, 1);
  }

  function layout() {
    open = isTall() ? OPEN_TALL : OPEN_WIDE;
    const fit = isTall() ? 1 : Math.min(1, camera.aspect / 1.7);
    const placed = new Set<string>();
    pieces.forEach((p) => {
      p.featured = false;
      p.tier = 2;
    });

    // Layer 2: featured pieces in the opening view.
    for (const [key, o] of Object.entries(open)) {
      const p = byKey.get(key);
      if (!p) continue;
      const pos = new THREE.Vector3(HOME.x + o.u * halfW(o.d), HOME.y + o.v * halfH(o.d), HOME.z - o.d);
      setPiece(p, pos, o.s * fit, new THREE.Euler(o.v * 0.1, -o.u * 0.24, (rand() - 0.5) * 0.02));
      p.featured = true;
      p.tier = 0;
      placed.add(key);
    }
    // The rest of each featured project waits behind its lead, further out and deeper.
    for (const [key, o] of Object.entries(open)) {
      const lead = byKey.get(key);
      if (!lead || lead.index !== 0) continue;
      const sibs = pieces.filter((p) => p.project === lead.project && !placed.has(p.key));
      sibs.slice(0, 2).forEach((p, j) => {
        const d = o.d + 9 + j * 6;
        const u = o.u * (1.16 + j * 0.1) + (j ? 0.05 : -0.04) * Math.sign(o.u || 1);
        const v = o.v * (1.12 + j * 0.12) + (j ? -0.06 : 0.08);
        const pos = new THREE.Vector3(HOME.x + u * halfW(d), HOME.y + v * halfH(d), HOME.z - d);
        setPiece(p, pos, 2.4, new THREE.Euler(v * 0.08, -u * 0.2, (rand() - 0.5) * 0.02));
        p.tier = 1;
        placed.add(p.key);
      });
    }

    // Layer 3: project groups deeper in, on a slow spiral round the flight path.
    const queues = new Map<string, Piece[]>();
    pieces.forEach((p) => {
      if (placed.has(p.key)) return;
      if (!queues.has(p.project.id)) queues.set(p.project.id, []);
      queues.get(p.project.id)!.push(p);
    });
    const groups: Piece[][] = [];
    for (const id of DEEP) {
      const q = queues.get(id);
      if (!q || !q.length) continue;
      groups.push(q.splice(0, id === "studio" ? 2 : q.length));
    }
    queues.forEach((q) => {
      while (q.length) groups.push(q.splice(0, 2));
    });
    const spreadX = isTall() ? 2.6 : 6.4;
    const spreadY = isTall() ? 4.2 : 3.4;
    let lastZ = 0;
    groups.forEach((g, k) => {
      const th = k * 2.39996 + 0.5;
      const r = 1 + (k % 3) * 0.12;
      const c = new THREE.Vector3(Math.cos(th) * spreadX * r, Math.sin(th) * spreadY * r, HOME.z - (25 + k * 3.1));
      lastZ = c.z;
      const out = Math.atan2(c.y, c.x);
      g.forEach((p, j) => {
        const pos = c.clone();
        let s = 2.9;
        if (j > 0) {
          const a = out + (j % 2 ? 0.95 : -0.95);
          const dist = 2.15;
          pos.x += Math.cos(a) * dist;
          pos.y += Math.sin(a) * dist * 0.8;
          pos.z -= 1.4 * j;
          s = 2.15;
        }
        setPiece(p, pos, s, new THREE.Euler(-pos.y * 0.025, pos.x * -0.03, (rand() - 0.5) * 0.03));
        placed.add(p.key);
      });
    });
    zMin = lastZ + 7;
  }
  layout();

  // One caption per project, shown near its first piece when you get close while exploring.
  const leads = new Map<string, Piece>();
  pieces.forEach((p) => {
    if (!leads.has(p.project.id)) leads.set(p.project.id, p);
  });
  leads.forEach((p) => {
    const el = document.createElement("div");
    el.className = "sky-cap";
    el.innerHTML = `<b></b><span></span>`;
    (el.children[0] as HTMLElement).textContent = p.project.brand;
    (el.children[1] as HTMLElement).textContent = p.project.category;
    labels.appendChild(el);
    p.caption = el;
  });

  // ---- Clouds: a low deck and a few banks out to the sides, all inside the world's bounds.
  const cloudTex = [cloudTexture(3), cloudTexture(17), cloudTexture(29)];
  const clouds: Cloud[] = [];
  const cloudCount = small ? 10 : 20;
  for (let i = 0; i < cloudCount; i++) {
    const o = 0.5 + rand() * 0.35;
    const mat = new THREE.SpriteMaterial({ map: cloudTex[i % 3], transparent: true, depthWrite: false, opacity: 0, fog: false });
    const sprite = new THREE.Sprite(mat);
    const z = HOME.z - 18 - (i / cloudCount) * (HOME.z - zMin) - rand() * 3;
    const low = rand() < 0.62;
    const side = rand() < 0.5 ? -1 : 1;
    const x = low ? (rand() * 2 - 1) * 16 : side * (12 + rand() * 8);
    const y = low ? -7 - rand() * 4 : -3 + rand() * 6;
    const w = (low ? 12 : 8) + rand() * 10;
    sprite.position.set(x, y, z);
    sprite.scale.set(w, w * 0.46, 1);
    scene.add(sprite);
    clouds.push({ sprite, drift: (0.05 + rand() * 0.08) * (rand() < 0.5 ? -1 : 1), o });
  }

  // ---- Textures: featured first, then the rest as you get near them.
  let readySent = false;
  let featuredLeft = pieces.filter((p) => p.featured).length;
  const textures: THREE.Texture[] = [];
  function load(p: Piece) {
    if (p.state !== "idle") return;
    p.state = "loading";
    loader.load(
      p.media.sky,
      (tex) => {
        tex.colorSpace = THREE.SRGBColorSpace;
        tex.anisotropy = Math.min(8, maxAniso);
        textures.push(tex);
        if (!p.video?.live) p.mesh.material.uniforms.uMap.value = tex;
        p.mesh.material.uniforms.uLoaded.value = 1;
        p.mesh.userData.poster = tex;
        p.state = "loaded";
        if (p.featured) featuredLeft -= 1;
        if (!readySent && featuredLeft <= 0) {
          readySent = true;
          ev.onReady();
        }
      },
      undefined,
      () => {
        p.state = "loaded";
        if (p.featured) featuredLeft -= 1;
      },
    );
  }
  pieces.filter((p) => p.featured).forEach(load);
  if (featuredLeft === 0) ev.onReady();
  const loadRange = small ? 26 : 38;

  // ---- Video: small preview loops, at most three at once.
  function ensureVideo(p: Piece) {
    if (p.media.kind !== "film" || p.video) return;
    const el = document.createElement("video");
    el.muted = true;
    el.loop = true;
    el.playsInline = true;
    el.setAttribute("playsinline", "");
    el.preload = "auto";
    el.crossOrigin = "anonymous";
    el.src = p.media.preview;
    const tex = new THREE.VideoTexture(el);
    tex.colorSpace = THREE.SRGBColorSpace;
    const v = { el, tex, live: false };
    el.addEventListener("playing", () => {
      v.live = true;
      p.mesh.material.uniforms.uMap.value = tex;
      p.mesh.material.uniforms.uLoaded.value = 1;
    });
    p.video = v;
  }
  function playSet(want: Set<Piece>) {
    pieces.forEach((p) => {
      if (p.media.kind !== "film") return;
      if (want.has(p)) {
        ensureVideo(p);
        if (p.video!.el.paused) p.video!.el.play().catch(() => {});
      } else if (p.video && !p.video.el.paused) {
        p.video.el.pause();
      }
    });
  }

  // ---- Camera rig
  const goal = HOME.clone();
  const vel = new THREE.Vector2();
  const mouse = new THREE.Vector2();
  const mouseSmooth = new THREE.Vector2();
  let mode: SkyMode = "home";
  let before: SkyMode = "home";
  let saved: THREE.Vector3 | null = null;
  let framed: Piece | null = null;
  let hovered: Piece | null = null;
  let fade = 1;
  let fadeTarget = 1;
  let relayoutAfterFade = false;
  let entered = 0; // opening reveal progress

  const setMode = (m: SkyMode) => {
    if (m === mode) return;
    mode = m;
    ev.onMode(m);
  };
  const bounds = () => ({ x: isTall() ? 6 : 13, y: isTall() ? 9 : 7.5 });
  function clampGoal() {
    const b = bounds();
    goal.x = THREE.MathUtils.clamp(goal.x, -b.x, b.x);
    goal.y = THREE.MathUtils.clamp(goal.y, -b.y, b.y);
    goal.z = THREE.MathUtils.clamp(goal.z, zMin, HOME.z + 3);
  }

  const ro = new ResizeObserver(() => {
    resize();
    if (mode === "home") layout();
  });
  ro.observe(host);

  // ---- Input
  const ray = new THREE.Raycaster();
  const ndc = new THREE.Vector2();
  const pointers = new Map<number, { x: number; y: number }>();
  let downAt: { x: number; y: number } | null = null;
  let dragging = false;
  let pinchDist = 0;
  const el = renderer.domElement;

  function pick(clientX: number, clientY: number): Piece | null {
    const r = el.getBoundingClientRect();
    ndc.set(((clientX - r.left) / r.width) * 2 - 1, -((clientY - r.top) / r.height) * 2 + 1);
    ray.setFromCamera(ndc, camera);
    const live = pieces.filter((p) => p.mesh.material.uniforms.uOpacity.value > 0.2);
    const hits = ray.intersectObjects(
      live.map((p) => p.mesh),
      false,
    );
    const hit = hits.find((h) => h.distance > NEAR_FADE + 0.8 && h.distance < 48);
    return hit ? pieces[hit.object.userData.index as number] : null;
  }

  function rectOf(p: Piece) {
    const r = el.getBoundingClientRect();
    const pts = [
      [-0.5, -0.5],
      [0.5, -0.5],
      [0.5, 0.5],
      [-0.5, 0.5],
    ].map(([x, y]) => new THREE.Vector3(x, y, 0).applyMatrix4(p.mesh.matrixWorld).project(camera));
    const xs = pts.map((v) => r.left + ((v.x + 1) / 2) * r.width);
    const ys = pts.map((v) => r.top + ((1 - v.y) / 2) * r.height);
    const x = Math.min(...xs);
    const y = Math.min(...ys);
    return { x, y, w: Math.max(...xs) - x, h: Math.max(...ys) - y };
  }

  function openPiece(p: Piece) {
    const rect = rectOf(p);
    before = mode === "open" ? before : mode;
    saved = goal.clone();
    // A small move toward the piece, so opening it feels like stepping closer.
    const toward = p.mesh.position.clone().sub(camera.position).multiplyScalar(0.12);
    goal.add(toward);
    hovered = null;
    setMode("open");
    ev.onOpen(p.project.id, p.index, rect);
  }

  const onMove = (e: PointerEvent) => {
    const r = el.getBoundingClientRect();
    mouse.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    if (mode === "open") return;
    if (pointers.has(e.pointerId)) {
      const prev = pointers.get(e.pointerId)!;
      pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (pointers.size === 2) {
        const [a, b] = [...pointers.values()];
        const dist = Math.hypot(a.x - b.x, a.y - b.y);
        if (pinchDist) fly((dist - pinchDist) * 0.04);
        pinchDist = dist;
        return;
      }
      const dx = e.clientX - prev.x;
      const dy = e.clientY - prev.y;
      if (downAt && !dragging && Math.hypot(e.clientX - downAt.x, e.clientY - downAt.y) > 6) {
        // On touch, the opening view scrolls the page; dragging only moves the camera once exploring.
        if (e.pointerType === "touch" && mode === "home") {
          downAt = null;
          return;
        }
        dragging = true;
        host.classList.add("is-dragging");
        if (mode !== "explore") setMode("explore");
        framed = null;
      }
      if (dragging) {
        const k = (2 * halfH(10)) / r.height;
        goal.x -= dx * k;
        goal.y += dy * k;
        vel.set(-dx * k, dy * k);
        clampGoal();
      }
      return;
    }
    if (e.pointerType === "mouse") {
      const p = pick(e.clientX, e.clientY);
      if (p !== hovered) {
        hovered = p;
        el.style.cursor = p ? "pointer" : "grab";
        if (p) {
          const len = p.media.kind === "film" ? `<i>Film ${p.media.length}</i>` : "";
          tip.innerHTML = `<b></b><span></span>${len}`;
          (tip.children[0] as HTMLElement).textContent = p.project.brand;
          (tip.children[1] as HTMLElement).textContent = p.project.category;
        }
      }
    }
  };
  const onDown = (e: PointerEvent) => {
    if (mode === "open") return;
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pointers.size === 1) {
      downAt = { x: e.clientX, y: e.clientY };
      dragging = false;
      vel.set(0, 0);
    } else {
      pinchDist = 0;
      if (mode !== "explore") setMode("explore");
    }
    if (e.pointerType !== "touch" || mode !== "home") el.setPointerCapture(e.pointerId);
  };
  const onUp = (e: PointerEvent) => {
    const wasDown = pointers.has(e.pointerId);
    pointers.delete(e.pointerId);
    if (pointers.size < 2) pinchDist = 0;
    host.classList.remove("is-dragging");
    if (wasDown && !dragging && downAt && pointers.size === 0 && mode !== "open") {
      const p = pick(e.clientX, e.clientY);
      if (p) openPiece(p);
    }
    if (pointers.size === 0) {
      downAt = null;
      dragging = false;
    }
  };
  const onLeave = () => {
    mouse.set(0, 0);
    hovered = null;
  };
  const onWheel = (e: WheelEvent) => {
    if (mode === "open") return;
    // On the opening view the wheel scrolls the page; a pinch (ctrl+wheel) or exploring flies.
    if (mode === "home" && !e.ctrlKey) return;
    e.preventDefault();
    if (mode !== "explore") setMode("explore");
    framed = null;
    fly(-e.deltaY * (e.ctrlKey ? 0.05 : 0.014));
  };
  el.addEventListener("pointermove", onMove);
  el.addEventListener("pointerdown", onDown);
  el.addEventListener("pointerup", onUp);
  el.addEventListener("pointercancel", onUp);
  el.addEventListener("pointerleave", onLeave);
  el.addEventListener("wheel", onWheel, { passive: false });

  function fly(dz: number) {
    goal.z += dz;
    clampGoal();
  }

  // Frame one piece on the left of the view, leaving room for a caption card.
  function frame(p: Piece) {
    framed = p;
    const h = p.size;
    const w = h * (p.media.w / p.media.h);
    const tall = isTall();
    const fillH = tall ? 0.42 : 0.56;
    const fillW = tall ? 0.86 : 0.5;
    const D = Math.max(h / (2 * fillH * tanNow()), w / (2 * fillW * tanNow() * camera.aspect));
    goal.set(p.base.x, p.base.y, p.base.z + D);
    if (tall) goal.y -= 0.24 * D * tanNow();
    else goal.x += 0.27 * D * tanNow() * camera.aspect;
    vel.set(0, 0);
  }

  // ---- Public controls
  const api = {
    zoom(dir: 1 | -1) {
      if (mode === "home" || mode === "tour") setMode("explore");
      framed = null;
      fly(dir * -5);
    },
    pan(dx: number, dy: number) {
      if (mode === "home" || mode === "tour") setMode("explore");
      framed = null;
      goal.x += dx;
      goal.y += dy;
      clampGoal();
    },
    explore() {
      setMode("explore");
      framed = null;
      goal.set(0, 0, -3);
      clampGoal();
    },
    tour(id: string) {
      const p = leads.get(id);
      if (!p) return;
      setMode("tour");
      frame(p);
    },
    openFramed() {
      if (framed) openPiece(framed);
    },
    // Called when the project view closes: back to exactly where the visitor was.
    resume() {
      if (mode !== "open") return;
      if (saved) goal.copy(saved);
      saved = null;
      setMode(before === "open" ? "explore" : before);
    },
    home() {
      framed = null;
      setMode("home");
      if (camera.position.distanceTo(HOME) > 7) {
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
        p.mesh.material.dispose();
        p.shadow.material.dispose();
        if (p.video) {
          p.video.el.pause();
          p.video.el.removeAttribute("src");
          p.video.el.load();
          p.video.tex.dispose();
        }
      });
      geo.dispose();
      clouds.forEach((c) => c.sprite.material.dispose());
      cloudTex.forEach((t) => t.dispose());
      textures.forEach((t) => t.dispose());
      renderer.dispose();
      el.remove();
      labels.remove();
    },
  };

  // ---- Render loop, paused when off screen or the tab is hidden.
  let visible = true;
  const io = new IntersectionObserver(([e]) => (visible = e.isIntersecting), { threshold: 0 });
  io.observe(host);
  let raf = 0;
  let last = performance.now();
  let lastVideoCheck = 0;
  const tmp = new THREE.Vector3();
  const toCam = new THREE.Vector3();
  const proj = new THREE.Vector3();

  function screenOf(v: THREE.Vector3) {
    proj.copy(v).project(camera);
    return { x: ((proj.x + 1) / 2) * host.clientWidth, y: ((1 - proj.y) / 2) * host.clientHeight, front: proj.z < 1 };
  }

  const tick = (now: number) => {
    raf = requestAnimationFrame(tick);
    if (!visible || document.hidden) {
      last = now;
      pieces.forEach((p) => p.video && !p.video.el.paused && p.video.el.pause());
      return;
    }
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    const t = now / 1000;
    if (readySent) entered = Math.min(1, entered + dt / (reduce ? 0.01 : 1.6));

    if (!dragging && vel.lengthSq() > 1e-6 && mode === "explore") {
      goal.x += vel.x;
      goal.y += vel.y;
      clampGoal();
      vel.multiplyScalar(Math.pow(0.003, dt));
    }

    fade += (fadeTarget - fade) * (1 - Math.exp(-dt * (fadeTarget ? 4 : 10)));
    if (relayoutAfterFade && fade < 0.03) {
      relayoutAfterFade = false;
      camera.position.copy(HOME);
      goal.copy(HOME);
      fadeTarget = 1;
    }

    // Ease toward the goal. A little look-around follows the pointer, less when looking at one piece.
    mouseSmooth.lerp(mode === "open" ? mouse.set(0, 0) : mouse, 1 - Math.exp(-dt * 2.5));
    const ease = 1 - Math.exp(-dt * (reduce ? 14 : mode === "tour" ? 2.6 : 3.6));
    camera.position.lerp(goal, ease);
    const look = reduce ? 0 : mode === "tour" || mode === "open" ? 0.08 : 0.38;
    tmp.set(camera.position.x + mouseSmooth.x * look, camera.position.y + mouseSmooth.y * look * 0.6, camera.position.z - 10);
    camera.lookAt(tmp);
    camera.updateMatrixWorld();

    const cam = camera.position;
    const related = hovered?.project ?? framed?.project ?? null;
    const W = host.clientWidth;
    const H = host.clientHeight;

    pieces.forEach((p) => {
      const d = cam.z - p.base.z;
      if (p.state === "idle" && d < loadRange && d > -2) load(p);

      const active = p === hovered || p === framed;
      p.lift += ((active ? 1 : 0) - p.lift) * (1 - Math.exp(-dt * 8));
      const u = p.mesh.material.uniforms;
      u.uLift.value = p.lift;
      const dimWant = related && p.project !== related ? 1 : 0;
      u.uDim.value += (dimWant - u.uDim.value) * (1 - Math.exp(-dt * 6));

      // Opening reveal: featured work settles in from a little further back, nearest first.
      const delay = p.featured ? Math.min(0.55, (p.base.z - HOME.z) * -0.025) : 0.3;
      const a = reduce ? 1 : THREE.MathUtils.smoothstep(entered, delay, delay + 0.45);
      p.appear = a;
      const bob = reduce ? 0 : Math.sin(t * p.bobRate + p.phase) * 0.035;

      // Hover: come forward a touch and turn to face the viewer.
      toCam.copy(cam).sub(p.base).normalize().multiplyScalar(p.lift * 0.42);
      p.mesh.position.set(p.base.x + toCam.x, p.base.y + bob + toCam.y, p.base.z + toCam.z - (1 - a) * 1.6);
      const k = 1 - p.lift * 0.85;
      p.mesh.rotation.set(p.rot.x * k, p.rot.y * k, p.rot.z * k);

      p.shown += ((p.state === "loaded" ? 1 : 0) - p.shown) * (1 - Math.exp(-dt * 5));
      const quiet = mode === "home" ? [1, 0.62, 0.22][p.tier] : 1;
      let want = fade * a * p.shown * quiet;
      if (mode === "tour" && framed && p !== framed && p.project !== framed.project) {
        const fd = cam.z - framed.base.z;
        want *= d < fd + 0.6 ? 0.1 : 0.6;
      }
      u.uOpacity.value += (want - u.uOpacity.value) * (1 - Math.exp(-dt * (want < u.uOpacity.value ? 7 : 3.5)));
      p.shadow.material.uniforms.uOpacity.value = u.uOpacity.value;
    });

    // Hover label under the piece.
    if (hovered && mode !== "open") {
      tmp.set(0, -0.5, 0).applyMatrix4(hovered.mesh.matrixWorld);
      const s = screenOf(tmp);
      tip.style.transform = `translate(${s.x}px, ${s.y + 10}px) translateX(-50%)`;
      tip.classList.add("on");
    } else tip.classList.remove("on");

    // Captions for project groups, when you get near them while exploring.
    leads.forEach((p) => {
      const c = p.caption!;
      let o = 0;
      if (mode === "explore" && p !== hovered) {
        const d = cam.z - p.base.z;
        o = THREE.MathUtils.smoothstep(d, 3.2, 5.5) * (1 - THREE.MathUtils.smoothstep(d, 11, 16));
        if (o > 0.01) {
          tmp.set(-0.5, -0.5, 0).applyMatrix4(p.mesh.matrixWorld);
          const s = screenOf(tmp);
          if (!s.front || s.x < -40 || s.x > W || s.y < 0 || s.y > H - 30) o = 0;
          else c.style.transform = `translate(${s.x}px, ${s.y + 10}px)`;
        }
      }
      c.style.opacity = o.toFixed(3);
    });

    // Video: the opening loops, plus whatever you point at or are shown, three at most.
    if (now - lastVideoCheck > 250) {
      lastVideoCheck = now;
      const want = new Set<Piece>();
      if (hovered?.media.kind === "film") want.add(hovered);
      if (framed?.media.kind === "film") want.add(framed);
      if (!reduce && mode !== "open") {
        const cands = pieces
          .filter((p) => p.media.kind === "film" && p.appear > 0.9)
          .filter((p) => (mode === "home" ? AUTOPLAY.has(p.key) && p.featured : true))
          .map((p) => ({ p, d: cam.distanceTo(p.base) }))
          .filter((x) => x.d < 22)
          .sort((a, b) => a.d - b.d);
        for (const c of cands) {
          if (want.size >= 3) break;
          const s = screenOf(c.p.base);
          if (s.front && s.x > -100 && s.x < W + 100 && s.y > -100 && s.y < H + 100) want.add(c.p);
        }
      }
      playSet(want);
    }

    clouds.forEach((c) => {
      if (!reduce) {
        c.sprite.position.x += c.drift * dt;
        if (c.sprite.position.x > 24) c.sprite.position.x = -24;
        if (c.sprite.position.x < -24) c.sprite.position.x = 24;
      }
      const d = cam.z - c.sprite.position.z;
      const close = THREE.MathUtils.clamp((d - 8) / 12, 0, 1);
      const far = 1 - THREE.MathUtils.smoothstep(d, 50, 70);
      c.sprite.material.opacity = c.o * fade * close * far * (0.4 + 0.6 * entered);
    });

    renderer.render(scene, camera);
  };
  raf = requestAnimationFrame(tick);
  return api;
}
