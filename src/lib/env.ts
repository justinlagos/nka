// One place that reads configuration, so a missing value fails with a clear message.

export const env = {
  supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL ?? "",
  supabaseKey: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? "",
  siteUrl: (process.env.NEXT_PUBLIC_SITE_URL ?? "").replace(/\/$/, ""),
  bookingUrl: process.env.NEXT_PUBLIC_BOOKING_URL ?? "",
};

export function serverEnv() {
  return {
    supabaseSecret: process.env.SUPABASE_SECRET_KEY ?? "",
    stripeSecret: process.env.STRIPE_SECRET_KEY ?? "",
    stripeWebhookSecret: process.env.STRIPE_WEBHOOK_SECRET ?? "",
    anthropicKey: process.env.ANTHROPIC_API_KEY ?? "",
    anthropicModel: process.env.ANTHROPIC_MODEL || "claude-sonnet-5-5",
    anthropicWorkspace: process.env.ANTHROPIC_WORKSPACE_ID ?? "",
    resendKey: process.env.RESEND_API_KEY ?? "",
    fromEmail: process.env.NKA_FROM_EMAIL || "Nka <studio@nka.studio>",
    notifyEmail: process.env.NKA_NOTIFY_EMAIL ?? "",
  };
}

export function requireSupabaseEnv() {
  if (!env.supabaseUrl || !env.supabaseKey) {
    throw new Error(
      "Supabase isn't configured. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY.",
    );
  }
  return { url: env.supabaseUrl, key: env.supabaseKey };
}
