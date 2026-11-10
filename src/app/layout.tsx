import type { Metadata, Viewport } from "next";
import "@fontsource-variable/inter-tight/wght.css";
import "@fontsource/instrument-serif/400-italic.css";
import "./globals.css";
import { SITE } from "@/content/site";
import { env } from "@/lib/env";

export const metadata: Metadata = {
  metadataBase: env.siteUrl ? new URL(env.siteUrl) : undefined,
  title: { default: `${SITE.name}: ${SITE.tagline}`, template: `%s | ${SITE.name}` },
  description: SITE.description,
  openGraph: { title: `${SITE.name}: ${SITE.tagline}`, description: SITE.description, type: "website" },
};

export const viewport: Viewport = { themeColor: "#000000", width: "device-width", initialScale: 1 };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en-GB">
      <body>
        <a href="#main" className="skip">
          Skip to content
        </a>
        {children}
      </body>
    </html>
  );
}
