"use client";
import { useCallback, useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { usePathname } from "next/navigation";

// The living nka.studio mark. Three states (Signature, Blob, Morph) drawn from Justin's identity
// package, deformed live with an SVG displacement filter so it wobbles at rest and turns liquid
// when it changes state. The nav instance can leap out of the header, perform, and spring back.

export type MarkState = "signature" | "blob" | "morph";
type Ink = "black" | "white" | "sticker";

const ORDER: MarkState[] = ["signature", "blob", "morph"];
const DIM: Record<MarkState, [number, number]> = { signature: [677, 630], blob: [697, 630], morph: [686, 680] };
const BOX = 720;
const SPLASH = ["#ff5a1f", "#2f6bff", "#ff3e9a", "#b6f23a", "#ffc928", "#7a4dff"];
const src = (s: MarkState, ink: Ink) => `/brand/${s}-${ink}.png`;
// Sticker art carries a 24px die-cut border on every side, so it is drawn a touch smaller.
const STICKER_PAD = 24;
const STICKER_K = BOX / (BOX + 2 * STICKER_PAD + 20);

const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v));
const smooth = (a: number, b: number, v: number) => {
  const t = clamp((v - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
};
const outCubic = (t: number) => 1 - Math.pow(1 - t, 3);
const inOutCubic = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const outBack = (t: number) => 1 + 2.4 * Math.pow(t - 1, 3) + 1.4 * Math.pow(t - 1, 2);
// Damped spring: starts at 1, rings, settles at 0. t in seconds.
const ring = (t: number, freq = 16, decay = 7) => Math.exp(-decay * t) * Math.cos(freq * t);
const bez = (a: number, b: number, c: number, d: number, t: number) => {
  const u = 1 - t;
  return u * u * u * a + 3 * u * u * t * b + 3 * u * t * t * c + t * t * t * d;
};

function prefersReduced() {
  return typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

// Runs a timed tween on requestAnimationFrame; resolves when done.
function tween(ms: number, step: (p: number, elapsed: number) => void) {
  return new Promise<void>((resolve) => {
    const start = performance.now();
    const frame = (now: number) => {
      const e = clamp(now - start, 0, ms);
      step(e / ms, e);
      if (e < ms) requestAnimationFrame(frame);
      else resolve();
    };
    requestAnimationFrame(frame);
  });
}

/* ---------------------------------------------------------------------------------------------
   Mark: one SVG instance plus the live values that drive it.
   --------------------------------------------------------------------------------------------- */

type Fx = {
  weights: Record<MarkState, number>;
  extra: number; // extra displacement on top of idle
  glitch: number; // horizontal slice displacement
  freq: number; // extra noise frequency
  sx: number;
  sy: number;
  rot: number;
  idle: number; // idle displacement amplitude
  push: number; // pointer proximity, 0..1
  px: number; // pointer offset, -1..1
  py: number;
};

type Rig = { fx: Fx; state: MarkState; busy: boolean };

function newFx(state: MarkState, idle: number): Fx {
  return {
    weights: { signature: state === "signature" ? 1 : 0, blob: state === "blob" ? 1 : 0, morph: state === "morph" ? 1 : 0 },
    extra: 0,
    glitch: 0,
    freq: 0,
    sx: 1,
    sy: 1,
    rot: 0,
    idle,
    push: 0,
    px: 0,
    py: 0,
  };
}

function Mark({
  ink,
  rig,
  title,
  className,
  fps = 60,
}: {
  ink: Ink;
  rig: React.MutableRefObject<Rig>;
  title?: string;
  className?: string;
  fps?: number;
}) {
  const id = useId().replace(/[^a-zA-Z0-9]/g, "");
  const svg = useRef<SVGSVGElement>(null);
  const body = useRef<SVGGElement>(null);
  const turb = useRef<SVGFETurbulenceElement>(null);
  const disp = useRef<SVGFEDisplacementMapElement>(null);
  const imgs = useRef<Partial<Record<MarkState, SVGImageElement>>>({});

  useEffect(() => {
    let raf = 0;
    let visible = true;
    let last = 0;
    const seedA = Math.random() * 10;
    const seedB = Math.random() * 10;
    const io = new IntersectionObserver(([e]) => (visible = e.isIntersecting));
    if (svg.current) io.observe(svg.current);
    const still = prefersReduced();

    const draw = (now: number) => {
      raf = requestAnimationFrame(draw);
      if (!visible || document.hidden) return;
      if (now - last < 1000 / fps - 2) return;
      last = now;
      const f = rig.current.fx;
      const t = now / 1000;
      // Irregular idle: two slow sines at unrelated periods, with soft pauses.
      const swell = still ? 0 : 0.55 + 0.45 * Math.sin(t * 0.73 + seedA) * Math.sin(t * 0.29 + seedB);
      const idle = f.idle * Math.max(0, swell) + f.push * f.idle * 2.2;
      disp.current?.setAttribute("scale", (idle + f.extra).toFixed(2));
      const bx = 0.008 + f.freq + (still ? 0 : 0.0016 * Math.sin(t * 0.31 + seedA)) + f.px * 0.002;
      const by = 0.0095 + f.freq + (still ? 0 : 0.0014 * Math.cos(t * 0.27 + seedB)) + f.py * 0.002;
      turb.current?.setAttribute("baseFrequency", `${bx.toFixed(5)} ${by.toFixed(5)}`);
      body.current?.setAttribute(
        "transform",
        `translate(${(BOX / 2 + (f.glitch ? (Math.random() - 0.5) * 2 * f.glitch : 0)).toFixed(1)} ${BOX / 2}) rotate(${f.rot.toFixed(2)}) scale(${f.sx.toFixed(4)} ${f.sy.toFixed(4)}) translate(${-BOX / 2} ${-BOX / 2})`,
      );
      for (const s of ORDER) imgs.current[s]?.setAttribute("opacity", f.weights[s].toFixed(3));
    };
    raf = requestAnimationFrame(draw);
    return () => {
      cancelAnimationFrame(raf);
      io.disconnect();
    };
  }, [rig, fps]);

  const start = rig.current.state;
  return (
    <svg
      ref={svg}
      viewBox={`0 0 ${BOX} ${BOX}`}
      className={className}
      role={title ? "img" : undefined}
      aria-label={title}
      aria-hidden={title ? undefined : true}
      overflow="visible"
    >
      <defs>
        <filter id={`w${id}`} x="-15%" y="-15%" width="130%" height="130%" colorInterpolationFilters="sRGB">
          <feTurbulence ref={turb} type="fractalNoise" baseFrequency="0.008 0.0095" numOctaves={1} seed={4} result="n" />
          <feDisplacementMap ref={disp} in="SourceGraphic" in2="n" scale={0} xChannelSelector="R" yChannelSelector="G" />
        </filter>
      </defs>
      <g>
        <g ref={body}>
          <g filter={`url(#w${id})`}>
            {ORDER.map((s) => {
              const k = ink === "sticker" ? STICKER_K : 1;
              const w = (DIM[s][0] + (ink === "sticker" ? 2 * STICKER_PAD : 0)) * k;
              const h = (DIM[s][1] + (ink === "sticker" ? 2 * STICKER_PAD : 0)) * k;
              return (
                <image
                  key={s}
                  ref={(el) => {
                    if (el) imgs.current[s] = el;
                  }}
                  href={src(s, ink)}
                  x={(BOX - w) / 2}
                  y={(BOX - h) / 2}
                  width={w}
                  height={h}
                  opacity={s === start ? 1 : 0}
                />
              );
            })}
          </g>
        </g>
      </g>
    </svg>
  );
}

/* ---------------------------------------------------------------------------------------------
   Morph: liquid transition between two states, with one short black-and-white slice glitch.
   --------------------------------------------------------------------------------------------- */

async function morph(rig: Rig, to: MarkState, ms = 520, peak = 120) {
  const from = rig.state;
  if (from === to) return;
  rig.state = to;
  const f = rig.fx;
  await tween(ms, (p, e) => {
    const b = smooth(0.47, 0.53, p);
    for (const s of ORDER) f.weights[s] = s === to ? b : s === from ? 1 - b : 0;
    const hump = Math.pow(Math.sin(Math.PI * p), 1.4);
    f.extra = peak * hump;
    f.freq = 0.006 * hump;
    f.glitch = p > 0.42 && p < 0.42 + 110 / ms ? 22 : 0;
    // Squash going in, elastic stretch coming out.
    const s = e / 1000;
    f.sx = p < 0.4 ? 1 + 0.12 * Math.sin((p / 0.4) * Math.PI) : 1 + 0.07 * ring(s - (ms * 0.4) / 1000, 18, 6);
    f.sy = p < 0.4 ? 1 - 0.14 * Math.sin((p / 0.4) * Math.PI) : 1 - 0.06 * ring(s - (ms * 0.4) / 1000, 18, 6);
  });
  for (const s of ORDER) f.weights[s] = s === to ? 1 : 0;
  f.extra = 0;
  f.freq = 0;
  f.glitch = 0;
  f.sx = 1;
  f.sy = 1;
}

function next(s: MarkState): MarkState {
  return ORDER[(ORDER.indexOf(s) + 1) % ORDER.length];
}

// Paint-splash confetti from a point, in the site palette.
function splash(layer: HTMLElement, x: number, y: number, radius: number, count = 10) {
  for (let i = 0; i < count; i++) {
    const d = document.createElement("span");
    const size = 6 + Math.random() * 12;
    const angle = (i / count) * Math.PI * 2 + Math.random() * 0.5;
    const dist = radius * (0.55 + Math.random() * 0.6);
    d.className = "ll-dot";
    d.style.cssText = `left:${x}px;top:${y}px;width:${size}px;height:${size}px;background:${SPLASH[i % SPLASH.length]};${
      i % 3 === 0 ? "border-radius:3px;" : ""
    }`;
    layer.appendChild(d);
    const dx = Math.cos(angle) * dist;
    const dy = Math.sin(angle) * dist;
    d.animate(
      [
        { transform: "translate(-50%,-50%) scale(0.2)", opacity: 1 },
        { transform: `translate(calc(-50% + ${dx * 0.8}px), calc(-50% + ${dy * 0.8}px)) scale(1.1) rotate(${angle}rad)`, opacity: 1, offset: 0.55 },
        { transform: `translate(calc(-50% + ${dx}px), calc(-50% + ${dy + 30}px)) scale(0)`, opacity: 0 },
      ],
      { duration: 700 + Math.random() * 300, easing: "cubic-bezier(.2,.8,.3,1)" },
    ).onfinish = () => d.remove();
  }
}

/* ---------------------------------------------------------------------------------------------
   NavLogo: rests in the header; hover (or a tap on the homepage) sends it out to perform.
   --------------------------------------------------------------------------------------------- */

const ROUTE_STATE: { test: (p: string) => boolean; state: MarkState }[] = [
  { test: (p) => p === "/", state: "signature" },
  { test: (p) => p.startsWith("/demo"), state: "morph" },
  { test: (p) => p.startsWith("/services/"), state: "blob" },
];

export function NavLogo() {
  const pathname = usePathname();
  const rig = useRef<Rig>({ fx: newFx("signature", 30), state: "signature", busy: false });
  const flyRig = useRef<Rig>({ fx: newFx("signature", 10), state: "signature", busy: false });
  const slot = useRef<HTMLSpanElement>(null);
  const flyer = useRef<HTMLDivElement>(null);
  const layer = useRef<HTMLDivElement>(null);
  const ghosts = useRef<HTMLDivElement[]>([]);
  const [mounted, setMounted] = useState(false);
  const lastRun = useRef(0);

  useEffect(() => setMounted(true), []);

  // Route defaults, timed with navigation. A running performance finishes first.
  useEffect(() => {
    const target = ROUTE_STATE.find((r) => r.test(pathname))?.state;
    if (!target || rig.current.busy) return;
    if (prefersReduced()) {
      rig.current.state = target;
      for (const s of ORDER) rig.current.fx.weights[s] = s === target ? 1 : 0;
      return;
    }
    morph(rig.current, target, 620, 90);
  }, [pathname]);

  const perform = useCallback(async () => {
    const r = rig.current;
    const now = performance.now();
    if (r.busy || now - lastRun.current < 600 || !slot.current || !flyer.current || !layer.current) return;
    if (prefersReduced()) {
      morph(r, next(r.state), 1, 0);
      return;
    }
    r.busy = true;
    const fr = flyRig.current;
    const fly = flyer.current;
    const lay = layer.current;
    const f = r.fx;

    // 1. Anticipation: crouch in place.
    await tween(150, (p) => {
      f.sx = 1 + 0.18 * Math.sin(p * Math.PI * 0.5);
      f.sy = 1 - 0.22 * Math.sin(p * Math.PI * 0.5);
      f.extra = 40 * p;
    });

    const rect = slot.current.getBoundingClientRect();
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const s0 = rect.height * 1.18; // the mark fills ~85% of its box
    const x0 = rect.left + rect.width / 2;
    const y0 = rect.top + rect.height / 2;
    const S = Math.min(vw * 0.44, vh * 0.56, 480);
    const xt = vw * (vw > 900 ? 0.56 : 0.5);
    const yt = vh * 0.5;

    // Hand over to the flyer, matching the current state.
    fr.state = r.state;
    for (const s of ORDER) fr.fx.weights[s] = s === r.state ? 1 : 0;
    f.sx = f.sy = 1;
    f.extra = 0;
    slot.current.style.opacity = "0";
    fly.style.opacity = "1";
    const place = (x: number, y: number, size: number, rot: number, sx = 1, sy = 1, el: HTMLElement = fly) => {
      el.style.width = el.style.height = `${size}px`;
      el.style.transform = `translate3d(${x - size / 2}px, ${y - size / 2}px, 0) rotate(${rot}deg) scale(${sx}, ${sy})`;
    };
    const ghostState = () => r.state;
    const setGhosts = (show: boolean) => {
      ghosts.current.forEach((g, i) => {
        g.style.opacity = show ? String(0.32 - i * 0.09) : "0";
        g.style.backgroundImage = `url(${src(ghostState(), "black")})`;
      });
    };

    // 2. Launch: dive down and swing up into the middle of the screen, growing as it goes.
    const out = (p: number) => {
      const q = outCubic(p);
      return {
        x: bez(x0, x0 + vw * 0.08, xt - vw * 0.22, xt, q),
        y: bez(y0, y0 + vh * 0.62, yt + vh * 0.32, yt, q),
        size: s0 + (S - s0) * outBack(p),
        rot: -14 * Math.sin(Math.PI * p) + 6 * (1 - p) * p,
      };
    };
    setGhosts(true);
    let prev = out(0);
    await tween(640, (p) => {
      const a = out(p);
      const v = Math.hypot(a.x - prev.x, a.y - prev.y);
      const stretch = clamp(v / 60, 0, 0.22);
      place(a.x, a.y, a.size, a.rot, 1 - stretch * 0.5, 1 + stretch);
      fr.fx.extra = 12 + stretch * 70;
      ghosts.current.forEach((g, i) => {
        const b = out(Math.max(0, p - (i + 1) * 0.06));
        place(b.x, b.y, b.size, b.rot, 1, 1, g);
      });
      prev = a;
    });
    setGhosts(false);

    // 3. Land: squash on impact, splash, ring out.
    splash(lay, xt, yt + S * 0.38, S * 0.75, 12);
    await tween(420, (p, e) => {
      const k = ring(e / 1000, 15, 7);
      place(xt, yt, S, 0, 1 + 0.16 * k, 1 - 0.18 * k);
      fr.fx.extra = 20 * (1 - p);
    });

    // 4. Perform: run through every state and back, a splash on each arrival.
    const tour = ORDER.filter((s) => s !== r.state);
    for (const s of [...tour, r.state]) {
      await morph(fr, s, 460, 85);
      splash(lay, xt, yt, S * 0.62, 8);
      await tween(90, () => {});
    }

    // 5. Return: loop up and over, then dart back into the header with a smear trail.
    const r2 = slot.current.getBoundingClientRect();
    const x1 = r2.left + r2.width / 2;
    const y1 = r2.top + r2.height / 2;
    const back = (p: number) => {
      const q = inOutCubic(p);
      return {
        x: bez(xt, xt + vw * 0.16, x1 + vw * 0.2, x1, q),
        y: bez(yt, yt - vh * 0.42, y1 - vh * 0.06, y1, q),
        size: S + (s0 - S) * Math.pow(p, 0.8),
        rot: 22 * Math.sin(Math.PI * p),
      };
    };
    setGhosts(true);
    prev = back(0);
    await tween(660, (p) => {
      const a = back(p);
      const v = Math.hypot(a.x - prev.x, a.y - prev.y);
      const stretch = clamp(v / 50, 0, 0.26);
      place(a.x, a.y, a.size, a.rot, 1 - stretch * 0.5, 1 + stretch);
      ghosts.current.forEach((g, i) => {
        const b = back(Math.max(0, p - (i + 1) * 0.05));
        place(b.x, b.y, b.size, b.rot, 1, 1, g);
      });
      prev = a;
    });
    setGhosts(false);

    // 6. Home: the header mark takes the hit and settles.
    fly.style.opacity = "0";
    slot.current.style.opacity = "1";
    splash(lay, x1, y1, 70, 9);
    await tween(620, (p, e) => {
      const k = ring(e / 1000, 17, 6.5);
      f.sx = 1 + 0.26 * k;
      f.sy = 1 - 0.22 * k;
      f.rot = -8 * k;
      f.extra = 50 * (1 - p);
    });
    f.sx = f.sy = 1;
    f.rot = 0;
    f.extra = 0;
    lastRun.current = performance.now();
    r.busy = false;
  }, []);

  // First visit to the homepage in a session: perform once so people see it's alive.
  useEffect(() => {
    if (pathname !== "/" || prefersReduced()) return;
    let seen = false;
    try {
      seen = sessionStorage.getItem("nka-logo-shown") === "1";
      sessionStorage.setItem("nka-logo-shown", "1");
    } catch {}
    if (seen) return;
    const t = setTimeout(perform, 1800);
    return () => clearTimeout(t);
  }, [pathname, perform]);

  return (
    <>
      <span
        ref={slot}
        className="ll-slot"
        onPointerEnter={(e) => {
          if (e.pointerType === "mouse") perform();
        }}
        onClick={(e) => {
          if (pathname === "/") {
            e.preventDefault();
            window.scrollTo({ top: 0, behavior: "smooth" });
            perform();
          }
        }}
      >
        <Mark ink="black" rig={rig} className="ll-nav" title="nka.studio" />
      </span>
      {mounted &&
        createPortal(
          <div ref={layer} className="ll-layer" aria-hidden="true">
            {[0, 1, 2].map((i) => (
              <div
                key={i}
                className="ll-ghost"
                ref={(el) => {
                  if (el) ghosts.current[i] = el;
                }}
              />
            ))}
            <div ref={flyer} className="ll-flyer">
              <Mark ink="sticker" rig={flyRig} className="ll-fly-svg" />
            </div>
          </div>,
          document.body,
        )}
    </>
  );
}

/* ---------------------------------------------------------------------------------------------
   StageLogo: a large instance for in-page moments. Breathes at rest, bends toward the pointer,
   and changes state on click or tap. Takes its section's default state when it comes into view.
   --------------------------------------------------------------------------------------------- */

export function StageLogo({
  ink = "black",
  initial = "signature",
  arrive,
  className,
}: {
  ink?: Ink;
  initial?: MarkState;
  arrive?: MarkState;
  className?: string;
}) {
  const rig = useRef<Rig>({ fx: newFx(initial, 12), state: initial, busy: false });
  const box = useRef<HTMLButtonElement>(null);
  const layer = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (!arrive || !box.current) return;
    let done = false;
    const io = new IntersectionObserver(
      ([e]) => {
        if (e.isIntersecting && !done) {
          done = true;
          if (prefersReduced()) {
            rig.current.state = arrive;
            for (const s of ORDER) rig.current.fx.weights[s] = s === arrive ? 1 : 0;
          } else setTimeout(() => morph(rig.current, arrive, 900, 110), 350);
        }
      },
      { threshold: 0.5 },
    );
    io.observe(box.current);
    return () => io.disconnect();
  }, [arrive]);

  const change = async () => {
    const r = rig.current;
    if (r.busy) return;
    r.busy = true;
    const target = next(r.state);
    if (layer.current && !prefersReduced()) {
      const b = box.current!.getBoundingClientRect();
      splash(layer.current, b.width / 2, b.height / 2, b.width * 0.62, 12);
    }
    await morph(r, target, prefersReduced() ? 1 : 760, 110);
    r.busy = false;
  };

  return (
    <button
      ref={box}
      type="button"
      className={`ll-stage ${className ?? ""}`}
      onClick={change}
      onPointerMove={(e) => {
        const b = e.currentTarget.getBoundingClientRect();
        const px = ((e.clientX - b.left) / b.width) * 2 - 1;
        const py = ((e.clientY - b.top) / b.height) * 2 - 1;
        const f = rig.current.fx;
        f.px = px;
        f.py = py;
        f.push = clamp(1 - Math.hypot(px, py) / 1.4, 0, 1);
      }}
      onPointerLeave={() => {
        const f = rig.current.fx;
        f.push = 0;
        f.px = 0;
        f.py = 0;
      }}
      aria-label="nka.studio logo. Press to change its form."
    >
      <Mark ink={ink} rig={rig} className="ll-stage-svg" fps={45} />
      <span ref={layer} className="ll-stage-layer" aria-hidden="true" />
    </button>
  );
}
