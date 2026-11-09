"use server";
import { supabaseServer } from "@/lib/supabase/server";
import { done, fail, type ActionState } from "@/lib/action";
import { notifyStudio } from "@/lib/notify";

const clip = (v: FormDataEntryValue | null, n: number) => String(v ?? "").trim().slice(0, n);

export async function sendBooking(_prev: ActionState, form: FormData): Promise<ActionState> {
  // Bots fill every field, including this hidden one.
  if (clip(form.get("website"), 200)) return done("Thanks. We'll reply within one working day.");

  const lead = {
    name: clip(form.get("name"), 120),
    email: clip(form.get("email"), 200).toLowerCase(),
    company: clip(form.get("company"), 160),
    company_size: clip(form.get("company_size"), 40),
    country: clip(form.get("country"), 80),
    interest: clip(form.get("interest"), 40),
    budget: clip(form.get("budget"), 40),
    message: clip(form.get("message"), 4000),
  };
  if (!lead.name) return { ok: false, error: "Add your name." };
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(lead.email)) return { ok: false, error: "Add an email address we can reply to." };

  const supabase = await supabaseServer();
  const { error } = await supabase.from("leads").insert(lead);
  if (error) return fail(error);

  await notifyStudio(`New call request: ${lead.company || lead.name}`, [
    `${lead.name} <${lead.email}>`,
    `Company: ${lead.company} (${lead.company_size})`,
    `Country: ${lead.country}`,
    `Interested in: ${lead.interest}   Budget: ${lead.budget}`,
    "",
    lead.message,
  ]);
  return done("Thanks. We'll reply within one working day.");
}
