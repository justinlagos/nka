"use client";
import { useActionState, useEffect, useRef, type ReactNode } from "react";
import { useFormStatus } from "react-dom";
import type { ActionState } from "@/lib/action";

type Action = (prev: ActionState, form: FormData) => Promise<ActionState>;

// A form wired to a server action, with a pending button and an inline result line.
export function ActionForm({
  action,
  children,
  submit,
  pending = "Saving",
  className,
  buttonClass = "btn",
  resetOnSuccess = false,
  confirm,
  submitValue,
  secondary,
}: {
  action: Action;
  children?: ReactNode;
  submit: string;
  pending?: string;
  className?: string;
  buttonClass?: string;
  resetOnSuccess?: boolean;
  confirm?: string;
  // Sent as "intent" so one form can do two things (e.g. save or send).
  submitValue?: string;
  secondary?: { label: string; value: string } | { label: string; value: string }[];
}) {
  const extra = secondary ? (Array.isArray(secondary) ? secondary : [secondary]) : [];
  const [state, formAction] = useActionState(action, {} as ActionState);
  const ref = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state.ok && resetOnSuccess) ref.current?.reset();
  }, [state, resetOnSuccess]);

  return (
    <form
      ref={ref}
      action={formAction}
      className={className}
      onSubmit={(e) => {
        if (confirm && !window.confirm(confirm)) e.preventDefault();
      }}
    >
      {children}
      <div className="form-foot">
        <SubmitButton label={submit} pending={pending} className={buttonClass} value={submitValue} />
        {extra.map((x) => (
          <SubmitButton key={x.value} label={x.label} pending={pending} className="btn btn-line" value={x.value} />
        ))}
        <p className={`form-result ${state.error ? "is-error" : ""}`} role="status" aria-live="polite">
          {state.error ?? (state.ok ? state.message ?? "" : "")}
        </p>
      </div>
    </form>
  );
}

export function SubmitButton({
  label,
  pending,
  className = "btn",
  value,
}: {
  label: string;
  pending: string;
  className?: string;
  value?: string;
}) {
  const status = useFormStatus();
  const mine = !value || status.data?.get("intent") === value;
  return (
    <button
      type="submit"
      className={className}
      disabled={status.pending}
      aria-busy={status.pending && mine}
      name={value ? "intent" : undefined}
      value={value}
    >
      {status.pending && mine ? `${pending}…` : label}
    </button>
  );
}
