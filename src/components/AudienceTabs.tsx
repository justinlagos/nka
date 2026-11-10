"use client";
import { useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { AUDIENCES, LP_IMG } from "@/content/landing";

// One panel per kind of customer: what changes for them, in their terms.
export function AudienceTabs() {
  const [active, setActive] = useState(AUDIENCES[0].id);
  const tabs = useRef<(HTMLButtonElement | null)[]>([]);
  const a = AUDIENCES.find((x) => x.id === active) ?? AUDIENCES[0];
  const img = LP_IMG[a.img];
  const move = (i: number) => {
    const n = (i + AUDIENCES.length) % AUDIENCES.length;
    setActive(AUDIENCES[n].id);
    tabs.current[n]?.focus();
  };
  return (
    <div className="aud">
      <div className="aud-tabs" role="tablist" aria-label="Who it's for">
        {AUDIENCES.map((x, i) => (
          <button
            key={x.id}
            ref={(el) => {
              tabs.current[i] = el;
            }}
            role="tab"
            id={`tab-${x.id}`}
            aria-selected={x.id === active}
            aria-controls={`panel-${x.id}`}
            tabIndex={x.id === active ? 0 : -1}
            className={x.id === active ? "on" : ""}
            onClick={() => setActive(x.id)}
            onKeyDown={(e) => {
              if (e.key === "ArrowRight") move(i + 1);
              if (e.key === "ArrowLeft") move(i - 1);
            }}
          >
            {x.tab}
          </button>
        ))}
      </div>
      <div className="aud-panel" role="tabpanel" id={`panel-${a.id}`} aria-labelledby={`tab-${a.id}`} key={a.id}>
        <div className="aud-copy">
          <h3>{a.title}</h3>
          <ul>
            {a.points.map((p) => (
              <li key={p}>{p}</li>
            ))}
          </ul>
          <Link href="/demo" className="lp-btn">
            Book a demo
          </Link>
        </div>
        <div className="aud-img">
          <Image src={img.src} alt={img.alt} width={img.w} height={img.h} sizes="(max-width: 900px) 92vw, 50vw" />
        </div>
      </div>
    </div>
  );
}
