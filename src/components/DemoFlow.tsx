"use client";
import { useActionState, useEffect, useState } from "react";
import { SubmitButton } from "@/components/ActionForm";
import { finishDemo, startDemo, type DemoState } from "@/app/(site)/demo/actions";
import { CALL_TIMES, FIRST_NEEDS } from "@/content/demo";

type Answers = {
  first_need: string;
  website: string;
  full_name: string;
  email: string;
  phone: string;
  company: string;
  call_time: string;
};

const EMPTY: Answers = { first_need: "", website: "", full_name: "", email: "", phone: "", company: "", call_time: "" };
const STEPS = 2;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Two short steps, then a code by email. We read their website for the brand and write the
// first brief, so the workspace opens ready to use.
export function DemoFlow({ initialNeed = "" }: { initialNeed?: string }) {
  const [a, setA] = useState<Answers>({ ...EMPTY, first_need: initialNeed });
  const [step, setStep] = useState(0);
  const [sent, start] = useActionState(startDemo, {} as DemoState);
  const [checked, finish] = useActionState(finishDemo, {} as DemoState);
  const set = (k: keyof Answers) => (e: { target: { value: string } }) => setA((x) => ({ ...x, [k]: e.target.value }));

  useEffect(() => {
    if (sent.ok && sent.email) setStep(STEPS);
  }, [sent]);

  const canNext = [a.first_need.trim().length >= 4, a.full_name.trim().length > 0 && EMAIL.test(a.email.trim())][step];

  if (step === STEPS && sent.email) {
    return (
      <form action={finish} className="demo-card" key={sent.at}>
        <p className="demo-step">Last step</p>
        <h2 className="h2">Check your email</h2>
        <p>
          We sent a code to <b>{sent.email}</b>. Enter it and your workspace opens: your brand read from your site and your
          first brief written.
        </p>
        <input type="hidden" name="email" value={sent.email} />
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
        </label>
        <div className="form-foot">
          <SubmitButton label="Open my workspace" pending="Reading your site and writing your brief" />
          <p className={`form-result ${checked.error ? "is-error" : ""}`} role="status" aria-live="polite">
            {checked.error ?? ""}
          </p>
        </div>
        <p className="small muted">
          Setting up takes about half a minute. Wrong address?{" "}
          <button type="button" className="link-button" onClick={() => setStep(1)}>
            Change it
          </button>
          .
        </p>
      </form>
    );
  }

  return (
    <form
      action={start}
      className="demo-card"
      onSubmit={(e) => {
        if (step < STEPS - 1) {
          e.preventDefault();
          if (canNext) setStep(step + 1);
        }
      }}
    >
      <div className="demo-progress" aria-hidden="true">
        <span style={{ width: `${((step + 1) / STEPS) * 100}%` }} />
      </div>
      <p className="demo-step">
        Step {step + 1} of {STEPS}
      </p>

      {(Object.keys(a) as (keyof Answers)[]).map((k) => (
        <input key={k} type="hidden" name={k} value={a[k]} />
      ))}
      <input type="text" name="url" tabIndex={-1} autoComplete="off" className="skip" aria-hidden="true" />

      {step === 0 && (
        <>
          <h2 className="h2">What do you need designed first?</h2>
          <p className="muted">A sentence is enough. We&apos;ll write the brief for you.</p>
          <div className="chips">
            {FIRST_NEEDS.map((n) => (
              <button type="button" key={n} className={`chip ${a.first_need === n ? "on" : ""}`} onClick={() => setA((x) => ({ ...x, first_need: n }))}>
                {n}
              </button>
            ))}
          </div>
          <label className="field">
            <span className="skip">What you need</span>
            <textarea
              rows={3}
              maxLength={4000}
              value={a.first_need}
              onChange={set("first_need")}
              placeholder="A 12-slide deck for our seed round, needed by 5 December"
              autoFocus
            />
          </label>
          <label className="field">
            <span>Your website (optional)</span>
            <input type="text" maxLength={300} value={a.website} onChange={set("website")} placeholder="yourcompany.com" inputMode="url" />
            <span className="hint">We read it for your logo, colours and fonts, so the work comes out on brand.</span>
          </label>
        </>
      )}

      {step === 1 && (
        <>
          <h2 className="h2">Where do we send your code?</h2>
          <p className="muted">Your workspace opens as soon as you enter it. We&apos;ll call to talk it through.</p>
          <div className="row-2">
            <label className="field">
              <span>Your name</span>
              <input type="text" maxLength={120} value={a.full_name} onChange={set("full_name")} autoComplete="name" autoFocus />
            </label>
            <label className="field">
              <span>Work email</span>
              <input type="email" maxLength={200} value={a.email} onChange={set("email")} autoComplete="email" />
            </label>
          </div>
          <details className="demo-more">
            <summary>Add a phone number or company name (optional)</summary>
            <div className="row-2">
              <label className="field">
                <span>Phone</span>
                <input type="tel" maxLength={40} value={a.phone} onChange={set("phone")} autoComplete="tel" />
              </label>
              <label className="field">
                <span>Company</span>
                <input type="text" maxLength={160} value={a.company} onChange={set("company")} autoComplete="organization" />
              </label>
            </div>
            <label className="field">
              <span>Best time for a 20-minute call</span>
              <select value={a.call_time} onChange={set("call_time")}>
                <option value="">Any time</option>
                {CALL_TIMES.map((t) => (
                  <option key={t}>{t}</option>
                ))}
              </select>
            </label>
          </details>
        </>
      )}

      <div className="form-foot">
        {step > 0 && (
          <button type="button" className="btn btn-line" onClick={() => setStep(step - 1)}>
            Back
          </button>
        )}
        {step < STEPS - 1 ? (
          <button type="submit" className="btn" disabled={!canNext}>
            Next
          </button>
        ) : (
          <SubmitButton label="Set up my workspace" pending="Sending your code" />
        )}
        <p className={`form-result ${sent.error ? "is-error" : ""}`} role="status" aria-live="polite">
          {step === STEPS - 1 ? sent.error ?? "" : ""}
        </p>
      </div>
      {step === STEPS - 1 && (
        <p className="small muted" style={{ marginTop: 14 }}>
          No card needed. By continuing you agree to our <a href="/legal/terms">terms</a> and{" "}
          <a href="/legal/privacy">privacy notice</a>.
        </p>
      )}
    </form>
  );
}
