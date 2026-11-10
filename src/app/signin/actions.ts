"use server";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { safeNext, siteOrigin } from "@/lib/origin";
import { isStudioEmail, sendSignInEmail, verifySignIn } from "@/lib/signin";

export type SignInState = { ok?: boolean; error?: string; email?: string; at?: number };

// Where to go after signing in, kept for links opened in this browser.
const NEXT_COOKIE = "nka_next";

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Sends one email with a code and a link. The code works on this page; the link works on any device.
export async function sendSignInCode(_prev: SignInState, form: FormData): Promise<SignInState> {
  const email = String(form.get("email") ?? "").trim().toLowerCase();
  const name = String(form.get("name") ?? "").trim().slice(0, 120);
  const next = safeNext(String(form.get("next") ?? ""));
  if (!EMAIL.test(email)) return { ok: false, error: "Enter a valid email address.", at: Date.now() };
  // The designer sign-in only works for emails Nka has added as designers. It never creates an account.
  if (form.get("as") === "designer" && !(await isStudioEmail(email))) {
    return {
      ok: false,
      error: "That email isn't set up as a designer. Use the address Nka added you with, or ask Nka to add you.",
      email,
      at: Date.now(),
    };
  }

  const r = await sendSignInEmail(email, { name, next, origin: await siteOrigin() });
  if (!r.ok) return { ok: false, error: r.error, email, at: Date.now() };
  (await cookies()).set(NEXT_COOKIE, next, { path: "/", httpOnly: true, sameSite: "lax", secure: true, maxAge: 3600 });
  return { ok: true, email, at: Date.now() };
}

export async function verifySignInCode(_prev: SignInState, form: FormData): Promise<SignInState> {
  const email = String(form.get("email") ?? "").trim().toLowerCase();
  const token = String(form.get("code") ?? "").replace(/\D/g, "");
  const next = safeNext(String(form.get("next") ?? ""));
  if (!EMAIL.test(email)) return { ok: false, error: "Start again with your email address.", at: Date.now() };
  if (token.length < 6) return { ok: false, error: "Enter the code from the email.", email, at: Date.now() };

  if (!(await verifySignIn({ email, code: token }))) {
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
  const type = String(form.get("type") ?? "magiclink");
  const email = String(form.get("email") ?? "").trim().toLowerCase();
  const jar = await cookies();
  const next = safeNext(String(form.get("next") ?? "") || jar.get(NEXT_COOKIE)?.value);
  if (!tokenHash) return { ok: false, error: "This link is incomplete. Send a new code from the sign-in page.", at: Date.now() };
  if (!(await verifySignIn({ email, tokenHash, type }))) {
    return { ok: false, error: "This link has expired or was already used. Send a new code from the sign-in page.", at: Date.now() };
  }
  jar.delete(NEXT_COOKIE);
  redirect(next);
}
