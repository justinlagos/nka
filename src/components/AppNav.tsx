"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";

type Item = { href: string; label: string; exact?: boolean };

export function AppNav({ items, label }: { items: Item[]; label: string }) {
  const path = usePathname();
  return (
    <nav className="app-nav" aria-label={label}>
      {items.map((i) => {
        const current = i.exact ? path === i.href : path === i.href || path.startsWith(i.href + "/");
        return (
          <Link key={i.href} href={i.href} aria-current={current ? "page" : undefined}>
            {i.label}
          </Link>
        );
      })}
    </nav>
  );
}
