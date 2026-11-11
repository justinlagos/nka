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

// is_staff here means "on the Nka side" (admin or designer), for labelling messages.
export type PersonRow = { id: string; full_name: string; email: string; is_staff: boolean };

// Names as the signed-in person is allowed to see them (display_names in 0012): clients see a designer's
// alias, designers see client first names, the admin sees real names. Never an email.
export async function people(supabase: SupabaseClient, ids: (string | null | undefined)[]): Promise<Map<string, PersonRow>> {
  const unique = [...new Set(ids.filter((x): x is string => Boolean(x)))];
  const out = new Map<string, PersonRow>();
  if (!unique.length) return out;
  const { data, error } = await supabase.rpc("display_names", { p_ids: unique });
  if (!error) {
    for (const p of (data ?? []) as { id: string; name: string; studio: boolean }[]) {
      out.set(p.id, { id: p.id, full_name: p.name, email: "", is_staff: p.studio });
    }
    return out;
  }
  // Before migration 0012.
  const { data: rows } = await supabase.from("profiles").select("id, full_name, email, is_staff").in("id", unique);
  for (const p of (rows ?? []) as PersonRow[]) out.set(p.id, { ...p, email: "" });
  return out;
}

export function displayName(p: PersonRow | undefined): string {
  if (!p) return "Someone";
  return p.full_name || p.email.split("@")[0];
}

// Everyone who can lead a client: designers and the admin. Admin pages only.
export async function studioPeople(supabase: SupabaseClient) {
  const res = await supabase.from("profiles").select("*").or("is_staff.eq.true,is_talent.eq.true").order("full_name");
  const rows = res.error ? (await supabase.from("profiles").select("*").eq("is_staff", true).order("full_name")).data : res.data;
  return {
    data: (rows ?? []).map((r) => ({
      id: r.id as string,
      full_name: (r.full_name as string) ?? "",
      email: (r.email as string) ?? "",
      alias: (r.alias as string) ?? "",
      is_talent: Boolean(r.is_talent),
      talent_role: (r.talent_role as string) ?? "designer",
      vetting: (r.vetting as string) ?? "passed",
      talent_active: r.talent_active !== false,
    })),
  };
}
