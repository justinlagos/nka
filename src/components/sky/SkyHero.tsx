"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { PromptHero } from "@/components/PromptHero";
import type { SkyMode, SkyWork } from "./engine";

type Api = ReturnType<typeof import("./engine").createSky>;

// Where the static stand-in places the first pieces before the 3D view loads (or if it can't).
const STILL = [
  { left: "3%", top: "8%", width: "19%" },
  { left: "23%", top: "4%", width: "8%" },
  { left: "11%", top: "44%", width: "8%" },
  { left: "2%", top: "62%", width: "22%" },
  { left: "69%", top: "3%", width: "8%" },
  { left: "79%", top: "12%", width: "18%" },
  { left: "90%", top: "47%", width: "8%" },
  { left: "71%", top: "46%", width: "7%" },
  { left: "77%", top: "62%", width: "21%" },
];

export function SkyHero({ works }: { works: SkyWork[] }) {
  const host = useRef<HTMLDivElement>(null);
  const api = useRef<Api | null>(null);
  const [mode, setMode] = useState<SkyMode>("home");
  const [ready, setReady] = useState(false);
  const [focus, setFocus] = useState<SkyWork | null>(null);
  const [tip, setTip] = useState<{ label: string; x: number; y: number } | null>(null);
  const [gl, setGl] = useState(true);

  useEffect(() => {
    let alive = true;
    const ok = (() => {
      try {
        const c = document.createElement("canvas");
        return Boolean(c.getContext("webgl2"));
      } catch {
        return false;
      }
    })();
    if (!ok) {
      setGl(false);
      return;
    }
    import("./engine").then(({ createSky }) => {
      if (!alive || !host.current) return;
      try {
        api.current = createSky(host.current, works, {
          onMode: setMode,
          onFocus: setFocus,
          onHover: (label, x, y) => setTip(label ? { label, x, y } : null),
          onReady: () => setReady(true),
        });
      } catch {
        setGl(false);
      }
    });
    return () => {
      alive = false;
      api.current?.destroy();
      api.current = null;
    };
  }, [works]);

  const onKey = (e: React.KeyboardEvent) => {
    const a = api.current;
    if (!a) return;
    const step = 1.2;
    const map: Record<string, () => void> = {
      ArrowLeft: () => a.pan(-step, 0),
      ArrowRight: () => a.pan(step, 0),
      ArrowUp: () => a.pan(0, step),
      ArrowDown: () => a.pan(0, -step),
      "+": () => a.zoom(1),
      "=": () => a.zoom(1),
      "-": () => a.zoom(-1),
      Escape: () => a.home(),
    };
    const fn = map[e.key];
    if (fn) {
      e.preventDefault();
      fn();
    }
  };

  return (
    <section className={`sky is-${mode} ${ready ? "is-ready" : ""}`} aria-label="nka.studio">
      <div
        ref={host}
        className="sky-stage"
        tabIndex={0}
        onKeyDown={onKey}
        aria-label="A sky full of example design work. Drag to move, use plus and minus to fly in and out, press Escape to return."
      >
        <div className="sky-still" aria-hidden="true">
          {works.slice(0, STILL.length).map((w, i) => (
            // eslint-disable-next-line @next/next/no-img-element
            <img key={i} src={w.src} alt="" style={STILL[i]} width={w.w} height={w.h} />
          ))}
        </div>
      </div>

      <div className="sky-copy">
        <h1>
          Hand us the design work. <em>All of it.</em>
        </h1>
        <p className="sky-lede">
          Senior designers and AI on one monthly plan. Say what you need, see a delivery date straight away, and get finished
          files in your brand. Built for agencies and teams that never run out of design work.
        </p>
        <div className="sky-ask">
          <PromptHero />
        </div>
        <div className="sky-actions">
          <Link href="/demo" className="lp-btn lp-btn-lg">
            Book a demo
          </Link>
          {gl && (
            <button type="button" className="lp-btn lp-btn-lg lp-btn-glass" onClick={() => api.current?.explore()}>
              Explore the work
            </button>
          )}
        </div>
      </div>

      {tip && mode !== "focus" && (
        <span className="sky-tip" style={{ transform: `translate(${tip.x + 16}px, ${tip.y + 18}px)` }} aria-hidden="true">
          {tip.label}
        </span>
      )}

      {focus && (
        <div className="sky-focus" role="dialog" aria-label={focus.label}>
          <span>{focus.label}</span>
          <Link href={`/demo?need=${encodeURIComponent(focus.need)}`} className="lp-btn lp-btn-sm">
            Start a brief like this
          </Link>
          <button type="button" className="sky-x" onClick={() => api.current?.home()} aria-label="Back to start">
            ×
          </button>
        </div>
      )}

      {gl && (
        <>
          <p className="sky-hint">Drag to explore. Pinch or scroll to fly. Click any piece.</p>
          <div className="sky-ctrl" role="group" aria-label="Move around the work">
            <button type="button" onClick={() => api.current?.zoom(-1)} aria-label="Fly back">
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d="M6 12h12" />
              </svg>
            </button>
            <button type="button" onClick={() => api.current?.zoom(1)} aria-label="Fly forward">
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d="M6 12h12M12 6v12" />
              </svg>
            </button>
            <button type="button" onClick={() => api.current?.home()} aria-label="Back to start" className="sky-home">
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d="M4 11.5 12 5l8 6.5M6.5 10v8.5h11V10" />
              </svg>
              <span>Back to start</span>
            </button>
          </div>
        </>
      )}
    </section>
  );
}
