import Link from "next/link";
import { Wordmark } from "@/components/Wordmark";
import { MobileMenu } from "@/components/MobileMenu";
import { NavLinks } from "@/components/NavLinks";
import { Clocks } from "@/components/Clocks";
import { CONTACT, NAV, SITE } from "@/content/site";

export function SiteHeader({ signedIn }: { signedIn: boolean }) {
  return (
    <header className="site-header">
      <div className="wrap site-header-row">
        <Link href="/" className="site-logo" aria-label="nka.studio home">
          <Wordmark />
        </Link>
        <NavLinks items={NAV} />
        <div className="site-actions">
          <Link href={signedIn ? "/app" : "/signin"} className="link-quiet">
            {signedIn ? "Workspace" : "Sign in"}
          </Link>
          <Link href="/demo" className="btn btn-small">
            Book a demo
          </Link>
          <MobileMenu items={NAV} signedIn={signedIn} />
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
          <Clocks />
        </div>
        <nav aria-label="Footer" className="footer-links">
          <Link href="/services">Services</Link>
          <Link href="/work">Work</Link>
          <Link href="/how-it-works">How it works</Link>
          <Link href="/pricing">Pricing</Link>
          <Link href="/about">Studio</Link>
          <Link href="/demo">Book a demo</Link>
          <Link href="/signin">Client sign in</Link>
        </nav>
        <nav aria-label="Legal" className="footer-links">
          <Link href="/legal/terms">Terms</Link>
          <Link href="/legal/privacy">Privacy</Link>
          {CONTACT.email && <a href={`mailto:${CONTACT.email}`}>{CONTACT.email}</a>}
          {CONTACT.phone && <a href={CONTACT.phoneHref}>{CONTACT.phone}</a>}
        </nav>
        <p className="footer-company">
          nka.studio is a studio of {SITE.company}. Company no. {SITE.companyNumber}. {SITE.registered}.
        </p>
      </div>
    </footer>
  );
}
