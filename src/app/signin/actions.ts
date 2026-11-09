"use server";
import { supabaseServer } from "@/lib/supabase/server";
import { safeNext, siteOrigin } from "@/lib/origin";
import type { ActionState } from "@/lib/action";

export async function sendSignInLink(_prev: ActionState, form: FormData): Promise<ActionState> {
  const email = String(form.get("email") ?? "").trim().toLowerCase();
  const name = String(form.get("name") ?? "").trim().slice(0, 120);
  const next = safeNext(String(form.get("next") ?? ""));
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { ok: false, error: "Enter a valid email address." };

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
    if (/rate limit/i.test(error.message)) {
      return { ok: false, error: "Too many sign-in emails just now. Wait a minute and try again." };
    }
    return { ok: false, error: error.message };
  }
  return {
    ok: true,
    message: `Check ${email} for a sign-in link. Open it in this browser.`,
    at: Date.now(),
  };
}
