"use server";
import { revalidatePath } from "next/cache";
import { done, fail, type ActionState } from "@/lib/action";
import { requireStaff } from "@/lib/session";
import { summariseBudget, type LedgerEntry } from "@/lib/budget";
import { planById } from "@/lib/plans";

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
  const { supabase } = await requireStaff();
  const id = str(form.get("id"), 64);
  const amount = num(form.get("amount"));
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
  refresh(id);
  return done(data === "in_progress" ? "Sent. Work has started (no approval needed)." : "Sent to the client for approval.");
}

export async function setStatus(_prev: ActionState, form: FormData): Promise<ActionState> {
  const { supabase } = await requireStaff();
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
  const { supabase } = await requireStaff();
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
  refresh(input.projectId);
  return done("Uploaded and sent for review.");
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

export async function addLedgerEntry(_prev: ActionState, form: FormData): Promise<ActionState> {
  const { supabase } = await requireStaff();
  const org = str(form.get("org"), 64);
  const kind = str(form.get("kind"), 20);
  const raw = num(form.get("amount"));
  if (raw === null || Number.isNaN(raw) || raw === 0) return { ok: false, error: "Enter an amount." };
  // Staff type positive numbers; the sign follows the kind.
  const amount = ["spend", "expiry"].includes(kind) ? -Math.abs(raw) : ["allocation", "top_up", "refund"].includes(kind) ? Math.abs(raw) : raw;
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
