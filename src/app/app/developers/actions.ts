"use server";
import { revalidatePath } from "next/cache";
import { fail, type ActionState } from "@/lib/action";
import { canAdmin, getCurrentMembership, requireProfile } from "@/lib/session";
import { generateKey } from "@/lib/api/keys";

export type KeyState = ActionState & { key?: string; webhookSecret?: string };

// Makes a key. The full key and its webhook secret are returned to this one page view and never
// stored; only the hash is kept, so a lost key is replaced, not recovered.
export async function createKey(_prev: KeyState, form: FormData): Promise<KeyState> {
  const { supabase } = await requireProfile();
  const m = await getCurrentMembership();
  if (!m || !canAdmin(m.role)) return { ok: false, error: "Only an owner or admin can make API keys." };
  const name = String(form.get("name") ?? "").trim().slice(0, 80);
  if (!name) return { ok: false, error: "Give the key a name so you can tell it apart later." };
  const k = generateKey();
  const { error } = await supabase.rpc("create_api_key", { p_org: m.org.id, p_name: name, p_prefix: k.prefix, p_hash: k.hash, p_webhook_secret: k.webhookSecret });
  if (error) return fail(error);
  revalidatePath("/app/developers");
  return { ok: true, key: k.key, webhookSecret: k.webhookSecret, at: Date.now() };
}

export async function revokeKey(form: FormData) {
  const { supabase } = await requireProfile();
  const id = String(form.get("id") ?? "").slice(0, 64);
  await supabase.rpc("revoke_api_key", { p_key: id });
  revalidatePath("/app/developers");
}
