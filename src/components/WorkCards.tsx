"use client";
import { useEffect, useRef, useState } from "react";
import { KIND_LABEL, PROJECT_BY_ID } from "@/content/projects";
import { openProject } from "@/lib/projectView";

// A row of projects that open in the project view. Films preview when you point at them.
export function WorkCards({ ids }: { ids: string[] }) {
  return (
    <ul className="wc">
      {ids.map((id) => (PROJECT_BY_ID[id] ? <Card key={id} id={id} /> : null))}
    </ul>
  );
}

function Card({ id }: { id: string }) {
  const p = PROJECT_BY_ID[id];
  const m = p.media[0];
  const vid = useRef<HTMLVideoElement>(null);
  const [motion, setMotion] = useState(false);
  useEffect(() => {
    setMotion(!window.matchMedia("(prefers-reduced-motion: reduce)").matches && window.matchMedia("(hover: hover)").matches);
  }, []);
  const play = () => {
    if (!motion || !vid.current || m.kind !== "film") return;
    if (!vid.current.src) vid.current.src = m.preview;
    vid.current.play().catch(() => {});
  };
  return (
    <li>
      <button
        type="button"
        className="reel-card"
        onMouseEnter={play}
        onMouseLeave={() => vid.current?.pause()}
        onClick={(e) => {
          const r = (e.currentTarget.querySelector(".reel-media") as HTMLElement).getBoundingClientRect();
          openProject({ id, rect: { x: r.left, y: r.top, w: r.width, h: r.height } });
        }}
      >
        <span className="reel-media">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={m.kind === "film" ? m.poster : m.sky} alt="" loading="lazy" />
          {m.kind === "film" && motion && <video ref={vid} muted loop playsInline preload="none" aria-hidden="true" />}
          {m.kind === "film" && (
            <span className="reel-play" aria-hidden="true">
              <svg viewBox="0 0 24 24">
                <path d="M9 7v10l8-5z" />
              </svg>
              {m.length}
            </span>
          )}
        </span>
        <span className="reel-cap">
          <b>{p.brand}</b>
          <span>{p.category}</span>
          <small>{KIND_LABEL[p.kind]}</small>
        </span>
      </button>
    </li>
  );
}
