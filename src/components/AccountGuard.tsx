"use client";
import { useEffect } from "react";

// One browser holds one sign-in. If this tab was opened as one account and the browser has
// since signed in as another (in another tab or from an email link), reload into the right area
// instead of showing the old account's screens.
export function AccountGuard({ userId }: { userId: string }) {
  useEffect(() => {
    let channel: BroadcastChannel | null = null;
    const moveOn = () => window.location.assign("/go?switched=1");
    try {
      channel = new BroadcastChannel("nka-account");
      channel.postMessage(userId);
      channel.onmessage = (e) => {
        if (typeof e.data === "string" && e.data !== userId) moveOn();
      };
    } catch {
      /* older browsers: the focus check below still works */
    }
    const check = async () => {
      if (document.visibilityState !== "visible") return;
      try {
        const r = await fetch("/api/me", { cache: "no-store" });
        const { id } = (await r.json()) as { id: string | null };
        if (id !== userId) window.location.assign(id ? "/go?switched=1" : "/signin");
      } catch {
        /* offline: try again next time */
      }
    };
    document.addEventListener("visibilitychange", check);
    window.addEventListener("focus", check);
    return () => {
      channel?.close();
      document.removeEventListener("visibilitychange", check);
      window.removeEventListener("focus", check);
    };
  }, [userId]);
  return null;
}
