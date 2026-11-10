import Link from "next/link";
import { SignInForm } from "@/components/SignInForm";
import { UliLine } from "@/components/UliLine";
import { Wordmark } from "@/components/Wordmark";
import { AREA_LABEL, areaOf, getSession } from "@/lib/session";
import { SITE } from "@/content/site";

const ERRORS: Record<string, string> = {
  link: "That sign-in link has expired or was already used. Send a new code below.",
};

// Two doors, one sign-in: /signin for clients (and the admin), /designer for designers.
// Where someone lands depends on their account, never on the door. The designer door only
// sends codes to emails Nka has added as designers, so it can't create a client account.
export async function SignInScreen({ kind, next, error }: { kind: "client" | "designer"; next: string; error?: string }) {
  const { userId, profile } = await getSession();
  const designer = kind === "designer";
  const here = designer ? "/designer" : "/signin";
  const wrongDoor = designer && profile && areaOf(profile) === "client";

  return (
    <div className={`auth ${designer ? "auth-designer" : ""}`}>
      <div className="auth-art">
        <Link href="/" aria-label="Nka home" style={{ color: "inherit" }}>
          <Wordmark ink="white" />
        </Link>
        <UliLine />
        <p className="muted">{designer ? "Designer studio" : SITE.meaning}</p>
      </div>
      <main id="main" className="auth-form">
        <h1 className="h1" style={{ marginBottom: 12 }}>
          {designer ? "Designer sign-in" : "Sign in"}
        </h1>
        <p className="muted">
          {designer
            ? "For designers Nka has added. Use the email Nka added you with and we'll email you a code. You'll land on your work."
            : "We'll email you a code. No password to remember. New here? The same code creates your account."}
        </p>
        {error && ERRORS[error] && (
          <div className="callout callout-warn">
            <p>{ERRORS[error]}</p>
          </div>
        )}
        {userId && profile ? (
          <div className="signed-in">
            <p>
              This browser is signed in as <b>{profile.email}</b> ({AREA_LABEL[areaOf(profile)].toLowerCase()}).
              {wrongDoor && " That's a client account, not a designer account."}
            </p>
            <div className="form-foot">
              {!wrongDoor && (
                <Link href={next} className="btn">
                  Continue as {profile.email}
                </Link>
              )}
              <form action="/auth/signout" method="post">
                <input type="hidden" name="next" value={`${here}?next=${encodeURIComponent(next)}`} />
                <button type="submit" className={wrongDoor ? "btn" : "btn btn-line"}>
                  {wrongDoor ? "Sign out and use your designer email" : "Use a different email"}
                </button>
              </form>
            </div>
            <p className="small muted" style={{ marginTop: 16 }}>
              One browser holds one sign-in. To use two accounts at once, use a second browser or a private window for the other.
            </p>
          </div>
        ) : (
          <SignInForm next={next} as={kind} />
        )}
        <p className="small muted" style={{ marginTop: 32 }}>
          {designer ? (
            <>
              Not a designer? <Link href="/signin">Client sign-in</Link>.{" "}
            </>
          ) : (
            <>
              Designer? <Link href="/designer">Designer sign-in</Link>.{" "}
            </>
          )}
          By signing in you agree to the <Link href="/legal/terms">terms</Link> and{" "}
          <Link href="/legal/privacy">privacy notice</Link>.
        </p>
      </main>
    </div>
  );
}
