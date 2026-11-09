import Link from "next/link";
import { ActionForm } from "@/components/ActionForm";
import { ProjectList, type ProjectRow } from "@/components/ProjectList";
import { startBrief } from "./actions";
import { requireMembership } from "@/lib/session";
import { ACTIVE } from "@/lib/status";
import { planLabel } from "@/lib/plans";
import { summariseBudget, type LedgerEntry } from "@/lib/budget";
import { date, money } from "@/lib/format";
import { people, displayName } from "@/lib/data";
import { onTimeRecord, ukDate } from "@/lib/ontime";

export default async function WorkspaceHome() {
  const { supabase, org, profile } = await requireMembership();
  const today = new Date().toISOString().slice(0, 10);
  const monthStart = today.slice(0, 8) + "01";

  const [{ data: projects }, { data: ledger }, { data: leadRow }, { data: handovers }, { data: firstFiles }] = await Promise.all([
    supabase
      .from("projects")
      .select("id, number, title, status, deadline, estimate_due, updated_at, completed_at")
      .eq("org_id", org.id)
      .order("updated_at", { ascending: false })
      .limit(200),
    org.plan === "flex"
      ? supabase.from("budget_ledger").select("kind, amount, effective_on").eq("org_id", org.id)
      : Promise.resolve({ data: [] as LedgerEntry[] }),
    supabase.from("orgs").select("lead_id, lead_since").eq("id", org.id).maybeSingle(),
    supabase.from("lead_changes").select("from_user, note, created_at").eq("org_id", org.id).order("created_at", { ascending: false }).limit(1),
    supabase.from("deliverables").select("project_id, created_at").eq("org_id", org.id).order("created_at").limit(2000),
  ]);

  const rows = (projects ?? []) as (ProjectRow & { completed_at: string | null })[];
  const active = rows.filter((p) => (ACTIVE as string[]).includes(p.status));
  const waiting = rows.filter((p) => p.status === "awaiting_approval" || p.status === "in_review");
  const queued = rows.filter((p) => p.status === "queued");
  const doneThisMonth = rows.filter((p) => p.status === "completed" && (p.completed_at ?? "") >= monthStart);
  const budget = org.plan === "flex" ? summariseBudget((ledger ?? []) as LedgerEntry[], org.rollover_months, today) : null;
  const firstName = profile.full_name.split(" ")[0];

  const leadId = (leadRow?.lead_id as string | null) ?? null;
  const lastHandover = (handovers ?? [])[0];
  const who = await people(supabase, [leadId]);
  const lead = leadId ? who.get(leadId) : undefined;

  const firstDelivery = new Map<string, string>();
  for (const f of firstFiles ?? []) if (!firstDelivery.has(f.project_id)) firstDelivery.set(f.project_id, ukDate(f.created_at));
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
            In progress{org.active_limit && ["starter", "growth", "studio"].includes(org.plan) ? ` (plan allows ${org.active_limit})` : ""}
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
        {budget && (
          <div className="stat">
            <b>{money(budget.balance, org.currency)}</b>
            <span>Flex budget left</span>
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
              <p className="small muted">The studio names one designer for your account before your first brief starts. You&apos;ll see them here.</p>
            )}
          </section>
          <section className="panel composer">
            <h2>Quick brief</h2>
            <ActionForm action={startBrief} submit="Draft my brief" pending="Drafting">
              <input type="hidden" name="intent" value="draft" />
              <label className="field">
                <span className="skip">What do you need?</span>
                <textarea name="request" rows={5} required placeholder="A 10-slide deck for our investor update on 3 December…" />
              </label>
            </ActionForm>
            <p className="small muted" style={{ marginTop: 10 }}>
              You&apos;ll check and edit the draft before anything is sent.
            </p>
          </section>
          {budget && budget.expiringSoon > 0 && (
            <section className="panel">
              <h2>Unused budget</h2>
              <p>
                {money(budget.expiringSoon, org.currency)} reaches the end of its carry-over on {date(budget.nextExpiry)}. Use it, or
                ask us to pay it back. Either is fine.
              </p>
            </section>
          )}
        </aside>
      </div>
    </>
  );
}
