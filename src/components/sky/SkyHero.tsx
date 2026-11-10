"use client";
import { useEffect, useRef, useState } from "react";
import { PromptHero } from "@/components/PromptHero";
import { PROJECTS, PROJECT_BY_ID, TOUR } from "@/content/projects";
import { CLOSE_EVENT, openProject } from "@/lib/projectView";
import type { SkyMode } from "./engine";

type Api = ReturnType<typeof import("./engine").createSky>;

// The static stand-in, shown before the 3D view loads or if it can't run. Each piece opens its project.
const STILL: { id: string; style: React.CSSProperties }[] = [
  { id: "halden", style: { left: "2.5%", top: "9%", width: "21%" } },
  { id: "boba", style: { left: "26%", top: "4%", width: "10%" } },
  { id: "runa", style: { left: "2%", top: "63%", width: "21%" } },
  { id: "studio", style: { left: "27%", top: "82%", width: "10%" } },
  { id: "northlight", style: { left: "76.5%", top: "9%", width: "21%" } },
  { id: "kofi", style: { left: "66%", top: "3%", width: "7%" } },
  { id: "haulo", style: { left: "77%", top: "63%", width: "21%" } },
  { id: "workspace", style: { left: "63%", top: "83%", width: "10%" } },
];

const firstLine = (s: string) => s.split(/(?<=\.)\s/)[0];

export function SkyHero() {
  const host = useRef<HTMLDivElement>(null);
  const api = useRef<Api | null>(null);
  const [mode, setMode] = useState<SkyMode>("home");
  const [ready, setReady] = useState(false);
  const [gl, setGl] = useState(true);
  const [step, setStep] = useState<number | null>(null);

  useEffect(() => {
    let alive = true;
    const ok = (() => {
      try {
        return Boolean(document.createElement("canvas").getContext("webgl2"));
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
        api.current = createSky(host.current, PROJECTS, {
          onMode: (m) => {
            setMode(m);
            if (m === "home" || m === "explore") setStep((s) => (m === "explore" ? null : s));
          },
          onReady: () => setReady(true),
          onOpen: (id, index, rect) => openProject({ id, index, rect }),
        });
      } catch {
        setGl(false);
      }
    });
    const onClose = () => api.current?.resume();
    window.addEventListener(CLOSE_EVENT, onClose);
    return () => {
      alive = false;
      window.removeEventListener(CLOSE_EVENT, onClose);
      api.current?.destroy();
      api.current = null;
    };
  }, []);

  const goTour = (n: number) => {
    if (n >= TOUR.length) {
      setStep(TOUR.length);
      api.current?.home();
      return;
    }
    if (!api.current) {
      openProject({ id: TOUR[n] });
      return;
    }
    setStep(n);
    api.current.tour(TOUR[n]);
  };
  const endTour = (to: "home" | "explore" = "home") => {
    setStep(null);
    if (to === "explore") api.current?.explore();
    else api.current?.home();
  };
  const toBrief = () => {
    endTour("home");
    requestAnimationFrame(() => document.getElementById("need")?.focus());
  };

  const onKey = (e: React.KeyboardEvent) => {
    const a = api.current;
    if (!a) return;
    const map: Record<string, () => void> = {
      ArrowLeft: () => a.pan(-1.2, 0),
      ArrowRight: () => a.pan(1.2, 0),
      ArrowUp: () => a.pan(0, 1.2),
      ArrowDown: () => a.pan(0, -1.2),
      "+": () => a.zoom(1),
      "=": () => a.zoom(1),
      "-": () => a.zoom(-1),
      Escape: () => endTour("home"),
    };
    const fn = map[e.key];
    if (fn) {
      e.preventDefault();
      fn();
    }
  };

  const touring = step !== null && step < TOUR.length;
  const tp = touring ? PROJECT_BY_ID[TOUR[step]] : null;
  const shownMode = step === TOUR.length ? "tour" : mode;

  return (
    <section className={`sky is-${shownMode} ${ready ? "is-ready" : ""}`} aria-label="nka.studio">
      <div
        ref={host}
        className="sky-stage"
        tabIndex={gl ? 0 : -1}
        onKeyDown={onKey}
        aria-label="Example work hanging in the sky. Drag to look around, use plus and minus to fly in and out, press Escape to return."
      >
        <div className="sky-still">
          {STILL.map((s) => {
            const p = PROJECT_BY_ID[s.id];
            const m = p.media[0];
            return (
              <button
                key={s.id}
                type="button"
                style={s.style}
                tabIndex={ready ? -1 : 0}
                onClick={() => openProject({ id: s.id })}
                aria-label={`${p.brand}, ${p.category}`}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={m.sky} alt="" width={m.w} height={m.h} />
              </button>
            );
          })}
        </div>
      </div>

      <div className="sky-copy">
        <h1>
          Hand us the design work. <em>All of it.</em>
        </h1>
        <p className="sky-lede">
          Senior designers, supported by AI. Tell us what you need, see a delivery date straight away, and get finished files
          in one workspace.
        </p>
        <div className="sky-ask">
          <PromptHero />
        </div>
        <div className="sky-actions">
          <button type="button" className="sky-btn" onClick={() => (api.current ? api.current.explore() : openProject({ id: "halden" }))}>
            Explore our work
          </button>
          <button type="button" className="sky-link" onClick={() => goTour(0)}>
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <circle cx="12" cy="12" r="10" />
              <path d="M10 8.5v7l5.5-3.5z" />
            </svg>
            Take a closer look
          </button>
        </div>
      </div>

      {tp && (
        <div className="sky-card" role="dialog" aria-label={`${tp.brand}, ${step! + 1} of ${TOUR.length}`} key={tp.id}>
          <p className="sky-card-step">
            {step! + 1} of {TOUR.length}
            <span>{tp.category}</span>
          </p>
          <h2>{tp.brand}</h2>
          <p>{firstLine(tp.summary)}</p>
          <div className="sky-card-actions">
            <button type="button" className="sky-card-open" onClick={() => api.current?.openFramed()}>
              {tp.media[0].kind === "film" ? "Watch the film" : "Open the project"}
            </button>
            <button type="button" className="sky-card-next" onClick={() => goTour(step! + 1)}>
              {step! + 1 < TOUR.length ? `Next: ${PROJECT_BY_ID[TOUR[step! + 1]].brand}` : "Finish"}
            </button>
          </div>
          <button type="button" className="sky-card-x" onClick={() => endTour("home")} aria-label="End the tour">
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M6 6l12 12M18 6L6 18" />
            </svg>
          </button>
        </div>
      )}
      {step === TOUR.length && (
        <div className="sky-card sky-card-end" role="dialog" aria-label="Start your brief">
          <h2>Seen what we can do? Tell us what you need.</h2>
          <p>Write one line about the job. It becomes your first brief, with a delivery date.</p>
          <div className="sky-card-actions">
            <button type="button" className="sky-card-open sky-card-cta" onClick={toBrief}>
              Write my brief
            </button>
            <button type="button" className="sky-card-next" onClick={() => endTour("explore")}>
              Keep exploring
            </button>
          </div>
        </div>
      )}

      {gl && (
        <div className="sky-ctrl" role="group" aria-label="Move around the work">
          <p className="sky-hint">Drag to look around. Scroll or pinch to fly. Click any piece.</p>
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
          <button type="button" onClick={() => endTour("home")} className="sky-home">
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M4 11.5 12 5l8 6.5M6.5 10v8.5h11V10" />
            </svg>
            <span>Back to start</span>
          </button>
        </div>
      )}

      <p className="sky-note">Studio concepts for invented brands</p>

      <nav className="sky-index" aria-label="Projects in the sky">
        <ul>
          {PROJECTS.map((p) => (
            <li key={p.id}>
              <button type="button" onClick={() => openProject({ id: p.id })}>
                {p.brand}
                <span className="skip">, {p.category}</span>
              </button>
            </li>
          ))}
        </ul>
      </nav>
    </section>
  );
}
