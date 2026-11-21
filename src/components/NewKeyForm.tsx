"use client";
import { useActionState } from "react";
import { createKey, type KeyState } from "@/app/app/developers/actions";
import { SubmitButton } from "@/components/ActionForm";
import { CopyLink } from "@/components/CopyLink";

// Makes an API key and shows it once.
export function NewKeyForm() {
  const [state, action] = useActionState(createKey, {} as KeyState);
  return (
    <>
      <form action={action}>
        <label className="field">
          <span>Key name</span>
          <input type="text" name="name" required maxLength={80} placeholder="e.g. Production agent" />
        </label>
        <div className="form-foot">
          <SubmitButton label="Make key" pending="Making" className="btn btn-small" />
          <p className={`form-result ${state.error ? "is-error" : ""}`} role="status" aria-live="polite">
            {state.error ?? ""}
          </p>
        </div>
      </form>
      {state.key && (
        <div className="callout" style={{ marginTop: 16 }}>
          <p>
            <b>Copy these now.</b> They aren&apos;t shown again.
          </p>
          <p className="small muted" style={{ marginTop: 10 }}>API key</p>
          <CopyLink url={state.key} label="API key" copyLabel="Copy key" />
          <p className="small muted" style={{ marginTop: 10 }}>Webhook signing secret</p>
          <CopyLink url={state.webhookSecret ?? ""} label="Webhook signing secret" copyLabel="Copy secret" />
        </div>
      )}
    </>
  );
}
