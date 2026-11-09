"use client";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { usePathname } from "next/navigation";

// Full-screen menu for small screens: oversized type, one tap to each page.
export function MobileMenu({
  items,
  signedIn,
}: {
  items: { href: string; label: string }[];
  signedIn: boolean;
}) {
  const [open, setOpen] = useState(false);
  const path = usePathname();
  useEffect(() => setOpen(false), [path]);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open]);
  return (
    <>
      <button
        type="button"
        className="menu-button"
        aria-expanded={open}
        aria-controls="menu-sheet"
        onClick={() => setOpen(true)}
      >
        Menu
      </button>
      {open &&
        createPortal(
          <div
            className="menu-sheet"
            id="menu-sheet"
            role="dialog"
            aria-modal="true"
            aria-label="Menu"
          >
            <div className="menu-sheet-top">
              <span className="wordmark-text">nka.studio</span>
              <button
                type="button"
                className="menu-button"
                onClick={() => setOpen(false)}
                autoFocus
              >
                Close
              </button>
            </div>
            <nav aria-label="Main">
              {items.map((n) => (
                <Link key={n.href} href={n.href}>
                  {n.label}
                </Link>
              ))}
              <Link href="/demo">Book a demo</Link>
            </nav>
            <div className="menu-sheet-foot">
              <Link
                href={signedIn ? "/app" : "/signin"}
                style={{ color: "#fff" }}
              >
                {signedIn ? "Your workspace" : "Client sign in"}
              </Link>
            </div>
          </div>,
          document.body,
        )}
    </>
  );
}
