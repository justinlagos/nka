import Link from "next/link";
import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { ActionForm } from "@/components/ActionForm";
import { UliLine } from "@/components/UliLine";
import { Wordmark } from "@/components/Wordmark";
import { sendSignInLink } from "./actions";
import { getSession } from "@/lib/session";
import { safeNext } from "@/lib/origin";
import { SITE } from "@/content/site";

export const metadata: Metadata = { title: "Sign in" };

const ERRORS: Record<string, string> = {
  link: "That sign-in link has expired or was opened in a different browser. Send a new one below.",
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
        <p className="muted">We&apos;ll email you a link. No password to remember. New here? The same link creates your account.</p>
        {error && ERRORS[error] && (
          <div className="callout callout-warn">
            <p>{ERRORS[error]}</p>
          </div>
        )}
        <ActionForm action={sendSignInLink} submit="Email me a link" pending="Sending">
          <input type="hidden" name="next" value={target} />
          <label className="field">
            <span>Work email</span>
            <input type="email" name="email" required autoComplete="email" autoFocus />
          </label>
          <label className="field">
            <span>Your name</span>
            <input type="text" name="name" autoComplete="name" maxLength={120} />
            <span className="hint">Only needed the first time.</span>
          </label>
        </ActionForm>
        <p className="small muted" style={{ marginTop: 32 }}>
          By signing in you agree to the <Link href="/legal/terms">terms</Link> and{" "}
          <Link href="/legal/privacy">privacy notice</Link>.
        </p>
      </main>
    </div>
  );
}
