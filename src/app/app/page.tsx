import Link from "next/link";
import { ProjectList, type ProjectRow } from "@/components/ProjectList";
import { BriefChat } from "@/components/BriefChat";
import { instantStatus } from "@/lib/instant";
import { requireMembership } from "@/lib/session";
import { ACTIVE } from "@/lib/status";
import { onPlan, planLabel } from "@/lib/plans";
import { date } from "@/lib/format";
import { people, displayName } from "@/lib/data";
import { onTimeRecord, ukDate } from "@/lib/ontime";

export const maxDuration = 300;

export default async function WorkspaceHome() {
  const { supabase, org, profile } = await requireMembership();
  const today = new Date().toISOString().slice(0, 10);
  const monthStart = today.slice(0, 8) + "01";

  const planOn = onPlan(org.plan, org.plan_status);
  const [{ data: projects }, { data: hours }, { data: leadRow }, { data: handovers }, { data: firstFiles }] = await Promise.all([
    supabase
      .from("projects")
      .select("id, number, title, status, deadline, estimate_due, updated_at, completed_at")
      .eq("org_id", org.id)
      .order("updated_at", { ascending: false })
      .limit(200),
    planOn ? supabase.rpc("hours_balance", { p_org: org.id }) : Promise.resolve({ data: null }),
    supabase.from("orgs").select("lead_id, lead_since").eq("id", org.id).maybeSingle(),
    supabase.from("lead_changes").select("from_user, note, created_at").eq("org_id", org.id).order("created_at", { ascending: false }).limit(1),
    supabase.from("deliverables").select("project_id, released_at").eq("org_id", org.id).not("released_at", "is", null).order("released_at").limit(2000),
  ]);

  const rows = (projects ?? []) as (ProjectRow & { completed_at: string | null })[];
  const active = rows.filter((p) => (ACTIVE as string[]).includes(p.status));
  const waiting = rows.filter((p) => p.status === "awaiting_approval" || p.status === "in_review");
  const queued = rows.filter((p) => p.status === "queued");
  const doneThisMonth = rows.filter((p) => p.status === "completed" && (p.completed_at ?? "") >= monthStart);
  const hoursLeft = hours ? Number((hours as { left: number }).left) : null;
  const firstName = profile.full_name.split(" ")[0];

  const instant = await instantStatus(supabase, org.id);
  const leadId = (leadRow?.lead_id as string | null) ?? null;
  const lastHandover = (handovers ?? [])[0];
  const who = await people(supabase, [leadId]);
  const lead = leadId ? who.get(leadId) : undefined;

  const firstDelivery = new Map<string, string>();
  for (const f of firstFiles ?? []) if (!firstDelivery.has(f.project_id) && f.released_at) firstDelivery.set(f.project_id, ukDate(f.released_at));
  const record = onTimeRecord(rows.map((p) => ({ due: p.estimate_due, firstDelivered: firstDelivery.get(p.id) ?? null })));

  return (
    <>
      <div className="app-head">
        <div>
          <h1>{firstName ? `Hello, ${firstName}` : "Home"}</h1>
          <p className="muted">
            {org.name}, {planLabel(org.plan)}
            {org.plan_status === "past_due" ? ". Your last payment failed; update your card in Billing." : ""}
          </p>
        </div>
        <Link href="/app/projects/new" className="btn">
          New brief
        </Link>
      </div>

      <div className="stats">
        <div className="stat">
          <b>{active.length}</b>
          <span>
            In progress{org.active_limit && planOn ? ` (plan allows ${org.active_limit})` : ""}
          </span>
        </div>
        <div className="stat">
          <b>{waiting.length}</b>
          <span>Waiting on you</span>
        </div>
        <div className="stat">
          <b>{queued.length}</b>
          <span>Queued</span>
        </div>
        <div className="stat">
          <b>{doneThisMonth.length}</b>
          <span>Completed this month</span>
        </div>
        {record.total > 0 && (
          <div className="stat">
            <b>
              {record.onTime} of {record.total}
            </b>
            <span>First drafts on time</span>
          </div>
        )}
        {hoursLeft !== null && (
          <div className="stat">
            <b>{hoursLeft}</b>
            <span>
              <Link href="/app/billing">Team hours left</Link>
            </span>
          </div>
        )}
      </div>

      <div className="grid-main">
        <div>
          {waiting.length > 0 && (
            <section className="panel">
              <h2>Waiting on you</h2>
              <ProjectList rows={waiting} empty={null} />
            </section>
          )}
          <section className="panel">
            <h2>Projects</h2>
            <ProjectList
              rows={rows.filter((p) => p.status !== "cancelled").slice(0, 12)}
              empty={
                <>
                  <strong>No projects yet.</strong>
                  Describe your first request on the right, or fill in your <Link href="/app/brand">brand book</Link> first so
                  briefs come out on brand.
                </>
              }
            />
            {rows.length > 12 && (
              <p style={{ marginTop: 12 }}>
                <Link href="/app/projects?view=all">All projects</Link>
              </p>
            )}
          </section>
        </div>
        <aside>
          <section className="panel">
            <h2>Your designer</h2>
            {lead ? (
              <>
                <p style={{ marginBottom: 6 }}>
                  <b>{displayName(lead)}</b> leads your account and works on your briefs
                  {leadRow?.lead_since ? `, since ${date(leadRow.lead_since)}` : ""}.
                </p>
                {lastHandover?.from_user && lastHandover.note && (
                  <p className="small muted">
                    Handover note, {date(lastHandover.created_at)}: {lastHandover.note}
                  </p>
                )}
              </>
            ) : (
              <p className="small muted">Nka gives your account a team before your first brief starts. You&apos;ll see your lead here.</p>
            )}
          </section>
          <section className="panel">
            <h2>New brief</h2>
            <BriefChat instant={instant.on} instantLeft={instant.left} compact />
          </section>
          {!planOn && org.plan !== "bespoke" && (
            <section className="panel">
              <h2>Your team</h2>
              <p>
                Instant briefs are free to try. To send work to a designer and copywriter, pick a plan: from one hour a month to a full
                team with a creative lead.
              </p>
              <Link href="/app/billing" className="btn btn-small">
                See the plans
              </Link>
            </section>
          )}
          {hoursLeft !== null && hoursLeft < 2 && (
            <section className="panel">
              <h2>Hours running low</h2>
              <p>You have {hoursLeft} team hours left this month. Add 5 hours from Billing, or new briefs wait for the 1st.</p>
              <Link href="/app/billing" className="btn btn-small btn-line">
                Add hours
              </Link>
            </section>
          )}
        </aside>
      </div>
    </>
  );
}
