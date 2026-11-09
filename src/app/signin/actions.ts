"use server";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { supabaseServer } from "@/lib/supabase/server";
import { safeNext, siteOrigin } from "@/lib/origin";

export type SignInState = { ok?: boolean; error?: string; email?: string; at?: number };

// Where to go after signing in, kept for links opened in this browser.
const NEXT_COOKIE = "nka_next";

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Sends one email with a code and a link. The code works on any device; so does the link.
export async function sendSignInCode(_prev: SignInState, form: FormData): Promise<SignInState> {
  const email = String(form.get("email") ?? "").trim().toLowerCase();
  const name = String(form.get("name") ?? "").trim().slice(0, 120);
  const next = safeNext(String(form.get("next") ?? ""));
  if (!EMAIL.test(email)) return { ok: false, error: "Enter a valid email address.", at: Date.now() };

  const supabase = await supabaseServer();
  const origin = await siteOrigin();
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: {
      emailRedirectTo: `${origin}/auth/callback?next=${encodeURIComponent(next)}`,
      data: name ? { full_name: name } : undefined,
    },
  });
  if (error) {
    if (/rate limit|too many|security purposes/i.test(error.message)) {
      return { ok: false, error: "Too many sign-in emails just now. Wait a minute, then try again.", at: Date.now() };
    }
    if (/not authorized/i.test(error.message)) {
      return { ok: false, error: "Sign-in email isn't set up for this address yet. Contact the studio.", at: Date.now() };
    }
    return { ok: false, error: error.message, at: Date.now() };
  }
  (await cookies()).set(NEXT_COOKIE, next, { path: "/", httpOnly: true, sameSite: "lax", secure: true, maxAge: 3600 });
  return { ok: true, email, at: Date.now() };
}

export async function verifySignInCode(_prev: SignInState, form: FormData): Promise<SignInState> {
  const email = String(form.get("email") ?? "").trim().toLowerCase();
  const token = String(form.get("code") ?? "").replace(/\D/g, "");
  const next = safeNext(String(form.get("next") ?? ""));
  if (!EMAIL.test(email)) return { ok: false, error: "Start again with your email address.", at: Date.now() };
  if (token.length < 6) return { ok: false, error: "Enter the code from the email.", email, at: Date.now() };

  const supabase = await supabaseServer();
  const { error } = await supabase.auth.verifyOtp({ email, token, type: "email" });
  if (error) {
    return {
      ok: false,
      error: "That code didn't work. Use the code from the most recent email, or send a new one.",
      email,
      at: Date.now(),
    };
  }
  (await cookies()).delete(NEXT_COOKIE);
  redirect(next);
}

// The link in the email lands on /auth/confirm, which asks for one click before using it,
// so email scanners that open links can't use up the sign-in.
export async function confirmSignInLink(_prev: SignInState, form: FormData): Promise<SignInState> {
  const tokenHash = String(form.get("token_hash") ?? "");
  const type = String(form.get("type") ?? "email");
  const jar = await cookies();
  const next = safeNext(String(form.get("next") ?? "") || jar.get(NEXT_COOKIE)?.value);
  if (!tokenHash || !["email", "magiclink", "signup", "invite"].includes(type)) {
    return { ok: false, error: "This link is incomplete. Send a new code from the sign-in page.", at: Date.now() };
  }
  const supabase = await supabaseServer();
  const { error } = await supabase.auth.verifyOtp({
    token_hash: tokenHash,
    type: type as "email" | "magiclink" | "signup" | "invite",
  });
  if (error) {
    return { ok: false, error: "This link has expired or was already used. Send a new code from the sign-in page.", at: Date.now() };
  }
  jar.delete(NEXT_COOKIE);
  redirect(next);
}
