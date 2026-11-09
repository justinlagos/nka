"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";

// Re-reads the page every few seconds while Nka is still working on something, for up to 4 minutes.
export function AutoRefresh({ every = 4000, forMs = 240_000 }: { every?: number; forMs?: number }) {
  const router = useRouter();
  useEffect(() => {
    const started = Date.now();
    const t = setInterval(() => {
      if (Date.now() - started > forMs) return clearInterval(t);
      router.refresh();
    }, every);
    return () => clearInterval(t);
  }, [router, every, forMs]);
  return null;
}
