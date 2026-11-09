import Link from "next/link";
import type { Metadata } from "next";
import { ActionForm } from "@/components/ActionForm";
import { UliLine } from "@/components/UliLine";
import { Wordmark } from "@/components/Wordmark";
import { confirmSignInLink } from "@/app/signin/actions";
import { safeNext } from "@/lib/origin";
import { SITE } from "@/content/site";

export const metadata: Metadata = { title: "Sign in", robots: { index: false } };

// The link in the sign-in email opens here on any device. One click uses it; email
// scanners that open links in advance don't click, so they can't use it up.
export default async function ConfirmSignIn({
  searchParams,
}: {
  searchParams: Promise<{ token_hash?: string; type?: string; next?: string }>;
}) {
  const { token_hash, type, next } = await searchParams;
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
          Sign in to Nka
        </h1>
        {token_hash ? (
          <ActionForm action={confirmSignInLink} submit="Continue" pending="Signing in">
            <input type="hidden" name="token_hash" value={token_hash} />
            <input type="hidden" name="type" value={type ?? "email"} />
            <input type="hidden" name="next" value={next ? safeNext(next) : ""} />
            <p className="muted">You&apos;re one click from your workspace.</p>
          </ActionForm>
        ) : (
          <p>
            This link is incomplete. <Link href="/signin">Send a new code</Link>.
          </p>
        )}
      </main>
    </div>
  );
}
