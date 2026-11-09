import Link from "next/link";
import { ActionForm } from "@/components/ActionForm";
import { ProjectList, type ProjectRow } from "@/components/ProjectList";
import { startBrief } from "./actions";
import { requireMembership } from "@/lib/session";
import { ACTIVE } from "@/lib/status";
import { planLabel } from "@/lib/plans";
import { summariseBudget, type LedgerEntry } from "@/lib/budget";
import { money } from "@/lib/format";

export default async function WorkspaceHome() {
  const { supabase, org, profile } = await requireMembership();
  const today = new Date().toISOString().slice(0, 10);
  const monthStart = today.slice(0, 8) + "01";

  const [{ data: projects }, { data: ledger }] = await Promise.all([
    supabase
      .from("projects")
      .select("id, number, title, status, deadline, estimate_due, updated_at, completed_at")
      .eq("org_id", org.id)
      .order("updated_at", { ascending: false })
      .limit(200),
    org.plan === "flex"
      ? supabase.from("budget_ledger").select("kind, amount, effective_on").eq("org_id", org.id)
      : Promise.resolve({ data: [] as LedgerEntry[] }),
  ]);

  const rows = (projects ?? []) as (ProjectRow & { completed_at: string | null })[];
  const active = rows.filter((p) => (ACTIVE as string[]).includes(p.status));
  const waiting = rows.filter((p) => p.status === "awaiting_approval" || p.status === "in_review");
  const queued = rows.filter((p) => p.status === "queued");
  const doneThisMonth = rows.filter((p) => p.status === "completed" && (p.completed_at ?? "") >= monthStart);
  const budget = org.plan === "flex" ? summariseBudget((ledger ?? []) as LedgerEntry[], org.rollover_months, today) : null;
  const firstName = profile.full_name.split(" ")[0];

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
              <h2>Budget expiring soon</h2>
              <p>
                {money(budget.expiringSoon, org.currency)} of unused budget expires by {budget.nextExpiry}. Send a brief to use
                it.
              </p>
            </section>
          )}
        </aside>
      </div>
    </>
  );
}
