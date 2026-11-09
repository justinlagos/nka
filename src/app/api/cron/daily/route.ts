import { NextResponse, type NextRequest } from "next/server";
import { serverEnv } from "@/lib/env";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { notifyClient, notifyStudio } from "@/lib/notify";
import { siteOrigin } from "@/lib/origin";
import { date, projectRef } from "@/lib/format";
import { ukDate } from "@/lib/ontime";

// Runs each weekday morning (vercel.json). Reminds clients about anything waiting on them for
// two days or more, and sends the studio one list of what's late or still needs an estimate.
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

  const [{ data: late }, { data: unestimated }] = await Promise.all([
    db
      .from("projects")
      .select("id, number, title, estimate_due")
      .in("status", ["submitted", "in_progress", "changes_requested"])
      .lt("estimate_due", today)
      .limit(100),
    db.from("projects").select("id, number, title").eq("status", "submitted").is("estimate_due", null).lt("submitted_at", oneDayAgo).limit(100),
  ]);
  if ((late?.length ?? 0) + (unestimated?.length ?? 0) > 0) {
    await notifyStudio(`Studio today: ${late?.length ?? 0} late, ${unestimated?.length ?? 0} waiting for an estimate`, [
      ...(late ?? []).map((p) => `LATE (due ${date(p.estimate_due)}): ${projectRef(p.number)} ${p.title}  ${origin}/app/projects/${p.id}`),
      ...(unestimated ?? []).map((p) => `NEEDS ESTIMATE: ${projectRef(p.number)} ${p.title}  ${origin}/app/projects/${p.id}`),
    ]);
  }
  return NextResponse.json({ reminded: waiting?.length ?? 0, late: late?.length ?? 0, unestimated: unestimated?.length ?? 0 });
}
