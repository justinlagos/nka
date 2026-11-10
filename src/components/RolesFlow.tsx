"use client";
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import Link from "next/link";
import { OUTCOMES, ROLES } from "@/content/landing";
import { openProject } from "@/lib/projectView";

// Who sends what, and what comes back. Pick a person and the line runs from their request,
// through the workspace, to the finished work they'd get. Every tile opens the real project.
type Path = { d: string; key: string };

export function RolesFlow() {
  const [on, setOn] = useState(0);
  const [paths, setPaths] = useState<Path[]>([]);
  const [held, setHeld] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  const roleRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const tileRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const hub = useRef<HTMLDivElement>(null);
  const active = ROLES[on];

  const measure = useCallback(() => {
    const b = box.current?.getBoundingClientRect();
    const r = roleRefs.current[on]?.getBoundingClientRect();
    const h = hub.current?.getBoundingClientRect();
    if (!b || !r || !h || window.innerWidth < 960) {
      setPaths([]);
      return;
    }
    const x1 = r.right - b.left;
    const y1 = r.top + r.height / 2 - b.top;
    const hx = h.left + h.width / 2 - b.left;
    const hy = h.top + h.height / 2 - b.top;
    const hr = h.width / 2;
    const out: Path[] = [{ key: "in", d: `M${x1} ${y1} C ${x1 + 70} ${y1}, ${hx - hr - 70} ${hy}, ${hx - hr} ${hy}` }];
    // Lines stop at the edge of the work, one per row, so they never cross a tile.
    const grid = tileRefs.current[0]?.closest("ul")?.getBoundingClientRect();
    const rows = new Set<number>();
    active.get.forEach((id) => {
      const k = OUTCOMES.findIndex((o) => o.id === id);
      const t = tileRefs.current[k]?.getBoundingClientRect();
      if (!t || !grid) return;
      const y2 = Math.round(t.top + t.height / 2 - b.top);
      if (rows.has(y2)) return;
      rows.add(y2);
      const x2 = grid.left - b.left - 8;
      out.push({ key: id, d: `M${hx + hr} ${hy} C ${hx + hr + 50} ${hy}, ${x2 - 50} ${y2}, ${x2} ${y2}` });
    });
    setPaths(out);
  }, [on, active]);

  useLayoutEffect(() => {
    measure();
  }, [measure]);
  useEffect(() => {
    const ro = new ResizeObserver(measure);
    if (box.current) ro.observe(box.current);
    return () => ro.disconnect();
  }, [measure]);

  // Walk through the people on its own while the section is in view, until someone takes over.
  useEffect(() => {
    if (held || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    let visible = false;
    const io = new IntersectionObserver(([e]) => (visible = e.isIntersecting), { threshold: 0.35 });
    if (box.current) io.observe(box.current);
    const t = setInterval(() => visible && setOn((x) => (x + 1) % ROLES.length), 3400);
    return () => {
      clearInterval(t);
      io.disconnect();
    };
  }, [held]);

  const pick = (i: number) => {
    setHeld(true);
    setOn(i);
  };

  return (
    <div className="rf" ref={box}>
      <ul className="rf-roles" aria-label="Who sends briefs">
        {ROLES.map((r, i) => (
          <li key={r.id}>
            <button
              type="button"
              ref={(el) => {
                roleRefs.current[i] = el;
              }}
              className={i === on ? "on" : ""}
              aria-pressed={i === on}
              onMouseEnter={() => pick(i)}
              onFocus={() => pick(i)}
              onClick={() => pick(i)}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={r.img} alt="" width={56} height={56} />
              <span>
                <b>{r.role}</b>
                <small>{r.asks}</small>
              </span>
            </button>
          </li>
        ))}
      </ul>

      <div className="rf-hub-col" aria-hidden="true">
        <div className="rf-hub" ref={hub}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/brand/signature-white.png" alt="" width={677} height={630} />
        </div>
        <span>One workspace</span>
      </div>

      <ul className="rf-out" aria-label={`What comes back for a ${active.role.toLowerCase()}`}>
        {OUTCOMES.map((o, k) => {
          const lit = active.get.includes(o.id);
          return (
            <li key={o.id} className={lit ? "lit" : ""}>
              <button
                type="button"
                ref={(el) => {
                  tileRefs.current[k] = el;
                }}
                onClick={(e) => {
                  const im = e.currentTarget.querySelector("img")!.getBoundingClientRect();
                  openProject({ id: o.id, rect: { x: im.left, y: im.top, w: im.width, h: im.height } });
                }}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={o.img} alt="" loading="lazy" />
                <span>
                  <b>{o.title}</b>
                  <small>{o.brand}</small>
                </span>
              </button>
            </li>
          );
        })}
      </ul>

      <svg className="rf-lines" aria-hidden="true">
        {paths.map((p, i) => (
          <g key={`${on}-${p.key}`}>
            <path d={p.d} className="rf-line" pathLength={1} style={{ animationDelay: `${i ? 260 + i * 80 : 0}ms` }} />
            <circle r={4} className="rf-dot">
              <animateMotion dur="1.8s" repeatCount="indefinite" begin={`${i ? 0.4 + i * 0.15 : 0}s`} path={p.d} />
            </circle>
          </g>
        ))}
      </svg>

      <p className="rf-foot">
        <span>
          {active.role}: <b>{active.asks.toLowerCase()}</b>. Sent once, made by a designer, delivered in every size.
        </span>
        <Link href={`/demo?need=${encodeURIComponent(active.need)}`} className="lp-btn">
          Send a brief like this
        </Link>
      </p>
    </div>
  );
}
