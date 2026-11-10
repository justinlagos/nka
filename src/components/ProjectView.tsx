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

  // A copy of the clicked piece travels from the sky to where the media sits, then hands over.
  const [settled, setSettled] = useState(!rect);
  useLayoutEffect(() => {
    const el = stage.current;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (!el || !rect || reduce || !rect.w) {
      setSettled(true);
      return;
    }
    const box = el.getBoundingClientRect();
    const ar = m.w / m.h;
    const w = Math.min(box.width, box.height * ar);
    const h = w / ar;
    const to = { x: box.left + (box.width - w) / 2, y: box.top + (box.height - h) / 2, w, h };
    const g = document.createElement("img");
    g.src = m.sky;
    g.alt = "";
    g.className = "pv-ghost";
    Object.assign(g.style, { left: rect.x + "px", top: rect.y + "px", width: rect.w + "px", height: rect.h + "px" });
    document.body.appendChild(g);
    requestAnimationFrame(() =>
      requestAnimationFrame(() => {
        Object.assign(g.style, { left: to.x + "px", top: to.y + "px", width: to.w + "px", height: to.h + "px", opacity: "0" });
      }),
    );
    const t1 = setTimeout(() => setSettled(true), 420);
    const t2 = setTimeout(() => g.remove(), 760);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      g.remove();
    };
    // Only on open.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
          <div className={`pv-stage ${settled ? "is-settled" : ""}`} ref={stage}>
            <Stage m={m} />
          </div>
          <div className="pv-strip">
            {p.media.length > 1 && (
              <ul className="pv-thumbs" aria-label="Pieces in this project">
                {p.media.map((x, k) => (
                  <li key={k}>
                    <button type="button" aria-pressed={k === i} onClick={() => setI(k)} aria-label={x.alt}>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={x.sky} alt="" loading="lazy" />
                      {x.kind === "film" && (
                        <span className="pv-film" aria-hidden="true">
                          <svg viewBox="0 0 24 24">
                            <path d="M9 7v10l8-5z" />
                          </svg>
                        </span>
                      )}
                    </button>
                  </li>
                ))}
              </ul>
            )}
            <span className="pv-count" aria-hidden="true">
              {i + 1} / {p.media.length}
            </span>
          </div>
        </div>

        <aside className="pv-side">
          <div className="pv-top">
            <span className={`pv-kind pv-kind-${p.kind}`}>{KIND_LABEL[p.kind]}</span>
            <div className="pv-tools">
              <button type="button" onClick={() => onGo(prev.id)} aria-label={`Previous project: ${prev.brand}`} title={prev.brand}>
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M14.5 6 8.5 12l6 6" />
                </svg>
              </button>
              <button type="button" onClick={() => onGo(next.id)} aria-label={`Next project: ${next.brand}`} title={next.brand}>
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <path d="m9.5 6 6 6-6 6" />
                </svg>
              </button>
              <button type="button" className="pv-x" onClick={onClose} ref={first} aria-label="Close and go back to the work">
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M6 6l12 12M18 6L6 18" />
                </svg>
              </button>
            </div>
          </div>

          <div className="pv-body">
            <p className="pv-cat">{p.category}</p>
            <h2 id="pv-title">{p.brand}</h2>
            <p className="pv-sum">{p.summary}</p>
            <p className="pv-made">
              <b>What we made</b>
              {p.made.join(", ")}
            </p>
          </div>

          <form className="pv-ask" onSubmit={start_}>
            <h3>{p.ask}</h3>
            <label htmlFor="pv-need" className="skip">
              What do you need designed?
            </label>
            <textarea
              id="pv-need"
              rows={2}
              value={need}
              maxLength={300}
              placeholder="What do you need designed?"
              onChange={(e) => setNeed(e.target.value)}
            />
            <button type="submit" className="lp-btn pv-go">
              Start a project
            </button>
            <p className="pv-fine">
              Your price is agreed on a short call and sent in writing. No card until you say yes.{" "}
              <Link href="/pricing">How pricing works</Link>
            </p>
          </form>
        </aside>
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
