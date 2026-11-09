"use client";
import { useActionState, useEffect, useState } from "react";
import { SubmitButton } from "@/components/ActionForm";
import { finishDemo, startDemo, type DemoState } from "@/app/(site)/demo/actions";
import { CALL_TIMES, COUNTRIES, FIRST_NEEDS, TEAM_SIZES, VOLUMES } from "@/content/demo";

type Answers = {
  first_need: string;
  company: string;
  about: string;
  website: string;
  country: string;
  volume: string;
  team_size: string;
  full_name: string;
  email: string;
  phone: string;
  call_time: string;
};

const EMPTY: Answers = {
  first_need: "",
  company: "",
  about: "",
  website: "",
  country: "",
  volume: "",
  team_size: "",
  full_name: "",
  email: "",
  phone: "",
  call_time: "",
};

const QUESTIONS = 4;

// Four short questions, then a code by email. The answers build the client's workspace,
// with their first brief already drafted, before the call happens.
export function DemoFlow() {
  const [a, setA] = useState<Answers>(EMPTY);
  const [step, setStep] = useState(0);
  const [sent, start] = useActionState(startDemo, {} as DemoState);
  const [checked, finish] = useActionState(finishDemo, {} as DemoState);
  const set = (k: keyof Answers) => (e: { target: { value: string } }) => setA((x) => ({ ...x, [k]: e.target.value }));

  useEffect(() => {
    if (sent.ok && sent.email) setStep(QUESTIONS);
  }, [sent]);

  const canNext = [
    a.first_need.trim().length >= 4,
    a.company.trim().length > 0,
    a.volume !== "",
    a.full_name.trim().length > 0 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(a.email.trim()),
  ][step];

  if (step === QUESTIONS && sent.email) {
    return (
      <form action={finish} className="demo-card" key={sent.at}>
        <p className="demo-step">Last step</p>
        <h2 className="h2">Check your email</h2>
        <p>
          We sent a code to <b>{sent.email}</b>. Enter it here and we&apos;ll open your workspace, with your first brief already
          drafted.
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
          <SubmitButton label="Open my workspace" pending="Setting it up" />
          <p className={`form-result ${checked.error ? "is-error" : ""}`} role="status" aria-live="polite">
            {checked.error ?? ""}
          </p>
        </div>
        <p className="small muted">
          Setting up takes a few seconds while we draft your brief. Wrong address?{" "}
          <button type="button" className="link-button" onClick={() => setStep(3)}>
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
        if (step < QUESTIONS - 1) {
          e.preventDefault();
          if (canNext) setStep(step + 1);
        }
      }}
    >
      <div className="demo-progress" aria-hidden="true">
        <span style={{ width: `${((step + 1) / QUESTIONS) * 100}%` }} />
      </div>
      <p className="demo-step">
        Question {step + 1} of {QUESTIONS}
      </p>

      {/* Every answer is posted with the last step. */}
      {(Object.keys(a) as (keyof Answers)[]).map((k) => (
        <input key={k} type="hidden" name={k} value={a[k]} />
      ))}
      <input type="text" name="url" tabIndex={-1} autoComplete="off" className="skip" aria-hidden="true" />

      {step === 0 && (
        <>
          <h2 className="h2">What do you need designed first?</h2>
          <p className="muted">A sentence is enough. We&apos;ll turn it into a full brief for you.</p>
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
        </>
      )}

      {step === 1 && (
        <>
          <h2 className="h2">Tell us about your company</h2>
          <p className="muted">This starts your brand book, so every brief comes out on brand.</p>
          <label className="field">
            <span>Company name</span>
            <input type="text" maxLength={160} value={a.company} onChange={set("company")} autoComplete="organization" autoFocus />
          </label>
          <label className="field">
            <span>What you do, in one line</span>
            <input type="text" maxLength={300} value={a.about} onChange={set("about")} placeholder="We make solar kits for small businesses in Lagos" />
          </label>
          <div className="row-2">
            <label className="field">
              <span>Website (optional)</span>
              <input type="text" maxLength={300} value={a.website} onChange={set("website")} placeholder="yourcompany.com" />
            </label>
            <label className="field">
              <span>Country</span>
              <select value={a.country} onChange={set("country")}>
                <option value="">Choose</option>
                {COUNTRIES.map((c) => (
                  <option key={c}>{c}</option>
                ))}
              </select>
            </label>
          </div>
        </>
      )}

      {step === 2 && (
        <>
          <h2 className="h2">How much design do you need?</h2>
          <p className="muted">Rough is fine. It helps us suggest the right plan on the call.</p>
          <div className="choice-list" role="radiogroup" aria-label="How much design you need">
            {VOLUMES.map((v) => (
              <label key={v.value} className={`choice ${a.volume === v.value ? "on" : ""}`}>
                <input type="radio" name="volume_pick" value={v.value} checked={a.volume === v.value} onChange={set("volume")} />
                <b>{v.label}</b>
                <span className="muted small">{v.hint}</span>
              </label>
            ))}
          </div>
          <label className="field" style={{ marginTop: 16 }}>
            <span>Team size</span>
            <select value={a.team_size} onChange={set("team_size")}>
              <option value="">Choose</option>
              {TEAM_SIZES.map((t) => (
                <option key={t}>{t}</option>
              ))}
            </select>
          </label>
        </>
      )}

      {step === 3 && (
        <>
          <h2 className="h2">Where do we reach you?</h2>
          <p className="muted">We&apos;ll email a code to open your workspace, and call you to talk it through.</p>
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
          <div className="row-2">
            <label className="field">
              <span>Phone (optional)</span>
              <input type="tel" maxLength={40} value={a.phone} onChange={set("phone")} autoComplete="tel" />
            </label>
            <label className="field">
              <span>Best time for a 20-minute call</span>
              <select value={a.call_time} onChange={set("call_time")}>
                <option value="">Choose</option>
                {CALL_TIMES.map((t) => (
                  <option key={t}>{t}</option>
                ))}
              </select>
            </label>
          </div>
        </>
      )}

      <div className="form-foot">
        {step > 0 && (
          <button type="button" className="btn btn-line" onClick={() => setStep(step - 1)}>
            Back
          </button>
        )}
        {step < QUESTIONS - 1 ? (
          <button type="submit" className="btn" disabled={!canNext}>
            Next
          </button>
        ) : (
          <SubmitButton label="Set up my workspace" pending="Sending your code" />
        )}
        <p className={`form-result ${sent.error ? "is-error" : ""}`} role="status" aria-live="polite">
          {step === QUESTIONS - 1 ? sent.error ?? "" : ""}
        </p>
      </div>
      {step === QUESTIONS - 1 && (
        <p className="small muted" style={{ marginTop: 14 }}>
          No card needed. By continuing you agree to our <a href="/legal/terms">terms</a> and{" "}
          <a href="/legal/privacy">privacy notice</a>.
        </p>
      )}
    </form>
  );
}
