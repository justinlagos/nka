import "server-only";
import { createClient } from "@supabase/supabase-js";
import { env, serverEnv } from "@/lib/env";

// Bypasses row-level security. Used only to record plan status Stripe has confirmed:
// the webhook (after checking Stripe's signature) and pause/resume (after Stripe accepts the change).
export function supabaseAdmin() {
  const { supabaseSecret } = serverEnv();
  if (!env.supabaseUrl || !supabaseSecret) {
    throw new Error("SUPABASE_SECRET_KEY is not set, so billing updates can't be saved.");
  }
  return createClient(env.supabaseUrl, supabaseSecret, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
