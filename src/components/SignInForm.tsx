"use client";
import { useActionState, useEffect, useState } from "react";
import { SubmitButton } from "@/components/ActionForm";
import { sendSignInCode, verifySignInCode, type SignInState } from "@/app/signin/actions";

// Two steps on one page: email, then the code from the email. The code works on any
// device, so opening the email on a phone and signing in on a laptop is fine.
export function SignInForm({ next, as = "client" }: { next: string; as?: "client" | "designer" }) {
  const [sent, send] = useActionState(sendSignInCode, {} as SignInState);
  const [checked, verify] = useActionState(verifySignInCode, {} as SignInState);
  const [step, setStep] = useState<"email" | "code">("email");

  useEffect(() => {
    if (sent.ok && sent.email) setStep("code");
  }, [sent]);

  if (step === "code" && sent.email) {
    return (
      <form action={verify} key={sent.at}>
        <input type="hidden" name="email" value={sent.email} />
        <input type="hidden" name="next" value={next} />
        <p>
          We&apos;ve emailed a sign-in code to <b>{sent.email}</b>.
        </p>
        <label className="field">
          <span>Code from the email</span>
          <input
            type="text"
            name="code"
            inputMode="numeric"
            autoComplete="one-time-code"
            pattern="[0-9 ]{6,12}"
            maxLength={12}
            required
            autoFocus
            className="code-input"
          />
          <span className="hint">Or open the link in the email instead.</span>
        </label>
        <div className="form-foot">
          <SubmitButton label="Sign in" pending="Checking" />
          <button type="button" className="btn btn-line" onClick={() => setStep("email")}>
            Use a different email
          </button>
          <p className={`form-result ${checked.error ? "is-error" : ""}`} role="status" aria-live="polite">
            {checked.error ?? ""}
          </p>
        </div>
        <p className="small muted" style={{ marginTop: 16 }}>
          It comes from Nka Studio. In Gmail it often lands in the Promotions tab, so look there and in spam before sending a new code.
        </p>
      </form>
    );
  }

  return (
    <form action={send}>
      <input type="hidden" name="next" value={next} />
      <input type="hidden" name="as" value={as} />
      <label className="field">
        <span>{as === "designer" ? "The email Nka added you with" : "Work email"}</span>
        <input type="email" name="email" required autoComplete="email" autoFocus defaultValue={sent.email ?? ""} />
      </label>
      <label className="field">
        <span>Your name</span>
        <input type="text" name="name" autoComplete="name" maxLength={120} />
        <span className="hint">Only needed the first time.</span>
      </label>
      <div className="form-foot">
        <SubmitButton label="Email me a code" pending="Sending" />
        <p className={`form-result ${sent.error ? "is-error" : ""}`} role="status" aria-live="polite">
          {sent.error ?? ""}
        </p>
      </div>
    </form>
  );
}
