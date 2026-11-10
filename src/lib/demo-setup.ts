import "server-only";
import { cookies } from "next/headers";
import { supabaseServer } from "@/lib/supabase/server";
import { ORG_COOKIE } from "@/lib/session";
import { draftBrief } from "@/lib/ai";
import { brandBookText, SERVICE_OPTIONS } from "@/lib/brief";
import { applyBrandScan, scanWebsite } from "@/lib/brand-sync";

// A company name guessed from a web address: "acme-foods.co.uk" -> "Acme Foods".
export function nameFromHost(raw: string): string {
  try {
    const host = new URL(/^https?:\/\//.test(raw) ? raw : `https://${raw}`).hostname.replace(/^www\./, "");
    const label = host.split(".")[0] ?? "";
    return label.replace(/[-_]+/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()).trim();
  } catch {
    return "";
  }
}

// Builds the signed-in person's workspace from their demo answers (or reuses theirs): reads
// their website for the brand, drafts the first brief in that brand, and returns where to go.
export async function setUpFromDemo(): Promise<string> {
  const supabase = await supabaseServer();
  const { data, error } = await supabase.rpc("setup_from_demo");
  const made = (data ?? {}) as { org?: string | null; project?: string | null; website?: string; fresh?: boolean };
  if (error) {
    console.error("Workspace setup failed", error.message);
    return "/app/onboarding?setup=failed";
  }
  // No workspace (a designer, or nothing to build): /go sends them to their own area.
  if (!made.org) return "/go";
  (await cookies()).set(ORG_COOKIE, made.org, { path: "/", httpOnly: true, sameSite: "lax", secure: true, maxAge: 31536000 });
  if (!made.project) return "/app";
  if (!made.fresh) return `/app/welcome?p=${made.project}`;

  const { data: claims } = await supabase.auth.getClaims();
  const userId = String(claims?.claims?.sub ?? "");

  // Their brand first, so the brief is drafted in it.
  if (made.website) {
    const scan = await scanWebsite(made.website);
    if (scan) {
      await applyBrandScan(supabase, made.org, userId, scan);
      const { data: org } = await supabase.from("orgs").select("name").eq("id", made.org).single();
      // The name was only guessed from the address: use the one their site gives.
      if (org && scan.company && org.name === nameFromHost(made.website)) {
        await supabase.from("orgs").update({ name: scan.company.slice(0, 120) }).eq("id", made.org);
      }
    }
  }

  const [{ data: p }, { data: book }] = await Promise.all([
    supabase.from("projects").select("id, title, brief, status").eq("id", made.project).maybeSingle(),
    supabase.from("brand_books").select("*").eq("org_id", made.org).maybeSingle(),
  ]);
  if (p && p.status === "draft" && p.title === "First brief") {
    const request = String((p.brief as { summary?: string })?.summary ?? "");
    const d = await draftBrief(request, brandBookText(book));
    await supabase
      .from("projects")
      .update({
        title: d.title.slice(0, 200) || "First brief",
        brief: d.brief,
        service: SERVICE_OPTIONS.some((s) => s.value === d.service) ? d.service : "",
      })
      .eq("id", p.id);
  }
  return `/app/welcome?p=${made.project}`;
}
