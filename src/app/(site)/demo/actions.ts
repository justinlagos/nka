"use server";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { supabaseServer } from "@/lib/supabase/server";
import { getSession } from "@/lib/session";
import { nameFromHost, setUpFromDemo } from "@/lib/demo-setup";
import { sendSignInEmail, verifySignIn } from "@/lib/signin";

const FREE_MAIL = /^(gmail|googlemail|yahoo|ymail|hotmail|outlook|live|msn|icloud|me|aol|proton|protonmail|gmx|zoho|mail)\./i;
function companyFromEmail(email: string) {
  const domain = email.split("@")[1] ?? "";
  return domain && !FREE_MAIL.test(domain) ? nameFromHost(domain) : "";
}
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
  if (!d.company) d.company = (d.website && nameFromHost(d.website)) || companyFromEmail(d.email) || "My company";
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

  const sent = await sendSignInEmail(d.email, { name: d.full_name, next: "/demo/ready", origin: await siteOrigin() });
  if (!sent.ok) return err(`Your answers are saved. ${sent.error}`, d.email);
  // A sign-in link opened in this browser comes back to finish the setup.
  (await cookies()).set("nka_next", "/demo/ready", { path: "/", httpOnly: true, sameSite: "lax", secure: true, maxAge: 3600 });
  return { ok: true, email: d.email, at: Date.now() };
}

// Step 2: check the code, then build the workspace from the answers.
export async function finishDemo(_prev: DemoState, form: FormData): Promise<DemoState> {
  const email = clip(form.get("email"), 200).toLowerCase();
  const token = String(form.get("code") ?? "").replace(/\D/g, "");
  if (!EMAIL.test(email)) return err("Start again with your email address.");
  if (token.length < 6) return err("Enter the code from the email.", email);
  if (!(await verifySignIn({ email, code: token }))) return err("That code didn't work. Use the code from the most recent email.", email);
  await buildWorkspace();
  redirect("/app");
}

async function buildWorkspace(): Promise<never> {
  redirect(await setUpFromDemo());
}
