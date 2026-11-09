import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { imagesEnabled } from "@/lib/images";

// Whether Instant (AI) is on, and how many instant briefs this workspace has left this month.
export async function instantStatus(supabase: SupabaseClient, orgId: string): Promise<{ on: boolean; left: number; limit: number }> {
  if (!imagesEnabled()) return { on: false, left: 0, limit: 0 };
  const [{ data: limit }, { data: used }] = await Promise.all([
    supabase.rpc("instant_limit", { p_org: orgId }),
    supabase.rpc("instant_used", { p_org: orgId }),
  ]);
  const l = Number(limit ?? 0);
  return { on: true, left: Math.max(0, l - Number(used ?? 0)), limit: l };
}
