import "server-only";
import { createClient } from "@supabase/supabase-js";
import { env, serverEnv } from "@/lib/env";

// Bypasses row-level security. Only the Stripe webhook uses this, after verifying Stripe's signature.
export function supabaseAdmin() {
  const { supabaseSecret } = serverEnv();
  if (!env.supabaseUrl || !supabaseSecret) {
    throw new Error("SUPABASE_SECRET_KEY is not set, so billing updates can't be saved.");
  }
  return createClient(env.supabaseUrl, supabaseSecret, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
