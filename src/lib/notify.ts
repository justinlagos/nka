import "server-only";
import { serverEnv } from "@/lib/env";

// Sends a plain email to the studio through Resend, if it's set up. Never throws:
// a missing or failed email must not stop the action that triggered it.
export async function notifyStudio(subject: string, lines: string[]) {
  const { resendKey, fromEmail, notifyEmail } = serverEnv();
  if (!resendKey || !notifyEmail) return;
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { authorization: `Bearer ${resendKey}`, "content-type": "application/json" },
      body: JSON.stringify({ from: fromEmail, to: [notifyEmail], subject, text: lines.join("\n") }),
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) console.error("Email to studio failed", res.status);
  } catch (err) {
    console.error("Email to studio failed", err);
  }
}
