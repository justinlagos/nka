import { NextResponse, type NextRequest } from "next/server";
import { serverEnv } from "@/lib/env";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { notifyClient, notifyDirect, notifyStudio } from "@/lib/notify";
import { siteOrigin } from "@/lib/origin";
import { date, projectRef } from "@/lib/format";
import { ukDate } from "@/lib/ontime";
import { startWaitingBriefs } from "@/lib/automation";

// Runs each weekday morning (vercel.json). Reminds clients about anything waiting on them for two days
// or more, sends each designer their own list (late, due today, changes asked, needs a date), and sends
// the admin one list of problems (late by designer, needs a price, no date, no designer).
export async function GET(request: NextRequest) {
  const { cronSecret } = serverEnv();
  if (!cronSecret || request.headers.get("authorization") !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Not allowed" }, { status: 401 });
  }
  const db = supabaseAdmin();
  const origin = await siteOrigin();
  const twoDaysAgo = new Date(Date.now() - 2 * 86_400_000).toISOString();
  const oneDayAgo = new Date(Date.now() - 86_400_000).toISOString();
  const today = ukDate(new Date());

  // A new month renews plan hours: briefs that were waiting for hours start now.
  const startedWaiting = await startWaitingBriefs(null, origin);

  const { data: waiting } = await db
    .from("projects")
    .select("id, number, title, status, org_id, last_nudged_at")
    .in("status", ["awaiting_approval", "in_review"])
    .lt("updated_at", twoDaysAgo)
    .or(`last_nudged_at.is.null,last_nudged_at.lt.${twoDaysAgo}`)
    .limit(200);
  for (const p of waiting ?? []) {
    await notifyClient(p.org_id, {
      origin,
      subject: `Waiting on you: ${p.title}`,
      heading: p.status === "awaiting_approval" ? "Your estimate is waiting" : "Files are waiting for your review",
      lines: [`${projectRef(p.number)} ${p.title}`, "Your designer can't move on until you've had a look."],
      path: `/app/projects/${p.id}`,
      button: p.status === "awaiting_approval" ? "Review the estimate" : "Review the files",
    });
    await db.from("projects").update({ last_nudged_at: new Date().toISOString() }).eq("id", p.id);
  }

  // Each designer: their own list for the day. The admin: problems only.
  const open = ["submitted", "in_progress", "changes_requested", "awaiting_approval", "in_review"];
  const [{ data: work }, { data: people }, { data: orgs }, { data: inReview }, { data: waitingHours }] = await Promise.all([
    db.from("projects").select("id, number, title, status, estimate_due, estimate_sent_at, estimate_hours, submitted_at, assignee, org:orgs(name, lead_id)").in("status", open).limit(1000),
    db.from("profiles").select("*").or("is_talent.eq.true,is_staff.eq.true"),
    db.from("orgs").select("id, name, lead_id"),
    db.from("deliverables").select("id, title, version, project_id, created_at").eq("status", "internal_review").lt("created_at", oneDayAgo).limit(200),
    db.from("project_events").select("project_id").eq("kind", "waiting_for_hours").limit(1000),
  ]);
  const waitsForHours = new Set((waitingHours ?? []).map((e) => e.project_id as string));
  // Before migration 0012 there are no designers: the admin only.
  const designers = (people ?? (await db.from("profiles").select("*").eq("is_staff", true)).data ?? []) as {
    id: string;
    email: string;
    full_name: string;
    is_talent?: boolean;
    is_staff: boolean;
  }[];
  type Row = { id: string; number: number; title: string; status: string; estimate_due: string | null; estimate_sent_at: string | null; submitted_at: string | null; assignee: string | null; org: { name: string; lead_id: string | null } | null };
  const rows = (work ?? []) as unknown as Row[];
  const owner = (r: Row) => r.assignee ?? r.org?.lead_id ?? null;
  const link = (r: Row) => `${origin}/studio/projects/${r.id}`;
  const adminLink = (r: Row) => `${origin}/admin/projects/${r.id}`;
  const line = (r: Row) => `${projectRef(r.number)} ${r.title} (${r.org?.name ?? ""})`;
  const isLate = (r: Row) => ["submitted", "in_progress", "changes_requested"].includes(r.status) && !!r.estimate_due && r.estimate_due < today;
  const needsDate = (r: Row) => r.status === "submitted" && !r.estimate_due && !waitsForHours.has(r.id) && (r.submitted_at ?? "") < oneDayAgo;
  const needsPrice = (r: Row) => r.status === "submitted" && !!r.estimate_due && !r.estimate_sent_at;

  let designerEmails = 0;
  for (const d of designers.filter((x) => x.is_talent && !x.is_staff)) {
    const mine = rows.filter((r) => owner(r) === d.id);
    const late = mine.filter(isLate);
    const dueToday = mine.filter((r) => r.estimate_due === today && ["in_progress", "changes_requested"].includes(r.status));
    const changes = mine.filter((r) => r.status === "changes_requested" && !isLate(r));
    const dates = mine.filter((r) => r.status === "submitted" && !r.estimate_due);
    if (!late.length && !dueToday.length && !changes.length && !dates.length) continue;
    await notifyDesignerDigest(d.email, origin, [
      ...late.map((r) => `LATE (was due ${date(r.estimate_due)}): ${line(r)}  ${link(r)}`),
      ...dueToday.map((r) => `DUE TODAY: ${line(r)}  ${link(r)}`),
      ...changes.map((r) => `CHANGES ASKED: ${line(r)}  ${link(r)}`),
      ...dates.map((r) => `NEEDS A DATE: ${line(r)}  ${link(r)}`),
    ], late.length);
    designerEmails++;
  }

  const name = new Map(designers.map((d) => [d.id, d.full_name || d.email]));
  const late = rows.filter(isLate);
  const noDate = rows.filter(needsDate);
  const noPrice = rows.filter(needsPrice);
  const unassigned = (orgs ?? []).filter((o) => !o.lead_id);
  const byDesigner = new Map<string, number>();
  for (const r of late) byDesigner.set(name.get(owner(r) ?? "") ?? "Nobody", (byDesigner.get(name.get(owner(r) ?? "") ?? "Nobody") ?? 0) + 1);
  const review = (inReview ?? []) as { id: string; title: string; version: number; project_id: string }[];
  const problems = late.length + noDate.length + noPrice.length + unassigned.length + review.length;
  if (problems > 0) {
    await notifyStudio(`Nka today: ${late.length} late, ${review.length} waiting for review, ${noPrice.length} to price, ${noDate.length} without a date, ${unassigned.length} without a designer`, [
      ...review.map((d) => `WAITING FOR NKA REVIEW OVER A DAY: ${d.title} v${d.version}  ${origin}/admin/projects/${d.project_id}`),
      ...(byDesigner.size ? ["Late by designer: " + [...byDesigner].map(([n, c]) => `${n} ${c}`).join(", "), ""] : []),
      ...late.map((r) => `LATE (due ${date(r.estimate_due)}, ${name.get(owner(r) ?? "") ?? "nobody"}): ${line(r)}  ${adminLink(r)}`),
      ...noPrice.map((r) => `NEEDS A PRICE: ${line(r)}  ${adminLink(r)}`),
      ...noDate.map((r) => `NO DATE AFTER A DAY (${name.get(owner(r) ?? "") ?? "nobody"}): ${line(r)}  ${adminLink(r)}`),
      ...unassigned.map((o) => `NO DESIGNER: ${o.name}  ${origin}/admin/clients/${o.id}`),
    ]);
  }
  return NextResponse.json({ reminded: waiting?.length ?? 0, designers: designerEmails, problems, startedWaiting });
}

async function notifyDesignerDigest(email: string, origin: string, lines: string[], late: number) {
  await notifyDirect(email, {
    subject: late ? `Today: ${late} late` : "Today on Nka",
    heading: "Your work today",
    lines,
    link: `${origin}/studio`,
    button: "Open your work",
  });
}
