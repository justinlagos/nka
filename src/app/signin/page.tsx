import Link from "next/link";
import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { SignInForm } from "@/components/SignInForm";
import { UliLine } from "@/components/UliLine";
import { Wordmark } from "@/components/Wordmark";
import { getSession } from "@/lib/session";
import { safeNext } from "@/lib/origin";
import { SITE } from "@/content/site";

export const metadata: Metadata = { title: "Sign in" };

const ERRORS: Record<string, string> = {
  link: "That sign-in link has expired or was already used. Send a new code below.",
};

export default async function SignIn({ searchParams }: { searchParams: Promise<{ next?: string; error?: string }> }) {
  const { next, error } = await searchParams;
  const target = safeNext(next);
  if ((await getSession()).userId) redirect(target);

  return (
    <div className="auth">
      <div className="auth-art">
        <Link href="/" aria-label="Nka home" style={{ color: "inherit" }}>
          <Wordmark />
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
        <SignInForm next={target} />
        <p className="small muted" style={{ marginTop: 32 }}>
          By signing in you agree to the <Link href="/legal/terms">terms</Link> and{" "}
          <Link href="/legal/privacy">privacy notice</Link>.
        </p>
      </main>
    </div>
  );
}
