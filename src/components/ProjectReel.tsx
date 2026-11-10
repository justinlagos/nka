"use client";
import { useEffect, useRef, useState } from "react";
import { FILM_PROJECTS, KIND_LABEL, type Project } from "@/content/projects";
import { openProject } from "@/lib/projectView";

// The film projects as case studies. Each card plays a short preview when you point at it
// and opens the full project view.
export function ProjectReel() {
  const list = FILM_PROJECTS.filter((p) => p.kind === "concept");
  return (
    <ul className="reel">
      {list.map((p, i) => (
        <li key={p.id} className={i === 0 ? "reel-lead" : ""}>
          <ReelCard p={p} />
        </li>
      ))}
    </ul>
  );
}

function ReelCard({ p }: { p: Project }) {
  const m = p.media[0];
  const vid = useRef<HTMLVideoElement>(null);
  const [motion, setMotion] = useState(false);
  useEffect(() => {
    setMotion(!window.matchMedia("(prefers-reduced-motion: reduce)").matches && window.matchMedia("(hover: hover)").matches);
  }, []);
  if (m.kind !== "film") return null;
  const play = () => {
    if (!motion || !vid.current) return;
    if (!vid.current.src) vid.current.src = m.preview;
    vid.current.play().catch(() => {});
  };
  const stop = () => vid.current?.pause();
  const pieces = p.media.length;
  return (
    <button
      type="button"
      className="reel-card"
      onMouseEnter={play}
      onMouseLeave={stop}
      onFocus={play}
      onBlur={stop}
      onClick={(e) => {
        const r = (e.currentTarget.querySelector(".reel-media") as HTMLElement).getBoundingClientRect();
        openProject({ id: p.id, rect: { x: r.left, y: r.top, w: r.width, h: r.height } });
      }}
    >
      <span className="reel-media">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={m.poster} alt="" width={m.w} height={m.h} loading="lazy" />
        {motion && <video ref={vid} muted loop playsInline preload="none" aria-hidden="true" />}
        <span className="reel-play" aria-hidden="true">
          <svg viewBox="0 0 24 24">
            <path d="M9 7v10l8-5z" />
          </svg>
          {m.length}
        </span>
      </span>
      <span className="reel-cap">
        <b>{p.brand}</b>
        <span>{p.category}</span>
        <small>
          {KIND_LABEL[p.kind]}, film and {pieces - 1} pieces
        </small>
      </span>
    </button>
  );
}
