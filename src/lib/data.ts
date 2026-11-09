import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";

// Short-lived download links for private files. Storage policies decide who gets one.
export async function signedUrls(supabase: SupabaseClient, paths: string[], seconds = 3600): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  const unique = [...new Set(paths.filter(Boolean))];
  if (!unique.length) return out;
  const { data } = await supabase.storage.from("files").createSignedUrls(unique, seconds);
  for (const row of data ?? []) if (row.path && row.signedUrl) out.set(row.path, row.signedUrl);
  return out;
}

export type PersonRow = { id: string; full_name: string; email: string; is_staff: boolean };

export async function people(supabase: SupabaseClient, ids: (string | null | undefined)[]): Promise<Map<string, PersonRow>> {
  const unique = [...new Set(ids.filter((x): x is string => Boolean(x)))];
  const out = new Map<string, PersonRow>();
  if (!unique.length) return out;
  const { data } = await supabase.from("profiles").select("id, full_name, email, is_staff").in("id", unique);
  for (const p of (data ?? []) as PersonRow[]) out.set(p.id, p);
  return out;
}

export function displayName(p: PersonRow | undefined): string {
  if (!p) return "Someone";
  return p.full_name || p.email.split("@")[0];
}
