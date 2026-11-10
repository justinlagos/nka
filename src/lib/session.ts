import "server-only";
import { cache } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { supabaseServer } from "@/lib/supabase/server";

// is_staff: the Nka admin, sees everything. is_talent: a designer, sees only the clients assigned to them.
export type Profile = { id: string; email: string; full_name: string; is_staff: boolean; is_talent: boolean; alias: string };
export type Role = "owner" | "admin" | "member" | "viewer";
export type Org = {
  id: string;
  name: string;
  country: string;
  plan: string;
  plan_status: string;
  active_limit: number | null;
  currency: string;
  rollover_months: number;
  stripe_customer_id: string | null;
};
export type Membership = { role: Role; org: Org };

export const ORG_COOKIE = "nka_org";

export const getSession = cache(async () => {
  const supabase = await supabaseServer();
  const { data } = await supabase.auth.getClaims();
  const userId = (data?.claims?.sub as string | undefined) ?? null;
  if (!userId) return { supabase, userId: null, profile: null as Profile | null };
  const { data: profile } = await supabase
    .from("profiles")
    .select("id, email, full_name, is_staff, is_talent, alias")
    .eq("id", userId)
    .maybeSingle();
  return { supabase, userId, profile: (profile as Profile | null) ?? null };
});

export async function requireProfile() {
  const s = await getSession();
  if (!s.userId || !s.profile) redirect("/signin");
  return { supabase: s.supabase, userId: s.userId, profile: s.profile };
}

export const getMemberships = cache(async (): Promise<Membership[]> => {
  const { supabase, userId } = await getSession();
  if (!userId) return [];
  const { data } = await supabase
    .from("org_members")
    .select("role, org:orgs(id, name, country, plan, plan_status, active_limit, currency, rollover_months, stripe_customer_id)")
    .eq("user_id", userId)
    .order("created_at");
  return ((data ?? []) as unknown as { role: Role; org: Org | null }[])
    .filter((m): m is Membership => Boolean(m.org))
    .map((m) => ({ role: m.role, org: m.org }));
});

export const getCurrentMembership = cache(async (): Promise<Membership | null> => {
  const memberships = await getMemberships();
  if (!memberships.length) return null;
  const chosen = (await cookies()).get(ORG_COOKIE)?.value;
  return memberships.find((m) => m.org.id === chosen) ?? memberships[0];
});

// For workspace pages: a signed-in client with an organisation.
export async function requireMembership() {
  const s = await requireProfile();
  const membership = await getCurrentMembership();
  if (!membership) redirect(s.profile.is_talent && !s.profile.is_staff ? "/studio" : "/app/onboarding");
  return { ...s, membership, org: membership.org, role: membership.role };
}

export async function requireStaff() {
  const s = await requireProfile();
  if (!s.profile.is_staff) redirect("/app");
  return s;
}

// Designers and the admin: anyone who works on client projects.
export async function requireStudio() {
  const s = await requireProfile();
  if (!s.profile.is_staff && !s.profile.is_talent) redirect("/app");
  return { ...s, isAdmin: s.profile.is_staff };
}

export function isDesigner(p: Pick<Profile, "is_staff" | "is_talent">) {
  return p.is_talent && !p.is_staff;
}

export function canEdit(role: Role, isStaff = false) {
  return isStaff || role === "owner" || role === "admin" || role === "member";
}

export function canAdmin(role: Role) {
  return role === "owner" || role === "admin";
}
