"use server";
import { revalidatePath } from "next/cache";
import { done, fail, type ActionState } from "@/lib/action";
import { requireStaff, requireStudio } from "@/lib/session";
import { summariseBudget, type LedgerEntry } from "@/lib/budget";
import { planById } from "@/lib/plans";
import { notifyClient, notifyDirect, notifyStudio } from "@/lib/notify";
import { siteOrigin } from "@/lib/origin";
import { date, projectRef } from "@/lib/format";

const str = (v: FormDataEntryValue | null, n = 4000) => String(v ?? "").trim().slice(0, n);
const num = (v: FormDataEntryValue | null) => {
  const s = str(v, 30);
  if (!s) return null;
  const n = Number(s.replace(/,/g, ""));
  return Number.isFinite(n) ? n : NaN;
};

function refresh(projectId?: string, orgId?: string) {
  if (projectId) revalidatePath(`/app/projects/${projectId}`);
  if (orgId) revalidatePath(`/admin/clients/${orgId}`);
  revalidatePath("/admin");
}

export async function sendEstimate(_prev: ActionState, form: FormData): Promise<ActionState> {
  const { supabase, isAdmin } = await requireStudio();
  const id = str(form.get("id"), 64);
  const amount = isAdmin ? num(form.get("amount")) : null;
  const hours = num(form.get("hours"));
  const due = str(form.get("due"), 10);
  if (Number.isNaN(amount) || Number.isNaN(hours)) return { ok: false, error: "Amount and hours must be numbers." };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(due)) return { ok: false, error: "Set a delivery date." };
  const { data, error } = await supabase.rpc("staff_send_estimate", {
    p_project: id,
    p_amount: amount ?? 0,
    p_hours: hours,
    p_due: due,
    p_notes: str(form.get("notes"), 4000),
  });
  if (error) return fail(error);
  const { data: p } = await supabase.from("projects").select("org_id, number, title, org:orgs(name)").eq("id", id).single();
  if (p && data === "proposed") {
    const org = p.org as unknown as { name: string } | null;
    await notifyStudio(`Needs a price: ${projectRef(p.number)} ${p.title}`, [
      `${org?.name ?? "A client"} isn't on a paid-up plan, so this brief needs a price before it goes to them.`,
      `The designer proposed delivery by ${date(due)}${hours ? `, ${hours} hours` : ""}.`,
      `${await siteOrigin()}/app/projects/${id}`,
    ]);
    refresh(id);
    return done("Date proposed. The Nka admin adds the price and sends it to the client.");
  }
  if (p) {
    await notifyClient(
      p.org_id,
      data === "in_progress"
        ? {
            subject: `Started: ${p.title}`,
            heading: "Your designer has started",
            lines: [`${projectRef(p.number)} ${p.title}`, `First draft due ${date(due)}.`],
            path: `/app/projects/${id}`,
            button: "See the project",
          }
        : {
            subject: `Estimate ready: ${p.title}`,
            heading: "Your estimate is ready",
            lines: [`${projectRef(p.number)} ${p.title}`, `Delivery ${date(due)}. The price is fixed once you approve it.`],
            path: `/app/projects/${id}`,
            button: "Review and approve",
          },
    );
  }
  refresh(id);
  return done(data === "in_progress" ? "Sent. Work has started (no approval needed)." : "Sent to the client for approval.");
}

export async function setStatus(_prev: ActionState, form: FormData): Promise<ActionState> {
  const { supabase } = await requireStudio();
  const id = str(form.get("id"), 64);
  const { error } = await supabase.rpc("staff_set_status", { p_project: id, p_status: str(form.get("status"), 30) });
  if (error) return fail(error);
  refresh(id);
  return done("Status updated.");
}

export async function assign(_prev: ActionState, form: FormData): Promise<ActionState> {
  const { supabase } = await requireStaff();
  const id = str(form.get("id"), 64);
  const user = str(form.get("user"), 64);
  const { error } = await supabase.rpc("staff_assign", { p_project: id, p_user: user || null });
  if (error) return fail(error);
  refresh(id);
  return done("Assigned.");
}

// Called by the deliverable uploader after the file is in storage.
export async function addDeliverable(input: {
  projectId: string;
  title: string;
  path: string;
  fileName: string;
  mime: string;
  size: number;
  note: string;
}) {
  const { supabase } = await requireStudio();
  const { error } = await supabase.rpc("staff_add_deliverable", {
    p_project: input.projectId,
    p_title: input.title.slice(0, 200),
    p_path: input.path,
    p_file_name: input.fileName.slice(0, 200),
    p_mime: input.mime.slice(0, 120),
    p_size: Math.max(0, Math.round(input.size)),
    p_note: input.note.slice(0, 2000),
  });
  if (error) {
    await supabase.storage.from("files").remove([input.path]);
    return fail(error);
  }
  const { data: p } = await supabase.from("projects").select("org_id, number, title").eq("id", input.projectId).single();
  if (p) {
    await notifyClient(p.org_id, {
      subject: `Ready to review: ${input.title}`,
      heading: "A new file is ready to review",
      lines: [`${projectRef(p.number)} ${p.title}`, `${input.title}${input.note ? `: ${input.note}` : ""}`],
      path: `/app/projects/${input.projectId}`,
      button: "Review it",
    });
  }
  refresh(input.projectId);
  return done("Uploaded and sent for review. The client has been emailed.");
}

export async function setPlan(_prev: ActionState, form: FormData): Promise<ActionState> {
  const { supabase } = await requireStaff();
  const org = str(form.get("org"), 64);
  const plan = str(form.get("plan"), 20);
  const status = str(form.get("status"), 20);
  const limitRaw = num(form.get("limit"));
  const rollover = num(form.get("rollover"));
  const limit = limitRaw ?? planById(plan)?.activeLimit ?? null;
  if (Number.isNaN(limit) || Number.isNaN(rollover)) return { ok: false, error: "Limits must be numbers." };
  const { error } = await supabase.rpc("staff_set_plan", {
    p_org: org,
    p_plan: plan,
    p_status: status,
    p_limit: limit,
    p_currency: str(form.get("currency"), 3) || null,
    p_rollover: rollover ?? null,
  });
  if (error) return fail(error);
  refresh(undefined, org);
  return done("Plan saved.");
}

export async function setLead(_prev: ActionState, form: FormData): Promise<ActionState> {
  const { supabase } = await requireStaff();
  const org = str(form.get("org"), 64);
  const lead = str(form.get("lead"), 64);
  if (!lead) return { ok: false, error: "Choose a designer." };
  const note = str(form.get("note"), 2000);
  const { data: before } = await supabase.from("orgs").select("name, lead_id").eq("id", org).single();
  const { error } = await supabase.rpc("staff_set_lead", { p_org: org, p_user: lead, p_note: note });
  if (error) return fail(error);
  const origin = await siteOrigin();
  // The new designer hears about their client; the client gets the handover note (never the designer's name).
  const { data: d } = await supabase.from("profiles").select("email").eq("id", lead).maybeSingle();
  if (d?.email && before) {
    await sendTo(d.email, `New client: ${before.name}`, "You're the designer for a new client", [
      `${before.name} is yours from today. Their open projects have moved to you.`,
      "Read their brand book and open briefs first.",
    ], `${origin}/studio`, "Open your work");
  }
  if (before?.lead_id && note) {
    await notifyClient(org, {
      origin,
      subject: "A new designer on your account",
      heading: "Your designer has changed",
      lines: [note, "Your files, briefs and conversations stay where they are."],
      path: "/app",
      button: "Open your workspace",
    });
  }
  refresh(undefined, org);
  return done("Lead saved. Open work has moved to them.");
}

// ---------- Designers and partners ----------

async function sendTo(email: string, subject: string, heading: string, lines: string[], link: string, button: string) {
  await notifyDirect(email, { subject, heading, lines, link, button });
}

export async function addDesigner(_prev: ActionState, form: FormData): Promise<ActionState> {
  const { supabase } = await requireStaff();
  const email = str(form.get("email"), 200).toLowerCase();
  const partner = str(form.get("partner"), 64);
  const { data, error } = await supabase.rpc("admin_add_designer", {
    p_email: email,
    p_alias: str(form.get("alias"), 60),
    p_partner: partner || null,
  });
  if (error) return fail(error);
  await sendTo(email, "You're a designer on Nka", "Welcome to Nka", [
    "You've been added as a designer. Sign in with this email address to see the clients assigned to you.",
    "Clients see you by the name Nka gives you, never your own name or contact details. Keep all conversation in Nka.",
  ], `${await siteOrigin()}/signin?next=/studio`, "Sign in");
  revalidatePath("/admin/designers");
  return done(data === "ready" ? "Added. They can see their clients now." : "Added. They become a designer when they first sign in.");
}

export async function updateDesigner(_prev: ActionState, form: FormData): Promise<ActionState> {
  const { supabase } = await requireStaff();
  const partner = str(form.get("partner"), 64);
  const { error } = await supabase.rpc("admin_set_designer", {
    p_user: str(form.get("id"), 64),
    p_alias: str(form.get("alias"), 60),
    p_partner: partner || null,
    p_active: form.get("active") === "on",
  });
  if (error) return fail(error);
  revalidatePath("/admin/designers");
  return done("Saved.");
}

export async function savePartner(_prev: ActionState, form: FormData): Promise<ActionState> {
  const { supabase } = await requireStaff();
  const id = str(form.get("id"), 64);
  const share = num(form.get("share"));
  if (Number.isNaN(share)) return { ok: false, error: "The share must be a number." };
  const { error } = await supabase.rpc("admin_save_partner", {
    p_id: id || null,
    p_name: str(form.get("name"), 200),
    p_contact_name: str(form.get("contact_name"), 200),
    p_contact_email: str(form.get("contact_email"), 200),
    p_share: share,
    p_agreement: str(form.get("agreement"), 5000),
    p_active: id ? form.get("active") === "on" : true,
  });
  if (error) return fail(error);
  revalidatePath("/admin/designers");
  return done("Partner saved.");
}

export async function addLedgerEntry(_prev: ActionState, form: FormData): Promise<ActionState> {
  const { supabase } = await requireStaff();
  const org = str(form.get("org"), 64);
  const kind = str(form.get("kind"), 20);
  const raw = num(form.get("amount"));
  if (raw === null || Number.isNaN(raw) || raw === 0) return { ok: false, error: "Enter an amount." };
  // Staff type positive numbers; the sign follows the kind.
  const amount = ["spend", "expiry", "payout"].includes(kind) ? -Math.abs(raw) : ["allocation", "top_up", "refund"].includes(kind) ? Math.abs(raw) : raw;
  const effective = str(form.get("effective"), 10);
  const { error } = await supabase.rpc("staff_ledger_entry", {
    p_org: org,
    p_kind: kind,
    p_amount: amount,
    p_note: str(form.get("note"), 500),
    p_project: null,
    p_effective: /^\d{4}-\d{2}-\d{2}$/.test(effective) ? effective : null,
  });
  if (error) return fail(error);
  refresh(undefined, org);
  return done("Recorded.");
}

// Writes off any allocation that is past its rollover window and still unused.
export async function expireBudget(_prev: ActionState, form: FormData): Promise<ActionState> {
  const { supabase } = await requireStaff();
  const org = str(form.get("org"), 64);
  const [{ data: o }, { data: rows }] = await Promise.all([
    supabase.from("orgs").select("rollover_months").eq("id", org).single(),
    supabase.from("budget_ledger").select("kind, amount, effective_on").eq("org_id", org),
  ]);
  const today = new Date().toISOString().slice(0, 10);
  const s = summariseBudget((rows ?? []) as LedgerEntry[], o?.rollover_months ?? 2, today);
  if (s.expirable <= 0) return done("Nothing to expire.");
  const { error } = await supabase.rpc("staff_ledger_entry", {
    p_org: org,
    p_kind: "expiry",
    p_amount: -s.expirable,
    p_note: "Unused budget past its rollover window",
    p_project: null,
    p_effective: today,
  });
  if (error) return fail(error);
  refresh(undefined, org);
  return done(`Expired ${s.expirable.toFixed(2)}.`);
}

export async function setLeadStatus(form: FormData) {
  const { supabase } = await requireStaff();
  await supabase.from("leads").update({ status: str(form.get("status"), 20) }).eq("id", str(form.get("id"), 64));
  revalidatePath("/admin/leads");
}
