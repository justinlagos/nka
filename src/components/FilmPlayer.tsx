"use client";
import { useEffect, useRef } from "react";

// A muted film that plays while it is on screen and stops when it isn't. Controls stay available.
export function FilmPlayer({ src, poster, label, className }: { src: string; poster: string; label: string; className?: string }) {
  const ref = useRef<HTMLVideoElement>(null);
  useEffect(() => {
    const v = ref.current;
    if (!v || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const io = new IntersectionObserver(
      ([e]) => {
        if (e.isIntersecting) {
          if (!v.src) v.src = src;
          v.play().catch(() => {});
        } else v.pause();
      },
      { threshold: 0.4 },
    );
    io.observe(v);
    return () => io.disconnect();
  }, [src]);
  return (
    <video ref={ref} className={className} poster={poster} muted loop playsInline controls preload="none" aria-label={label}>
      <source src={src} type="video/mp4" />
    </video>
  );
}
