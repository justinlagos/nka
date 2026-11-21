"use client";
import { useEffect, useRef, useState } from "react";
import type { CardSpec } from "@/lib/api/endpoints/ecards";

type Particle = { x: number; y: number; vx: number; vy: number; r: number; a: number; spin: number; c: string };

// The card a recipient sees: a closed cover with one button, then the message with a short
// animation in the brand's colours. With reduced motion on, it opens to a still card.
export function CardView({ spec, token, name, count }: { spec: CardSpec; token: string; name: string; count: boolean }) {
  const [open, setOpen] = useState(false);
  const canvas = useRef<HTMLCanvasElement>(null);
  const { primary, accent, onPrimary, ink } = spec.colours;

  useEffect(() => {
    if (!open) return;
    const el = canvas.current;
    const ctx = el?.getContext("2d");
    if (!el || !ctx || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    let raf = 0;
    let w = 0;
    let h = 0;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const size = () => {
      w = el.clientWidth;
      h = el.clientHeight;
      el.width = w * dpr;
      el.height = h * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    size();
    window.addEventListener("resize", size);
    const colours = [accent, onPrimary, "#ffffff"];
    const rand = (a: number, b: number) => a + Math.random() * (b - a);
    const n = spec.template === "glow" ? 7 : spec.template === "snow" ? 90 : 140;
    const parts: Particle[] = Array.from({ length: n }, (_, i) =>
      spec.template === "confetti"
        ? { x: w / 2, y: h * 0.45, vx: rand(-7, 7), vy: rand(-13, -3), r: rand(4, 9), a: rand(0, 6.28), spin: rand(-0.2, 0.2), c: colours[i % 3] }
        : spec.template === "snow"
          ? { x: rand(0, w), y: rand(-h, 0), vx: rand(-0.4, 0.4), vy: rand(0.6, 2), r: rand(1.2, 3.6), a: rand(0, 6.28), spin: rand(0.01, 0.03), c: "#ffffff" }
          : { x: rand(0, w), y: rand(0, h), vx: rand(-0.25, 0.25), vy: rand(-0.25, 0.25), r: rand(120, 260), a: 0, spin: 0, c: i % 2 ? accent : onPrimary },
    );
    const start = performance.now();
    const draw = (now: number) => {
      ctx.clearRect(0, 0, w, h);
      for (const p of parts) {
        p.x += p.vx;
        p.y += p.vy;
        p.a += p.spin;
        if (spec.template === "confetti") {
          p.vy += 0.22;
          p.vx *= 0.992;
          ctx.save();
          ctx.translate(p.x, p.y);
          ctx.rotate(p.a);
          ctx.fillStyle = p.c;
          ctx.fillRect(-p.r, -p.r / 2.4, p.r * 2, p.r / 1.2);
          ctx.restore();
        } else if (spec.template === "snow") {
          p.x += Math.sin(p.a) * 0.5;
          if (p.y > h + 6) {
            p.y = -6;
            p.x = rand(0, w);
          }
          ctx.globalAlpha = 0.85;
          ctx.fillStyle = p.c;
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.r, 0, 6.28);
          ctx.fill();
          ctx.globalAlpha = 1;
        } else {
          if (p.x < -p.r || p.x > w + p.r) p.vx *= -1;
          if (p.y < -p.r || p.y > h + p.r) p.vy *= -1;
          const g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.r);
          g.addColorStop(0, p.c + "44");
          g.addColorStop(1, p.c + "00");
          ctx.fillStyle = g;
          ctx.fillRect(p.x - p.r, p.y - p.r, p.r * 2, p.r * 2);
        }
      }
      // Confetti is a burst; stop drawing once it has fallen away.
      if (spec.template !== "confetti" || now - start < 6000) raf = requestAnimationFrame(draw);
      else ctx.clearRect(0, 0, w, h);
    };
    raf = requestAnimationFrame(draw);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", size);
    };
  }, [open, spec.template, accent, onPrimary]);

  const reveal = () => {
    setOpen(true);
    if (count) fetch(`/c/${token}/open`, { method: "POST", keepalive: true }).catch(() => {});
  };

  const mark = spec.logo ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={spec.logo} alt={`${spec.brand} logo`} style={{ maxHeight: 56, maxWidth: 180, objectFit: "contain", background: "#fff", padding: 8, borderRadius: 8 }} />
  ) : (
    <b style={{ fontFamily: spec.fonts.heading, fontSize: 20 }}>{spec.brand}</b>
  );

  return (
    <main
      id="main"
      style={{ minHeight: "100dvh", background: primary, color: onPrimary, fontFamily: spec.fonts.body, display: "grid", placeItems: "center", padding: "clamp(20px, 5vw, 56px)", position: "relative", overflow: "hidden" }}
    >
      {spec.fonts.href && <link rel="stylesheet" href={spec.fonts.href} />}
      <style>{`.nka-card-in{animation:nka-card-in .7s cubic-bezier(.2,.7,.1,1) both}@keyframes nka-card-in{from{opacity:0;transform:translateY(18px)}to{opacity:1;transform:none}}@media (prefers-reduced-motion: reduce){.nka-card-in{animation:none}}`}</style>
      <canvas ref={canvas} aria-hidden="true" style={{ position: "absolute", inset: 0, width: "100%", height: "100%", pointerEvents: "none" }} />
      {!open ? (
        <div style={{ textAlign: "center", display: "grid", gap: 28, justifyItems: "center", position: "relative" }}>
          {mark}
          <p style={{ margin: 0, fontSize: 18 }}>{name ? `${name}, you have a card from ${spec.brand}.` : `You have a card from ${spec.brand}.`}</p>
          <button
            type="button"
            onClick={reveal}
            style={{ font: "inherit", fontWeight: 700, fontSize: 18, padding: "16px 32px", borderRadius: 999, border: 0, cursor: "pointer", background: onPrimary, color: primary }}
          >
            Open your card
          </button>
        </div>
      ) : (
        <article
          className="nka-card-in"
          style={{ position: "relative", width: "min(100%, 620px)", background: "#ffffff", color: ink, borderRadius: 16, padding: "clamp(24px, 6vw, 56px)", boxShadow: "0 24px 80px rgba(0,0,0,.28)", borderTop: `8px solid ${accent}` }}
        >
          <div style={{ marginBottom: 28 }}>{mark}</div>
          <h1 style={{ fontFamily: spec.fonts.heading, fontSize: "clamp(30px, 6vw, 46px)", lineHeight: 1.08, letterSpacing: "-0.02em", margin: "0 0 20px", overflowWrap: "anywhere" }}>{spec.headline}</h1>
          <p style={{ fontSize: 18, lineHeight: 1.55, margin: 0, whiteSpace: "pre-line" }}>{spec.message}</p>
          {(spec.sender.name || spec.sender.title) && (
            <p style={{ margin: "28px 0 0", fontSize: 16 }}>
              <b>{spec.sender.name}</b>
              {spec.sender.title && (
                <>
                  <br />
                  <span style={{ opacity: 0.75 }}>{spec.sender.title}</span>
                </>
              )}
            </p>
          )}
          {spec.cta && (
            <p style={{ margin: "28px 0 0" }}>
              <a href={spec.cta.url} rel="noopener noreferrer" style={{ display: "inline-block", background: primary, color: onPrimary, padding: "13px 24px", borderRadius: 999, fontWeight: 700, textDecoration: "none" }}>
                {spec.cta.label}
              </a>
            </p>
          )}
        </article>
      )}
    </main>
  );
}
