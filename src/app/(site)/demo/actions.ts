"use server";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { supabaseServer } from "@/lib/supabase/server";
import { getSession, ORG_COOKIE } from "@/lib/session";
import { draftBrief } from "@/lib/ai";
import { brandBookText, SERVICE_OPTIONS } from "@/lib/brief";
import { notifyStudio } from "@/lib/notify";
import { siteOrigin } from "@/lib/origin";
import { VOLUMES, TEAM_SIZES } from "@/content/demo";

export type DemoState = { ok?: boolean; error?: string; email?: string; at?: number };

const clip = (v: FormDataEntryValue | null, n: number) => String(v ?? "").trim().slice(0, n);
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const err = (error: string, email?: string): DemoState => ({ ok: false, error, email, at: Date.now() });

// Step 1: save the answers, log the call request, and email a sign-in code.
export async function startDemo(_prev: DemoState, form: FormData): Promise<DemoState> {
  // Bots fill every field, including this hidden one.
  if (clip(form.get("url"), 200)) return { ok: true, email: "", at: Date.now() };

  const d = {
    first_need: clip(form.get("first_need"), 4000),
    company: clip(form.get("company"), 160),
    about: clip(form.get("about"), 2000),
    website: clip(form.get("website"), 300),
    country: clip(form.get("country"), 80),
    volume: clip(form.get("volume"), 60),
    team_size: clip(form.get("team_size"), 40),
    full_name: clip(form.get("full_name"), 120),
    email: clip(form.get("email"), 200).toLowerCase(),
    phone: clip(form.get("phone"), 40),
    call_time: clip(form.get("call_time"), 200),
  };
  if (d.first_need.length < 4) return err("Tell us what you need designed first.");
  if (!d.company) return err("Add your company name.");
  if (!d.full_name) return err("Add your name.");
  if (!EMAIL.test(d.email)) return err("Add a work email we can send your code to.");
  if (d.volume && !VOLUMES.some((v) => v.value === d.volume)) d.volume = "";
  if (d.team_size && !TEAM_SIZES.includes(d.team_size)) d.team_size = "";

  const supabase = await supabaseServer();
  const { error } = await supabase.from("demo_requests").insert(d);
  if (error) {
    console.error("Demo request not saved", error.message);
    return err("We couldn't save that. Check the fields and try again.");
  }
  const volumeLabel = VOLUMES.find((v) => v.value === d.volume)?.label ?? "";
  await supabase.from("leads").insert({
    name: d.full_name,
    email: d.email,
    company: d.company,
    company_size: d.team_size,
    country: d.country,
    interest: "demo",
    budget: volumeLabel.slice(0, 40),
    message: [
      `First need: ${d.first_need}`,
      d.about && `About: ${d.about}`,
      d.website && `Website: ${d.website}`,
      d.phone && `Phone: ${d.phone}`,
      d.call_time && `Best time for a call: ${d.call_time}`,
    ]
      .filter(Boolean)
      .join("\n")
      .slice(0, 4000),
  });
  await notifyStudio(`Demo request: ${d.company}`, [
    `${d.full_name} <${d.email}>${d.phone ? `, ${d.phone}` : ""}`,
    `${d.country}${d.team_size ? `, team of ${d.team_size}` : ""}${volumeLabel ? `, ${volumeLabel}` : ""}`,
    d.call_time ? `Best time for a call: ${d.call_time}` : "",
    "",
    d.first_need,
  ]);

  // Already signed in as this person: build the workspace now.
  const session = await getSession();
  if (session.profile?.email === d.email) await buildWorkspace();

  const origin = await siteOrigin();
  const { error: otpError } = await supabase.auth.signInWithOtp({
    email: d.email,
    options: { emailRedirectTo: `${origin}/auth/callback?next=/app`, data: { full_name: d.full_name } },
  });
  if (otpError) {
    if (/rate limit|too many|security purposes/i.test(otpError.message)) {
      return err("We've sent a few codes to that address already. Wait a minute, then try again.", d.email);
    }
    console.error("Demo code not sent", otpError.message);
    return err("Your answers are saved, but the code email didn't send. Try again in a minute.", d.email);
  }
  return { ok: true, email: d.email, at: Date.now() };
}

// Step 2: check the code, then build the workspace from the answers.
export async function finishDemo(_prev: DemoState, form: FormData): Promise<DemoState> {
  const email = clip(form.get("email"), 200).toLowerCase();
  const token = String(form.get("code") ?? "").replace(/\D/g, "");
  if (!EMAIL.test(email)) return err("Start again with your email address.");
  if (token.length < 6) return err("Enter the code from the email.", email);
  const supabase = await supabaseServer();
  const { error } = await supabase.auth.verifyOtp({ email, token, type: "email" });
  if (error) return err("That code didn't work. Use the code from the most recent email.", email);
  await buildWorkspace();
  redirect("/app");
}

// Creates the workspace (or reuses theirs), drafts the first brief, and opens it.
async function buildWorkspace(): Promise<never> {
  const supabase = await supabaseServer();
  const { data, error } = await supabase.rpc("setup_from_demo");
  const made = (data ?? {}) as { org?: string | null; project?: string | null };
  if (error || !made.org) {
    if (error) console.error("Workspace setup failed", error.message);
    redirect("/app");
  }
  (await cookies()).set(ORG_COOKIE, made.org, { path: "/", httpOnly: true, sameSite: "lax", secure: true, maxAge: 31536000 });

  if (made.project) {
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
    redirect(`/app/projects/${made.project}/edit?welcome=demo`);
  }
  redirect("/app");
}
