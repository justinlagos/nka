"use server";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { done, fail, type ActionState } from "@/lib/action";
import { ORG_COOKIE, getCurrentMembership, getMemberships, requireProfile } from "@/lib/session";
import { briefFromForm, brandBookText, emptyBrief, SERVICE_OPTIONS } from "@/lib/brief";
import { draftBrief } from "@/lib/ai";
import { notifyClient, notifyDesigner } from "@/lib/notify";
import { sendBrief } from "./brief-actions";
import { siteOrigin } from "@/lib/origin";
import { getStripe, priceForPlan } from "@/lib/stripe";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { planById, type PlanId } from "@/lib/plans";
import { projectRef } from "@/lib/format";

const str = (v: FormDataEntryValue | null, n = 4000) => String(v ?? "").trim().slice(0, n);
const isUuid = (v: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);
const isDate = (v: string) => /^\d{4}-\d{2}-\d{2}$/.test(v);

// ---------- Organisation ----------

export async function createOrg(_prev: ActionState, form: FormData): Promise<ActionState> {
  const { supabase } = await requireProfile();
  const name = str(form.get("name"), 120);
  const country = str(form.get("country"), 80);
  if (!name) return { ok: false, error: "Add your organisation's name." };
  const { data, error } = await supabase.rpc("create_org", { p_name: name, p_country: country });
  if (error) return fail(error);
  (await cookies()).set(ORG_COOKIE, String(data), { path: "/", httpOnly: true, sameSite: "lax", secure: true, maxAge: 31536000 });
  redirect("/app/brand?welcome=1");
}

export async function switchOrg(form: FormData) {
  const id = str(form.get("org"), 64);
  const memberships = await getMemberships();
  if (memberships.some((m) => m.org.id === id)) {
    (await cookies()).set(ORG_COOKIE, id, { path: "/", httpOnly: true, sameSite: "lax", secure: true, maxAge: 31536000 });
  }
  redirect("/app");
}

export async function renameOrg(_prev: ActionState, form: FormData): Promise<ActionState> {
  const { supabase } = await requireProfile();
  const m = await getCurrentMembership();
  if (!m) return { ok: false, error: "No organisation selected." };
  const { error } = await supabase
    .from("orgs")
    .update({ name: str(form.get("name"), 120), country: str(form.get("country"), 80) })
    .eq("id", m.org.id);
  if (error) return fail(error);
  revalidatePath("/app", "layout");
  return done("Saved.");
}

export async function updateMyName(_prev: ActionState, form: FormData): Promise<ActionState> {
  const { supabase, userId } = await requireProfile();
  const { error } = await supabase.from("profiles").update({ full_name: str(form.get("full_name"), 120) }).eq("id", userId);
  if (error) return fail(error);
  revalidatePath("/app", "layout");
  return done("Saved.");
}

// ---------- Brand book ----------

export async function saveBrandBook(_prev: ActionState, form: FormData): Promise<ActionState> {
  const { supabase, userId } = await requireProfile();
  const m = await getCurrentMembership();
  if (!m) return { ok: false, error: "No organisation selected." };
  const { error } = await supabase
    .from("brand_books")
    .update({
      about: str(form.get("about")),
      audiences: str(form.get("audiences")),
      voice: str(form.get("voice")),
      colours: str(form.get("colours"), 2000),
      typefaces: str(form.get("typefaces"), 2000),
      rules: str(form.get("rules")),
      updated_at: new Date().toISOString(),
      updated_by: userId,
    })
    .eq("org_id", m.org.id);
  if (error) return fail(error);
  revalidatePath("/app/brand");
  return done("Brand book saved.");
}

// ---------- Briefs ----------

export async function startBrief(_prev: ActionState, form: FormData): Promise<ActionState> {
  const { supabase, userId } = await requireProfile();
  const m = await getCurrentMembership();
  if (!m) return { ok: false, error: "No organisation selected." };
  const request = str(form.get("request"));
  const deadline = str(form.get("deadline"), 10);
  const service = str(form.get("service"), 40);
  const intent = str(form.get("intent"), 10);
  if (request.length < 8) return { ok: false, error: "Describe what you need in a sentence or two." };

  let title: string;
  let brief = emptyBrief();
  let chosenService = SERVICE_OPTIONS.some((s) => s.value === service) ? service : "";
  if (intent === "draft") {
    const { data: book } = await supabase.from("brand_books").select("*").eq("org_id", m.org.id).maybeSingle();
    const d = await draftBrief(request, brandBookText(book), isDate(deadline) ? deadline : undefined);
    title = d.title;
    brief = d.brief;
    if (!chosenService) chosenService = d.service;
  } else {
    brief.summary = request;
    title = request.split(/[.\n]/)[0].slice(0, 80) || "New project";
  }

  const { data, error } = await supabase
    .from("projects")
    .insert({
      org_id: m.org.id,
      title: title.slice(0, 200),
      service: chosenService,
      brief,
      deadline: isDate(deadline) ? deadline : null,
      created_by: userId,
    })
    .select("id")
    .single();
  if (error) return fail(error);
  redirect(`/app/projects/${data.id}/edit${intent === "draft" ? "?drafted=1" : ""}`);
}

export async function saveBrief(_prev: ActionState, form: FormData): Promise<ActionState> {
  const { supabase } = await requireProfile();
  const id = str(form.get("id"), 64);
  if (!isUuid(id)) return { ok: false, error: "Brief not found." };
  const brief = briefFromForm(form);
  const deadline = str(form.get("deadline"), 10);
  const title = str(form.get("title"), 200);
  if (!title) return { ok: false, error: "Give the project a title." };

  const { data: updated, error } = await supabase
    .from("projects")
    .update({
      title,
      service: SERVICE_OPTIONS.some((s) => s.value === str(form.get("service"), 40)) ? str(form.get("service"), 40) : "",
      brief,
      deadline: isDate(deadline) ? deadline : null,
      kickoff_call: form.get("kickoff_call") === "on",
      allow_ai: form.get("allow_ai") === "on",
      auto_approve: form.get("auto_approve") === "on",
    })
    .eq("id", id)
    .select("id, number, org_id, title")
    .maybeSingle();
  if (error) return fail(error);
  if (!updated) return { ok: false, error: "This brief has been sent and can't be edited. Add a comment on the project instead." };

  if (!["send", "instant"].includes(str(form.get("intent"), 10))) {
    revalidatePath(`/app/projects/${id}`);
    return done("Draft saved.");
  }
  if (!brief.summary) return { ok: false, error: "Fill in 'What you need' before sending." };
  const r = await sendBrief(id, str(form.get("intent"), 10) === "instant" ? "instant" : "designer");
  if (!r.ok) return { ok: false, error: r.error };
  redirect(r.path!);
}

export async function deleteDraft(form: FormData) {
  const { supabase } = await requireProfile();
  const id = str(form.get("id"), 64);
  if (isUuid(id)) await supabase.from("projects").delete().eq("id", id).eq("status", "draft");
  revalidatePath("/app/projects");
  redirect("/app/projects?view=drafts");
}

// ---------- Project decisions ----------

async function rpcAndRefresh(fn: string, args: Record<string, unknown>, projectId: string): Promise<ActionState> {
  const { supabase } = await requireProfile();
  const { error } = await supabase.rpc(fn, args);
  if (error) return fail(error);
  revalidatePath(`/app/projects/${projectId}`);
  revalidatePath("/app", "layout");
  return done();
}

export async function approveEstimate(_prev: ActionState, form: FormData): Promise<ActionState> {
  const id = str(form.get("id"), 64);
  const r = await rpcAndRefresh("approve_estimate", { p_project: id }, id);
  if (r.ok) await tellDesigner(id, "Approved", "The client approved the estimate", "It's in production now. Start when you're ready.");
  return r.ok ? done("Approved. Work has started.") : r;
}

// Short helper for the designer emails sent from the client side.
async function tellDesigner(projectId: string, subjectStart: string, heading: string, ...lines: string[]) {
  const { data: p } = await supabaseAdmin().from("projects").select("number, title, org:orgs(name)").eq("id", projectId).maybeSingle();
  if (!p) return;
  const org = p.org as unknown as { name: string } | null;
  await notifyDesigner(projectId, {
    subject: `${subjectStart}: ${p.title}`,
    heading,
    lines: [`${projectRef(p.number)} ${p.title}, for ${org?.name ?? "your client"}`, ...lines.filter(Boolean)],
    path: `/app/projects/${projectId}`,
    button: "Open the project",
  });
}

export async function declineEstimate(_prev: ActionState, form: FormData): Promise<ActionState> {
  const id = str(form.get("id"), 64);
  const note = str(form.get("note"), 2000);
  if (!note) return { ok: false, error: "Say what needs to change in the estimate." };
  const r = await rpcAndRefresh("decline_estimate", { p_project: id, p_note: note }, id);
  if (r.ok) await tellDesigner(id, "Estimate sent back", "The client wants a different estimate", `What they said: ${note}`);
  return r.ok ? done("Sent back to the studio.") : r;
}

export async function completeProject(_prev: ActionState, form: FormData): Promise<ActionState> {
  const id = str(form.get("id"), 64);
  const r = await rpcAndRefresh("complete_project", { p_project: id }, id);
  if (r.ok) await tellDesigner(id, "Completed", "The client marked this project complete", "Nothing more to do on it.");
  return r.ok ? done("Project completed.") : r;
}

export async function cancelProject(_prev: ActionState, form: FormData): Promise<ActionState> {
  const id = str(form.get("id"), 64);
  const r = await rpcAndRefresh("cancel_project", { p_project: id }, id);
  return r.ok ? done("Project cancelled.") : r;
}

// Called from the review viewer.
export async function decideFile(input: { deliverableId: string; projectId: string; decision: "approved" | "changes_requested"; note: string }) {
  const { supabase } = await requireProfile();
  const { error } = await supabase.rpc("decide_deliverable", {
    p_deliverable: input.deliverableId,
    p_decision: input.decision,
    p_note: input.note.slice(0, 5000),
  });
  if (error) return fail(error);
  await tellDesigner(
    input.projectId,
    input.decision === "approved" ? "File approved" : "Changes requested",
    input.decision === "approved" ? "The client approved a file" : "The client asked for changes",
    input.note ? `What they said: ${input.note}` : "",
  );
  revalidatePath(`/app/projects/${input.projectId}`);
  return done(input.decision === "approved" ? "Approved." : "Changes sent to the studio.");
}

export async function addComment(input: {
  projectId: string;
  orgId: string;
  deliverableId?: string | null;
  body: string;
  pinX?: number | null;
  pinY?: number | null;
}) {
  const { supabase, userId } = await requireProfile();
  const body = input.body.trim().slice(0, 5000);
  if (!body) return { ok: false, error: "Write a comment first." } as ActionState;
  const clamp = (n: number | null | undefined) => (typeof n === "number" && Number.isFinite(n) ? Math.min(1, Math.max(0, n)) : null);
  const { error } = await supabase.from("comments").insert({
    project_id: input.projectId,
    org_id: input.orgId,
    deliverable_id: input.deliverableId ?? null,
    author: userId,
    body,
    pin_x: clamp(input.pinX),
    pin_y: clamp(input.pinY),
  });
  if (error) return fail(error);
  await tellOtherSide(input.projectId, input.orgId, userId, body);
  revalidatePath(`/app/projects/${input.projectId}`);
  return done();
}

// A message from the client emails the designer; a message from the designer or admin emails the client.
// One email per person per 10 minutes on a project, so a burst of messages doesn't become a burst of emails.
async function tellOtherSide(projectId: string, orgId: string, author: string, body: string) {
  const db = supabaseAdmin();
  const since = new Date(Date.now() - 10 * 60_000).toISOString();
  const [{ count }, { data: me }, { data: p }] = await Promise.all([
    db.from("comments").select("id", { count: "exact", head: true }).eq("project_id", projectId).eq("author", author).gte("created_at", since),
    db.from("profiles").select("full_name, is_staff, is_talent").eq("id", author).maybeSingle(),
    db.from("projects").select("number, title").eq("id", projectId).maybeSingle(),
  ]);
  if ((count ?? 0) > 1 || !p) return;
  const excerpt = body.length > 600 ? `${body.slice(0, 600)}…` : body;
  const ref = `${projectRef(p.number)} ${p.title}`;
  if (me?.is_staff || me?.is_talent) {
    await notifyClient(orgId, {
      subject: `New message: ${p.title}`,
      heading: "Your designer sent a message",
      lines: [ref, excerpt],
      path: `/app/projects/${projectId}`,
      button: "Reply in Nka",
    });
  } else {
    const first = (me?.full_name ?? "").split(" ")[0] || "The client";
    await notifyDesigner(projectId, {
      subject: `New message: ${p.title}`,
      heading: `${first} sent a message`,
      lines: [ref, excerpt],
      path: `/app/projects/${projectId}`,
      button: "Reply in Nka",
    });
  }
}

export async function addProjectComment(_prev: ActionState, form: FormData): Promise<ActionState> {
  return addComment({
    projectId: str(form.get("project_id"), 64),
    orgId: str(form.get("org_id"), 64),
    body: str(form.get("body"), 5000),
  });
}

export async function setResolved(input: { commentId: string; projectId: string; resolved: boolean }) {
  const { supabase } = await requireProfile();
  const { error } = await supabase.from("comments").update({ resolved: input.resolved }).eq("id", input.commentId);
  if (error) return fail(error);
  revalidatePath(`/app/projects/${input.projectId}`);
  return done();
}

// After the browser uploads a reference or brand file to storage.
export async function recordAttachment(input: {
  orgId: string;
  projectId: string | null;
  kind: "reference" | "brand";
  path: string;
  fileName: string;
  mime: string;
  size: number;
}) {
  const { supabase, userId } = await requireProfile();
  const { error } = await supabase.from("attachments").insert({
    org_id: input.orgId,
    project_id: input.projectId,
    kind: input.kind,
    storage_path: input.path,
    file_name: input.fileName.slice(0, 200),
    mime: input.mime.slice(0, 120),
    size: Math.max(0, Math.round(input.size)),
    uploaded_by: userId,
  });
  if (error) {
    await supabase.storage.from("files").remove([input.path]);
    return fail(error);
  }
  revalidatePath(input.projectId ? `/app/projects/${input.projectId}` : "/app/brand");
  return done();
}

export async function removeAttachment(form: FormData) {
  const { supabase } = await requireProfile();
  const id = str(form.get("id"), 64);
  const back = str(form.get("back"), 200) || "/app";
  const { data } = await supabase.from("attachments").delete().eq("id", id).select("storage_path").maybeSingle();
  if (data?.storage_path) await supabase.storage.from("files").remove([data.storage_path]);
  revalidatePath(back);
  redirect(back);
}

// ---------- Team ----------

export async function inviteMember(_prev: ActionState, form: FormData): Promise<ActionState> {
  const { supabase, userId } = await requireProfile();
  const m = await getCurrentMembership();
  if (!m) return { ok: false, error: "No organisation selected." };
  const email = str(form.get("email"), 200).toLowerCase();
  const role = str(form.get("role"), 10);
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { ok: false, error: "Enter a valid email address." };
  if (!["admin", "member", "viewer"].includes(role)) return { ok: false, error: "Choose a role." };
  const { data, error } = await supabase
    .from("invites")
    .insert({ org_id: m.org.id, email, role, invited_by: userId })
    .select("token")
    .single();
  if (error) return fail(error);
  revalidatePath("/app/team");
  return done(`Invite ready. Copy the link below and send it to ${email}.`);
}

export async function revokeInvite(form: FormData) {
  const { supabase } = await requireProfile();
  await supabase.from("invites").delete().eq("id", str(form.get("id"), 64));
  revalidatePath("/app/team");
}

export async function removeMember(form: FormData) {
  const { supabase } = await requireProfile();
  const m = await getCurrentMembership();
  if (!m) return;
  await supabase.from("org_members").delete().eq("org_id", m.org.id).eq("user_id", str(form.get("user"), 64));
  revalidatePath("/app/team");
}

export async function changeRole(form: FormData) {
  const { supabase } = await requireProfile();
  const m = await getCurrentMembership();
  if (!m) return;
  await supabase.rpc("set_member_role", { p_org: m.org.id, p_user: str(form.get("user"), 64), p_role: str(form.get("role"), 10) });
  revalidatePath("/app/team");
}

export async function acceptInvite(_prev: ActionState, form: FormData): Promise<ActionState> {
  const { supabase } = await requireProfile();
  const { data, error } = await supabase.rpc("accept_invite", { p_token: str(form.get("token"), 64) });
  if (error) return fail(error);
  (await cookies()).set(ORG_COOKIE, String(data), { path: "/", httpOnly: true, sameSite: "lax", secure: true, maxAge: 31536000 });
  redirect("/app");
}

// ---------- Resizes ----------

export async function requestResize(_prev: ActionState, form: FormData): Promise<ActionState> {
  const { supabase } = await requireProfile();
  const id = str(form.get("id"), 64);
  if (!isUuid(id)) return { ok: false, error: "File not found." };
  const sizes = str(form.get("sizes"), 2000);
  if (!sizes) return { ok: false, error: "List the sizes or formats you need." };
  const { data, error } = await supabase.rpc("request_resize", { p_deliverable: id, p_sizes: sizes });
  if (error) return fail(error);
  await tellDesigner(String(data), "Resize", "The client wants other sizes of an approved file", `Sizes: ${sizes}`, "Resizes are free and don't use a request slot.");
  revalidatePath("/app", "layout");
  redirect(`/app/projects/${data}?sent=resize`);
}

// ---------- Billing ----------

export async function startCheckout(_prev: ActionState, form: FormData): Promise<ActionState> {
  const { profile } = await requireProfile();
  const m = await getCurrentMembership();
  if (!m) return { ok: false, error: "No organisation selected." };
  if (m.role !== "owner" && m.role !== "admin") return { ok: false, error: "Only an owner or admin can change the plan." };
  const plan = planById(str(form.get("plan"), 20));
  if (!plan) return { ok: false, error: "Choose a plan." };
  const stripe = getStripe();
  if (!stripe) return { ok: false, error: "Card payments aren't switched on yet. Message the studio and we'll set your plan up." };

  let url: string | null = null;
  try {
    const price = await priceForPlan(stripe, plan.id as PlanId);
    if (!price) return { ok: false, error: `The ${plan.name} price isn't set up in Stripe yet.` };
    const origin = await siteOrigin();
    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      line_items: [{ price, quantity: 1 }],
      client_reference_id: m.org.id,
      ...(m.org.stripe_customer_id ? { customer: m.org.stripe_customer_id } : { customer_email: profile.email }),
      subscription_data: { metadata: { org_id: m.org.id, plan: plan.id } },
      metadata: { org_id: m.org.id, plan: plan.id },
      allow_promotion_codes: true,
      billing_address_collection: "required",
      success_url: `${origin}/app/billing?checkout=done`,
      cancel_url: `${origin}/app/billing?checkout=cancelled`,
    });
    url = session.url;
  } catch (err) {
    console.error("Checkout failed", err);
    return { ok: false, error: "Stripe couldn't start checkout. Try again, or book a call." };
  }
  if (!url) return { ok: false, error: "Stripe couldn't start checkout." };
  redirect(url);
}

async function recordPlanStatus(orgId: string, status: "paused" | "active") {
  try {
    const { error } = await supabaseAdmin().from("orgs").update({ plan_status: status }).eq("id", orgId);
    if (error) console.error("Plan status not saved; the webhook will catch up", error.message);
  } catch (err) {
    console.error("Plan status not saved; the webhook will catch up", err);
  }
}

// Pause a card plan for up to a month: no charge, nothing new starts, work already started is finished.
export async function pausePlan(_prev: ActionState, _form: FormData): Promise<ActionState> {
  const { supabase } = await requireProfile();
  const m = await getCurrentMembership();
  if (!m) return { ok: false, error: "No organisation selected." };
  if (m.role !== "owner" && m.role !== "admin") return { ok: false, error: "Only an owner or admin can pause the plan." };
  const stripe = getStripe();
  if (!stripe) return { ok: false, error: "Billing isn't switched on yet." };
  const { data: o } = await supabase.from("orgs").select("stripe_subscription_id, plan_status").eq("id", m.org.id).single();
  if (!o?.stripe_subscription_id) return { ok: false, error: "Only card plans can be paused here. Message the studio to pause another plan." };
  if (o.plan_status !== "active") return { ok: false, error: "Only an active plan can be paused." };
  const resumes = new Date(Date.now() + 30 * 86_400_000);
  try {
    await stripe.subscriptions.update(o.stripe_subscription_id, {
      pause_collection: { behavior: "void", resumes_at: Math.floor(resumes.getTime() / 1000) },
    });
  } catch (err) {
    console.error("Pause failed", err);
    return { ok: false, error: "Stripe couldn't pause the plan. Try again shortly." };
  }
  // Show it straight away; the Stripe webhook confirms the same thing.
  await recordPlanStatus(m.org.id, "paused");
  revalidatePath("/app", "layout");
  return done(`Paused. No charge until ${resumes.toLocaleDateString("en-GB", { day: "numeric", month: "long" })}.`);
}

export async function resumePlan(_prev: ActionState, _form: FormData): Promise<ActionState> {
  const { supabase } = await requireProfile();
  const m = await getCurrentMembership();
  if (!m) return { ok: false, error: "No organisation selected." };
  if (m.role !== "owner" && m.role !== "admin") return { ok: false, error: "Only an owner or admin can resume the plan." };
  const stripe = getStripe();
  if (!stripe) return { ok: false, error: "Billing isn't switched on yet." };
  const { data: o } = await supabase.from("orgs").select("stripe_subscription_id").eq("id", m.org.id).single();
  if (!o?.stripe_subscription_id) return { ok: false, error: "Message the studio to resume this plan." };
  try {
    await stripe.subscriptions.update(o.stripe_subscription_id, { pause_collection: "" });
  } catch (err) {
    console.error("Resume failed", err);
    return { ok: false, error: "Stripe couldn't resume the plan. Try again shortly." };
  }
  // Resuming starts any queued briefs that now fit.
  await recordPlanStatus(m.org.id, "active");
  revalidatePath("/app", "layout");
  return done("Resumed. Queued briefs start now.");
}

export async function openBillingPortal(_prev: ActionState, _form: FormData): Promise<ActionState> {
  const m = await getCurrentMembership();
  if (!m?.org.stripe_customer_id) return { ok: false, error: "There's no card subscription on this account yet." };
  if (m.role !== "owner" && m.role !== "admin") return { ok: false, error: "Only an owner or admin can manage billing." };
  const stripe = getStripe();
  if (!stripe) return { ok: false, error: "Billing isn't switched on yet." };
  let url: string;
  try {
    const session = await stripe.billingPortal.sessions.create({
      customer: m.org.stripe_customer_id,
      return_url: `${await siteOrigin()}/app/billing`,
    });
    url = session.url;
  } catch (err) {
    console.error("Portal failed", err);
    return { ok: false, error: "Stripe couldn't open billing. Try again shortly." };
  }
  redirect(url);
}
