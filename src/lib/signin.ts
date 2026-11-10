import "server-only";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { supabaseServer } from "@/lib/supabase/server";
import { sendSignInCodeEmail } from "@/lib/notify";

// Sign-in for everyone (clients, designers, the admin), new or returning.
// Nka makes the code itself and sends one email with the code and a link, so a new
// address never gets a "confirm your email" message without a code.

export type SendResult = { ok: true } | { ok: false; error: string };

// True for an email the admin has added as a designer (signed in yet or not), or the admin.
// The designer sign-in page uses it so a designer can never make a client account by mistake.
export async function isStudioEmail(email: string): Promise<boolean> {
  const db = supabaseAdmin();
  const [{ data: invited }, { data: profile }, { data: staff }] = await Promise.all([
    db.from("talent_emails").select("email").eq("email", email).maybeSingle(),
    db.from("profiles").select("is_talent, is_staff").eq("email", email).maybeSingle(),
    db.from("staff_emails").select("email").eq("email", email).maybeSingle(),
  ]);
  return Boolean(invited || staff || profile?.is_talent || profile?.is_staff);
}

export async function sendSignInEmail(email: string, opts: { name?: string; next: string; origin: string }): Promise<SendResult> {
  try {
    return await sendOwnEmail(email, opts);
  } catch (err) {
    // Safety net: if Nka can't make its own code (keys, API), fall back to the auth service's email.
    console.error("Own sign-in email failed, using the fallback", err);
    const supabase = await supabaseServer();
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: `${opts.origin}/auth/callback?next=${encodeURIComponent(opts.next)}`,
        data: opts.name ? { full_name: opts.name } : undefined,
      },
    });
    if (!error) return { ok: true };
    if (/rate limit|too many|security purposes/i.test(error.message)) {
      return { ok: false, error: "Too many sign-in emails just now. Wait a minute, then try again." };
    }
    return { ok: false, error: "We couldn't send a code just now. Try again in a minute." };
  }
}

class OwnEmailFailed extends Error {}

async function sendOwnEmail(email: string, opts: { name?: string; next: string; origin: string }): Promise<SendResult> {
  const db = supabaseAdmin();
  const { data: allowed, error: throttleError } = await db.rpc("signin_code_allowed", { p_email: email });
  if (throttleError) console.error("Sign-in throttle", throttleError.message);
  if (allowed === "wait") return { ok: false, error: "We've just sent a code to that address. Use that one, or wait a minute for a new one." };
  if (allowed === "hour") return { ok: false, error: "That's a lot of codes in an hour. Use the most recent email, or try again later." };

  // New address: create the account already confirmed.
  const created = await db.auth.admin.createUser({
    email,
    email_confirm: true,
    user_metadata: opts.name ? { full_name: opts.name } : {},
  });
  if (created.error && !/already|registered|exists/i.test(created.error.message)) {
    throw new OwnEmailFailed(`createUser: ${created.error.message}`);
  }
  if (created.error && opts.name) {
    // Returning person who gave a name and has none yet.
    await db.from("profiles").update({ full_name: opts.name }).eq("email", email).eq("full_name", "");
  }

  const { data, error } = await db.auth.admin.generateLink({ type: "magiclink", email });
  const code = data?.properties?.email_otp;
  const hash = data?.properties?.hashed_token;
  if (error || !code || !hash) throw new OwnEmailFailed(`generateLink: ${error?.message ?? "no code returned"}`);
  const link =
    `${opts.origin}/auth/confirm?token_hash=${encodeURIComponent(hash)}&type=magiclink` +
    `&email=${encodeURIComponent(email)}&next=${encodeURIComponent(opts.next)}`;
  const sent = await sendSignInCodeEmail(email, code, link);
  if (!sent) throw new OwnEmailFailed("Resend did not accept the email");
  return { ok: true };
}

// Signs in with the code from the email. If someone else is signed in on this browser,
// they're signed out first, so two accounts never get mixed up.
export async function verifySignIn(input: { email: string; code?: string; tokenHash?: string; type?: string }) {
  const supabase = await supabaseServer();
  const { data: claims } = await supabase.auth.getClaims();
  const current = (claims?.claims?.email as string | undefined)?.toLowerCase();
  if (claims?.claims?.sub && current !== input.email) await supabase.auth.signOut({ scope: "local" });

  if (input.tokenHash) {
    const type = (["email", "magiclink", "signup", "invite"].includes(input.type ?? "") ? input.type : "magiclink") as
      | "email"
      | "magiclink"
      | "signup"
      | "invite";
    const { error } = await supabase.auth.verifyOtp({ token_hash: input.tokenHash, type });
    return !error;
  }
  const { error } = await supabase.auth.verifyOtp({ email: input.email, token: input.code ?? "", type: "email" });
  if (!error) return true;
  const retry = await supabase.auth.verifyOtp({ email: input.email, token: input.code ?? "", type: "magiclink" });
  return !retry.error;
}
