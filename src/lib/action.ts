// Shared shape for server action results shown by <ActionForm>.
export type ActionState = { ok?: boolean; error?: string; message?: string; at?: number };

export const idle: ActionState = {};

export function done(message?: string): ActionState {
  return { ok: true, message, at: Date.now() };
}

// Turns database errors into something a person can act on. Our own functions
// already raise plain sentences; policy and permission errors get a general line.
export function fail(error: unknown): ActionState {
  const raw =
    typeof error === "string"
      ? error
      : error && typeof error === "object" && "message" in error
        ? String((error as { message: unknown }).message)
        : "Something went wrong.";
  let message = raw;
  if (/row-level security|permission denied|42501/i.test(raw)) message = "You don't have permission to do that.";
  else if (/duplicate key/i.test(raw)) message = "That already exists.";
  else if (/violates check constraint/i.test(raw)) message = "One of the values isn't allowed. Check lengths and amounts.";
  else if (/JWT|session/i.test(raw)) message = "Your session has ended. Sign in again.";
  return { ok: false, error: message, at: Date.now() };
}
