"use client";
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { KIND_LABEL, PROJECTS, PROJECT_BY_ID, type Media } from "@/content/projects";
import { CLOSE_EVENT, OPEN_EVENT, type OpenDetail, type OpenRect } from "@/lib/projectView";

// The project view: one project as a small world. Larger media, the film when there is one,
// the other pieces of the system, what was made, and a brief that starts from this project.
export function ProjectViewHost() {
  const [open, setOpen] = useState<{ id: string; index: number; rect: OpenRect | null } | null>(null);
  const back = useRef<HTMLElement | null>(null);

  useEffect(() => {
    const onOpen = (e: Event) => {
      const d = (e as CustomEvent<OpenDetail>).detail;
      if (!PROJECT_BY_ID[d.id]) return;
      back.current = document.activeElement as HTMLElement | null;
      setOpen({ id: d.id, index: d.index ?? 0, rect: d.rect ?? null });
    };
    window.addEventListener(OPEN_EVENT, onOpen);
    return () => window.removeEventListener(OPEN_EVENT, onOpen);
  }, []);

  const close = useCallback(() => {
    setOpen((o) => {
      if (o) window.dispatchEvent(new CustomEvent(CLOSE_EVENT, { detail: { id: o.id } }));
      return null;
    });
    requestAnimationFrame(() => back.current?.focus?.({ preventScroll: true }));
  }, []);

  if (!open) return null;
  return (
    <ProjectView
      key={open.id}
      id={open.id}
      start={open.index}
      rect={open.rect}
      onClose={close}
      onGo={(id) => setOpen({ id, index: 0, rect: null })}
    />
  );
}

function ProjectView({
  id,
  start,
  rect,
  onClose,
  onGo,
}: {
  id: string;
  start: number;
  rect: OpenRect | null;
  onClose: () => void;
  onGo: (id: string) => void;
}) {
  const router = useRouter();
  const p = PROJECT_BY_ID[id];
  const [i, setI] = useState(Math.min(start, p.media.length - 1));
  const [need, setNeed] = useState(p.need);
  const dialog = useRef<HTMLDivElement>(null);
  const stage = useRef<HTMLDivElement>(null);
  const first = useRef<HTMLButtonElement>(null);
  const m = p.media[i];
  const at = PROJECTS.findIndex((x) => x.id === id);
  const next = PROJECTS[(at + 1) % PROJECTS.length];
  const prev = PROJECTS[(at - 1 + PROJECTS.length) % PROJECTS.length];

  // Grow out of the piece that was clicked.
  useLayoutEffect(() => {
    const el = stage.current;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (!el || !rect || reduce) return;
    const to = el.getBoundingClientRect();
    if (!to.width || !rect.w) return;
    const sx = rect.w / to.width;
    const sy = rect.h / to.height;
    el.style.transformOrigin = "0 0";
    el.style.transform = `translate(${rect.x - to.left}px, ${rect.y - to.top}px) scale(${sx}, ${sy})`;
    el.style.transition = "none";
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        el.style.transition = "transform 560ms cubic-bezier(.2,.8,.2,1)";
        el.style.transform = "none";
      });
    });
  }, [rect]);

  useEffect(() => {
    const html = document.documentElement;
    const prevOverflow = html.style.overflow;
    html.style.overflow = "hidden";
    first.current?.focus({ preventScroll: true });
    return () => {
      html.style.overflow = prevOverflow;
    };
  }, []);

  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") {
      e.preventDefault();
      onClose();
    } else if (e.key === "Tab" && dialog.current) {
      const f = [...dialog.current.querySelectorAll<HTMLElement>("button, a, input, video, [tabindex]:not([tabindex='-1'])")].filter(
        (x) => !x.hasAttribute("disabled") && x.offsetParent !== null,
      );
      if (!f.length) return;
      const a = f[0];
      const b = f[f.length - 1];
      if (e.shiftKey && document.activeElement === a) {
        e.preventDefault();
        b.focus();
      } else if (!e.shiftKey && document.activeElement === b) {
        e.preventDefault();
        a.focus();
      }
    } else if ((e.key === "ArrowRight" || e.key === "ArrowLeft") && !(e.target instanceof HTMLInputElement)) {
      const n = p.media.length;
      if (n > 1) setI((x) => (x + (e.key === "ArrowRight" ? 1 : n - 1)) % n);
    }
  };

  const start_ = (e: React.FormEvent) => {
    e.preventDefault();
    const t = need.trim();
    router.push(t ? `/demo?need=${encodeURIComponent(t)}` : "/demo");
  };

  return (
    <div className="pv" onKeyDown={onKey} onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="pv-panel" role="dialog" aria-modal="true" aria-labelledby="pv-title" ref={dialog}>
        <div className="pv-media">
          <div className="pv-stage" ref={stage} style={{ aspectRatio: `${m.w} / ${m.h}`, maxWidth: `calc((100svh - 190px) * ${(m.w / m.h).toFixed(3)})` }}>
            <Stage m={m} />
          </div>
          {p.media.length > 1 && (
            <ul className="pv-thumbs" aria-label="Pieces in this project">
              {p.media.map((x, k) => (
                <li key={k}>
                  <button type="button" aria-pressed={k === i} onClick={() => setI(k)} aria-label={x.alt}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={x.sky} alt="" loading="lazy" />
                    {x.kind === "film" && <span className="pv-film">Film</span>}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="pv-side">
          <div className="pv-top">
            <span className={`pv-kind pv-kind-${p.kind}`}>{KIND_LABEL[p.kind]}</span>
            <button type="button" className="pv-x" onClick={onClose} ref={first} aria-label="Close and go back to the work">
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d="M6 6l12 12M18 6L6 18" />
              </svg>
            </button>
          </div>
          <p className="pv-cat">{p.category}</p>
          <h2 id="pv-title">{p.brand}</h2>
          <p className="pv-sum">{p.summary}</p>
          <ul className="pv-made" aria-label="What was made">
            {p.made.map((x) => (
              <li key={x}>{x}</li>
            ))}
          </ul>

          <form className="pv-ask" onSubmit={start_}>
            <h3>{p.ask}</h3>
            <label htmlFor="pv-need">Tell us what you need. We&apos;ll start your brief with it.</label>
            <div className="pv-field">
              <input
                id="pv-need"
                value={need}
                maxLength={300}
                autoComplete="off"
                placeholder="What do you need designed?"
                onChange={(e) => setNeed(e.target.value)}
              />
              <button type="submit" className="lp-btn">
                Start a project
              </button>
            </div>
            <p className="pv-fine">
              Your monthly price is agreed on a short call and sent in writing. No card until you say yes.{" "}
              <Link href="/pricing">How pricing works</Link>
            </p>
          </form>

          <nav className="pv-nav" aria-label="More projects">
            <button type="button" onClick={() => onGo(prev.id)}>
              <small>Previous</small>
              {prev.brand}
            </button>
            <button type="button" onClick={() => onGo(next.id)}>
              <small>Next</small>
              {next.brand}
            </button>
          </nav>
        </div>
      </div>
    </div>
  );
}

function Stage({ m }: { m: Media }) {
  const [still] = useState(() => typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches);
  if (m.kind === "film") {
    return (
      <video
        key={m.src}
        className="pv-video"
        src={m.src}
        poster={m.poster}
        controls
        autoPlay={!still}
        muted
        playsInline
        preload="auto"
        aria-label={m.alt}
      />
    );
  }
  // eslint-disable-next-line @next/next/no-img-element
  return <img key={m.src} src={m.src} alt={m.alt} width={m.w} height={m.h} className="pv-img" />;
}
