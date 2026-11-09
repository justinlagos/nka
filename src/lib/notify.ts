import "server-only";
import { serverEnv } from "@/lib/env";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { siteOrigin } from "@/lib/origin";

// Emails go through Resend when it's set up. Nothing here ever throws: a missing or failed
// email must not stop the action that triggered it.

async function send(to: string[], subject: string, text: string, html?: string) {
  const { resendKey, fromEmail } = serverEnv();
  if (!resendKey || to.length === 0) return;
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { authorization: `Bearer ${resendKey}`, "content-type": "application/json" },
      body: JSON.stringify({ from: fromEmail, to, subject, text, ...(html ? { html } : {}) }),
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) console.error("Email failed", res.status, (await res.text()).slice(0, 200));
  } catch (err) {
    console.error("Email failed", err);
  }
}

export async function notifyStudio(subject: string, lines: string[]) {
  const { notifyEmail } = serverEnv();
  if (!notifyEmail) return;
  await send([notifyEmail], subject, lines.join("\n"));
}

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

function layout(heading: string, lines: string[], link: string, button: string) {
  return `<div style="font-family:Arial,Helvetica,sans-serif;font-size:16px;line-height:1.5;color:#1a1b3a;max-width:520px;margin:0 auto;padding:24px">
<p style="font-size:18px;font-weight:700;margin:0 0 18px">Nka Studio</p>
<p style="font-size:22px;font-weight:700;margin:0 0 12px">${esc(heading)}</p>
${lines.map((l) => `<p style="margin:0 0 10px">${esc(l)}</p>`).join("\n")}
<p style="margin:22px 0 28px"><a href="${esc(link)}" style="display:inline-block;background:#e0a526;color:#1a1b3a;padding:12px 20px;border-radius:8px;text-decoration:none;font-weight:700">${esc(button)}</a></p>
<p style="color:#5b5e72;font-size:13px;margin:0;border-top:1px solid #dcddd6;padding-top:14px">You get these because you're on this workspace. Nka Studio, a studio of MotionPlay Labs Ltd.</p>
</div>`;
}

// Emails everyone on the client's workspace who can act (owners, admins, members).
export async function notifyClient(
  orgId: string,
  msg: { subject: string; heading: string; lines: string[]; path: string; button: string; origin?: string },
) {
  const { resendKey } = serverEnv();
  if (!resendKey) return;
  try {
    const { data } = await supabaseAdmin()
      .from("org_members")
      .select("role, profile:profiles(email)")
      .eq("org_id", orgId)
      .in("role", ["owner", "admin", "member"]);
    const to = ((data ?? []) as unknown as { profile: { email: string } | null }[])
      .map((m) => m.profile?.email)
      .filter((e): e is string => Boolean(e));
    const link = `${msg.origin ?? (await siteOrigin())}${msg.path}`;
    await send(to, msg.subject, [msg.heading, ...msg.lines, "", link].join("\n"), layout(msg.heading, msg.lines, link, msg.button));
  } catch (err) {
    console.error("Client email failed", err);
  }
}
