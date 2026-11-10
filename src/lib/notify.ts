import "server-only";
import { serverEnv } from "@/lib/env";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { siteOrigin } from "@/lib/origin";

// Every email Nka sends, apart from the sign-in code (that one is a Supabase template).
// Three audiences:
//   notifyClient    the client's team (owners, admins, members)
//   notifyDesigner  the designer on a project (the assignee, else the client's lead designer)
//   notifyStudio    the Nka admin inbox (NKA_NOTIFY_EMAIL): problems and new leads only
// Emails go through Resend when it's set up. Nothing here ever throws: a missing or failed
// email must not stop the action that triggered it. No email ever carries the other side's
// contact details, and clients never see who their designer is.

// Returns whether Resend accepted it. Most callers ignore that; the sign-in email doesn't.
async function send(to: string[], subject: string, text: string, html?: string): Promise<boolean> {
  const { resendKey, fromEmail } = serverEnv();
  if (!resendKey || to.length === 0) return false;
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { authorization: `Bearer ${resendKey}`, "content-type": "application/json" },
      body: JSON.stringify({ from: fromEmail, to, subject, text, ...(html ? { html } : {}) }),
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) console.error("Email failed", res.status, (await res.text()).slice(0, 200));
    return res.ok;
  } catch (err) {
    console.error("Email failed", err);
    return false;
  }
}

// The sign-in email. Same for a new account and an existing one: a code to type on the page
// you came from, and a link for any other device. Never a "confirm your email" message.
export async function sendSignInCodeEmail(email: string, code: string, link: string): Promise<boolean> {
  const html = `<div style="font-family:Arial,Helvetica,sans-serif;font-size:16px;line-height:1.5;color:#1a1b3a;max-width:480px;margin:0 auto;padding:24px">
<p style="font-size:20px;font-weight:700;margin:0 0 20px">Nka Studio</p>
<p style="margin:0 0 8px">Your sign-in code for <b>${esc(email)}</b>:</p>
<p style="font-size:34px;font-weight:700;letter-spacing:8px;margin:0 0 24px">${esc(code)}</p>
<p style="margin:0 0 20px">Type it on the page you came from. On another device, use the button instead.</p>
<p style="margin:0 0 28px"><a href="${esc(link)}" style="display:inline-block;background:#ff5a1f;color:#ffffff;padding:12px 20px;border-radius:8px;text-decoration:none;font-weight:700">Sign in as ${esc(email)}</a></p>
<p style="color:#5b5e72;font-size:14px;margin:0 0 6px">The code and the button work once and expire in an hour. Signing in here signs out anyone else using this browser.</p>
<p style="color:#5b5e72;font-size:14px;margin:0 0 24px">Didn't ask for this? Ignore it. Nobody can sign in without it.</p>
<p style="color:#5b5e72;font-size:13px;margin:0;border-top:1px solid #dcddd6;padding-top:16px">Nka Studio, a studio of MotionPlay Labs Ltd</p>
</div>`;
  const text = `Your Nka Studio sign-in code for ${email}: ${code}\n\nType it on the page you came from, or open this link on any device:\n${link}\n\nIt works once and expires in an hour.`;
  return send([email], `Your Nka Studio sign-in code: ${code}`, text, html);
}

export async function notifyStudio(subject: string, lines: string[]) {
  const { notifyEmail } = serverEnv();
  if (!notifyEmail) return;
  await send([notifyEmail], subject, lines.join("\n"));
}

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

const FOOT = {
  client: "You get these because you're on this workspace. Nka Studio, a studio of MotionPlay Labs Ltd.",
  designer: "You get these because you're the designer on this client. Reply in Nka, not by email.",
};

function layout(heading: string, lines: string[], link: string, button: string, foot: string) {
  return `<div style="font-family:Arial,Helvetica,sans-serif;font-size:16px;line-height:1.5;color:#1a1b3a;max-width:520px;margin:0 auto;padding:24px">
<p style="font-size:18px;font-weight:700;margin:0 0 18px">Nka Studio</p>
<p style="font-size:22px;font-weight:700;margin:0 0 12px">${esc(heading)}</p>
${lines.map((l) => `<p style="margin:0 0 10px;white-space:pre-wrap">${esc(l)}</p>`).join("\n")}
<p style="margin:22px 0 28px"><a href="${esc(link)}" style="display:inline-block;background:#ff5a1f;color:#ffffff;padding:12px 20px;border-radius:8px;text-decoration:none;font-weight:700">${esc(button)}</a></p>
<p style="color:#5b5e72;font-size:13px;margin:0;border-top:1px solid #dcddd6;padding-top:14px">${esc(foot)}</p>
</div>`;
}

type Msg = { subject: string; heading: string; lines: string[]; path: string; button: string; origin?: string };

// Emails everyone on the client's workspace who can act (owners, admins, members).
export async function notifyClient(orgId: string, msg: Msg) {
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
    await send(to, msg.subject, [msg.heading, ...msg.lines, "", link].join("\n"), layout(msg.heading, msg.lines, link, msg.button, FOOT.client));
  } catch (err) {
    console.error("Client email failed", err);
  }
}

// The designer on a project: whoever it's assigned to, else the client's lead. With nobody on it,
// the admin hears about it instead (that's a problem to fix).
export async function notifyDesigner(projectId: string, msg: Msg) {
  const { resendKey } = serverEnv();
  if (!resendKey) return;
  try {
    const db = supabaseAdmin();
    const { data: p } = await db.from("projects").select("assignee, org:orgs(name, lead_id)").eq("id", projectId).maybeSingle();
    const org = (p?.org ?? null) as unknown as { name: string; lead_id: string | null } | null;
    const designerId = (p?.assignee as string | null) ?? org?.lead_id ?? null;
    const { data: d } = designerId
      ? await db.from("profiles").select("*").eq("id", designerId).maybeSingle()
      : { data: null };
    // Designers work in /studio; the admin in /admin. Callers pass the client path.
    const path = msg.path.replace(/^\/app\/projects\//, d?.is_staff ? "/admin/projects/" : "/studio/projects/");
    const link = `${msg.origin ?? (await siteOrigin())}${path}`;
    if (!d?.email || !(d.is_staff || d.is_talent)) {
      const admin = `${msg.origin ?? (await siteOrigin())}${msg.path.replace(/^\/app\/projects\//, "/admin/projects/")}`;
      await notifyStudio(`No designer on this: ${msg.subject}`, [`${org?.name ?? "A client"} has no designer assigned.`, ...msg.lines, admin]);
      return;
    }
    await send([d.email], msg.subject, [msg.heading, ...msg.lines, "", link].join("\n"), layout(msg.heading, msg.lines, link, msg.button, FOOT.designer));
  } catch (err) {
    console.error("Designer email failed", err);
  }
}

// One email to one address (a new designer, a designer's new client).
export async function notifyDirect(email: string, msg: { subject: string; heading: string; lines: string[]; link: string; button: string }) {
  await send([email], msg.subject, [msg.heading, ...msg.lines, "", msg.link].join("\n"), layout(msg.heading, msg.lines, msg.link, msg.button, FOOT.designer));
}
