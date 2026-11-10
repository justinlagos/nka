import Link from "next/link";
import type { Metadata } from "next";
import { SignInForm } from "@/components/SignInForm";
import { UliLine } from "@/components/UliLine";
import { Wordmark } from "@/components/Wordmark";
import { AREA_LABEL, areaOf, getSession } from "@/lib/session";
import { safeNext } from "@/lib/origin";
import { SITE } from "@/content/site";

export const metadata: Metadata = { title: "Sign in" };

const ERRORS: Record<string, string> = {
  link: "That sign-in link has expired or was already used. Send a new code below.",
};

export default async function SignIn({ searchParams }: { searchParams: Promise<{ next?: string; error?: string }> }) {
  const { next, error } = await searchParams;
  const target = safeNext(next);
  const { userId, profile } = await getSession();

  return (
    <div className="auth">
      <div className="auth-art">
        <Link href="/" aria-label="Nka home" style={{ color: "inherit" }}>
          <Wordmark ink="white" />
        </Link>
        <UliLine />
        <p className="muted">{SITE.meaning}</p>
      </div>
      <main id="main" className="auth-form">
        <h1 className="h1" style={{ marginBottom: 12 }}>
          Sign in
        </h1>
        <p className="muted">We&apos;ll email you a code. No password to remember. New here? The same code creates your account.</p>
        {error && ERRORS[error] && (
          <div className="callout callout-warn">
            <p>{ERRORS[error]}</p>
          </div>
        )}
        {userId && profile ? (
          <div className="signed-in">
            <p>
              This browser is signed in as <b>{profile.email}</b> ({AREA_LABEL[areaOf(profile)].toLowerCase()}).
            </p>
            <div className="form-foot">
              <Link href={target} className="btn">
                Continue as {profile.email}
              </Link>
              <form action="/auth/signout" method="post">
                <input type="hidden" name="next" value={`/signin${next ? `?next=${encodeURIComponent(target)}` : ""}`} />
                <button type="submit" className="btn btn-line">
                  Use a different email
                </button>
              </form>
            </div>
            <p className="small muted" style={{ marginTop: 16 }}>
              One browser holds one sign-in. To use two accounts at once, use a second browser or a private window for the other.
            </p>
          </div>
        ) : (
          <SignInForm next={target} />
        )}
        <p className="small muted" style={{ marginTop: 32 }}>
          By signing in you agree to the <Link href="/legal/terms">terms</Link> and{" "}
          <Link href="/legal/privacy">privacy notice</Link>.
        </p>
      </main>
    </div>
  );
}
