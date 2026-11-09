import "server-only";
import { cookies } from "next/headers";
import { supabaseServer } from "@/lib/supabase/server";
import { ORG_COOKIE } from "@/lib/session";
import { draftBrief } from "@/lib/ai";
import { brandBookText, SERVICE_OPTIONS } from "@/lib/brief";

// Builds the signed-in person's workspace from their demo answers (or reuses theirs), drafts
// the first brief once, and returns where to send them. Used by the demo code step and by
// /demo/ready, where sign-in links land.
export async function setUpFromDemo(): Promise<string> {
  const supabase = await supabaseServer();
  const { data, error } = await supabase.rpc("setup_from_demo");
  const made = (data ?? {}) as { org?: string | null; project?: string | null };
  if (error) {
    console.error("Workspace setup failed", error.message);
    return "/app/onboarding?setup=failed";
  }
  if (!made.org) return "/app";
  (await cookies()).set(ORG_COOKIE, made.org, { path: "/", httpOnly: true, sameSite: "lax", secure: true, maxAge: 31536000 });
  if (!made.project) return "/app";

  const [{ data: p }, { data: book }] = await Promise.all([
    supabase.from("projects").select("id, title, brief, status").eq("id", made.project).maybeSingle(),
    supabase.from("brand_books").select("*").eq("org_id", made.org).maybeSingle(),
  ]);
  // Only draft once: a brief already drafted (or edited) is left alone.
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
  return p && p.status !== "draft" ? `/app/projects/${made.project}` : `/app/projects/${made.project}/edit?welcome=demo`;
}
