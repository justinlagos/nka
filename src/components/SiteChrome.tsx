import Link from "next/link";
import { Wordmark } from "@/components/Wordmark";
import { NAV, SITE } from "@/content/site";

export function SiteHeader({ signedIn }: { signedIn: boolean }) {
  return (
    <header className="site-header">
      <div className="wrap site-header-row">
        <Link href="/" className="site-logo" aria-label="Nka home">
          <Wordmark />
        </Link>
        <nav aria-label="Main" className="site-nav">
          {NAV.map((n) => (
            <Link key={n.href} href={n.href}>
              {n.label}
            </Link>
          ))}
        </nav>
        <div className="site-actions">
          <Link href={signedIn ? "/app" : "/signin"} className="link-quiet">
            {signedIn ? "Workspace" : "Sign in"}
          </Link>
          <Link href="/book" className="btn btn-small">
            Book a call
          </Link>
        </div>
      </div>
    </header>
  );
}

export function SiteFooter() {
  return (
    <footer className="site-footer">
      <div className="wrap footer-grid">
        <div>
          <Wordmark />
          <p className="footer-meaning">{SITE.meaning}</p>
        </div>
        <nav aria-label="Footer" className="footer-links">
          <Link href="/services">Services</Link>
          <Link href="/work">Work</Link>
          <Link href="/how-it-works">How it works</Link>
          <Link href="/pricing">Pricing</Link>
          <Link href="/about">About</Link>
          <Link href="/book">Book a call</Link>
          <Link href="/signin">Sign in</Link>
        </nav>
        <nav aria-label="Legal" className="footer-links">
          <Link href="/legal/terms">Terms</Link>
          <Link href="/legal/privacy">Privacy</Link>
        </nav>
        <p className="footer-company">
          Nka is a studio of {SITE.company}. Company no. {SITE.companyNumber}. {SITE.registered}.
        </p>
      </div>
    </footer>
  );
}
