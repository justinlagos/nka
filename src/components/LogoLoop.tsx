"use client";
import { useEffect, useRef, useState } from "react";

// The living identity loop. Plays only while on screen; a still frame when motion is reduced.
export function LogoLoop({ tone = "dark", className = "" }: { tone?: "dark" | "light"; className?: string }) {
  const ref = useRef<HTMLVideoElement>(null);
  const [still, setStill] = useState(false);
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setStill(true);
      return;
    }
    const v = ref.current;
    if (!v) return;
    const io = new IntersectionObserver(([e]) => (e.isIntersecting ? v.play().catch(() => {}) : v.pause()), { threshold: 0.2 });
    io.observe(v);
    return () => io.disconnect();
  }, []);
  const poster = `/brand/poster-${tone}.png`;
  if (still) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={poster} alt="nka.studio" className={className} width={1080} height={1080} />;
  }
  return (
    <video ref={ref} className={className} muted loop playsInline preload="none" poster={poster} aria-label="nka.studio identity" width={1080} height={1080}>
      <source src={`/brand/loop-${tone}.mp4`} type="video/mp4" />
      <source src={`/brand/loop-${tone}.webm`} type="video/webm" />
    </video>
  );
}
