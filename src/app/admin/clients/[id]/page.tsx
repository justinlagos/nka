import Link from "next/link";
import { notFound } from "next/navigation";
import { ActionForm } from "@/components/ActionForm";
import { ProjectList, type ProjectRow } from "@/components/ProjectList";
import { addLedgerEntry, expireBudget, setLead, setPlan } from "../../actions";
import { requireStaff } from "@/lib/session";
import { people, displayName } from "@/lib/data";
import { FLEX, PLANS, planLabel } from "@/lib/plans";
import { summariseBudget, type LedgerEntry } from "@/lib/budget";
import { date, dateTime, money } from "@/lib/format";

export default async function Client({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { supabase } = await requireStaff();
  const { data: org } = await supabase.from("orgs").select("*").eq("id", id).maybeSingle();
  if (!org) notFound();

  const [{ data: members }, { data: projects }, { data: ledger }, { data: book }, { data: staffRows }, { data: leadRows }] = await Promise.all([
    supabase.from("org_members").select("user_id, role").eq("org_id", id),
    supabase.from("projects").select("id, number, title, status, deadline, estimate_due, updated_at").eq("org_id", id).order("updated_at", { ascending: false }).limit(100),
    supabase.from("budget_ledger").select("id, kind, amount, effective_on, note").eq("org_id", id).order("effective_on", { ascending: false }),
    supabase.from("brand_books").select("about, updated_at").eq("org_id", id).maybeSingle(),
    supabase.from("profiles").select("id, full_name, email, alias, is_talent").or("is_staff.eq.true,is_talent.eq.true").order("full_name"),
    supabase.from("lead_changes").select("id, from_user, to_user, note, created_at").eq("org_id", id).order("created_at", { ascending: false }).limit(20),
  ]);
  const leads = leadRows ?? [];
  const who = await people(supabase, [
    ...(members ?? []).map((m) => m.user_id),
    org.lead_id,
    ...leads.flatMap((l) => [l.from_user, l.to_user]),
  ]);
  const today = new Date().toISOString().slice(0, 10);
  const budget = summariseBudget((ledger ?? []) as LedgerEntry[], org.rollover_months, today);

  return (
    <>
      <div className="app-head">
        <div>
          <p className="small muted" style={{ margin: 0 }}>
            <Link href="/admin/clients">Clients</Link>
          </p>
          <h1>{org.name}</h1>
          <p className="muted">
            {planLabel(org.plan)}, {org.plan_status.replace("_", " ")}
            {org.stripe_customer_id ? `, Stripe customer ${org.stripe_customer_id}` : ""}
          </p>
        </div>
      </div>
      <div className="grid-main">
        <div>
          <section className="panel">
            <h2>Projects</h2>
            <ProjectList rows={(projects ?? []) as ProjectRow[]} empty="No projects yet." />
          </section>
          {(org.plan === "flex" || (ledger ?? []).length > 0) && (
            <section className="panel">
              <h2>Flex budget</h2>
              <div className="stats">
                <div className="stat">
                  <b>{money(budget.balance, org.currency)}</b>
                  <span>Balance</span>
                </div>
                <div className="stat">
                  <b>{money(budget.spent, org.currency)}</b>
                  <span>Spent</span>
                </div>
                <div className="stat">
                  <b>{money(budget.paidOut, org.currency)}</b>
                  <span>Paid back</span>
                </div>
                <div className="stat">
                  <b>{money(budget.expirable, org.currency)}</b>
                  <span>Past rollover, unused</span>
                </div>
              </div>
              <div className="table-scroll">
                <table className="table">
                  <thead>
                    <tr>
                      <th>Date</th>
                      <th>Kind</th>
                      <th>Note</th>
                      <th className="num">Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(ledger ?? []).map((l) => (
                      <tr key={l.id}>
                        <td>{date(l.effective_on)}</td>
                        <td>{l.kind.replace("_", " ")}</td>
                        <td>{l.note}</td>
                        <td className="num">{money(l.amount, org.currency, 2)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          )}
        </div>
        <aside>
          <section className="panel">
            <h2>Lead designer</h2>
            <p className="small">
              {org.lead_id
                ? `${displayName(who.get(org.lead_id))}, since ${date(org.lead_since)}. New briefs go to them.`
                : "No designer yet. New clients get the least busy designer automatically; pick one here to change it."}
            </p>
            <ActionForm action={setLead} submit={org.lead_id ? "Change lead" : "Name lead"} pending="Saving" buttonClass="btn btn-small">
              <input type="hidden" name="org" value={org.id} />
              <label className="field">
                <span>Designer</span>
                <select name="lead" defaultValue={org.lead_id ?? ""} required>
                  <option value="" disabled>
                    Choose
                  </option>
                  {(staffRows ?? []).map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.full_name || s.email}
                      {s.is_talent ? (s.alias ? ` (clients see "${s.alias}")` : "") : " (admin)"}
                    </option>
                  ))}
                </select>
              </label>
              {org.lead_id && (
                <label className="field">
                  <span>Handover note for the client</span>
                  <textarea
                    name="note"
                    rows={3}
                    maxLength={2000}
                    placeholder="Why the change, and what the new designer has been told about your brand and open work."
                  />
                  <span className="hint">Required when changing. The client is emailed it and sees it on their home page. Don&apos;t name the designer.</span>
                </label>
              )}
            </ActionForm>
            {leads.length > 0 && (
              <ul className="events" style={{ marginTop: 12 }}>
                {leads.map((l) => (
                  <li key={l.id}>
                    <b>{l.from_user ? `${displayName(who.get(l.from_user))} to ` : ""}{displayName(who.get(l.to_user))}</b>
                    {l.note ? `: ${l.note}` : ""}
                    <br />
                    <span className="small">{dateTime(l.created_at)}</span>
                  </li>
                ))}
              </ul>
            )}
          </section>
          <section className="panel">
            <h2>Plan</h2>
            <ActionForm action={setPlan} submit="Save plan" pending="Saving" buttonClass="btn btn-small">
              <input type="hidden" name="org" value={org.id} />
              <label className="field">
                <span>Plan</span>
                <select name="plan" defaultValue={org.plan}>
                  <option value="none">No plan (quote per project)</option>
                  {PLANS.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} ({p.activeLimit} active)
                    </option>
                  ))}
                  <option value="flex">{FLEX.name}</option>
                  <option value="bespoke">Bespoke</option>
                </select>
              </label>
              <label className="field">
                <span>Status</span>
                <select name="status" defaultValue={org.plan_status}>
                  {["active", "trialing", "past_due", "paused", "canceled", "inactive"].map((s) => (
                    <option key={s} value={s}>
                      {s.replace("_", " ")}
                    </option>
                  ))}
                </select>
              </label>
              <div className="row-2">
                <label className="field">
                  <span>Active limit</span>
                  <input type="number" name="limit" min={1} defaultValue={org.active_limit ?? ""} placeholder="Plan default" />
                </label>
                <label className="field">
                  <span>Rollover months</span>
                  <input type="number" name="rollover" min={0} max={12} defaultValue={org.rollover_months} />
                </label>
              </div>
              <label className="field">
                <span>Currency</span>
                <select name="currency" defaultValue={org.currency}>
                  <option value="gbp">GBP</option>
                  <option value="usd">USD</option>
                  <option value="eur">EUR</option>
                  <option value="ngn">NGN</option>
                </select>
              </label>
              <p className="hint">Card plans are kept in step by Stripe; edits here are for Flex, bespoke and corrections.</p>
            </ActionForm>
          </section>
          <section className="panel">
            <h2>Budget entry</h2>
            <ActionForm action={addLedgerEntry} submit="Record" pending="Saving" buttonClass="btn btn-small" resetOnSuccess>
              <input type="hidden" name="org" value={org.id} />
              <div className="row-2">
                <label className="field">
                  <span>Kind</span>
                  <select name="kind" defaultValue="allocation">
                    <option value="allocation">Monthly budget</option>
                    <option value="top_up">Top-up</option>
                    <option value="refund">Refund</option>
                    <option value="spend">Spend</option>
                    <option value="adjustment">Adjustment (+/-)</option>
                    <option value="payout">Paid back to client</option>
                  </select>
                </label>
                <label className="field">
                  <span>Amount</span>
                  <input type="number" name="amount" step="0.01" required />
                </label>
              </div>
              <div className="row-2">
                <label className="field">
                  <span>Effective</span>
                  <input type="date" name="effective" defaultValue={today} />
                </label>
                <label className="field">
                  <span>Note</span>
                  <input type="text" name="note" maxLength={500} placeholder="December budget" />
                </label>
              </div>
            </ActionForm>
            <p className="hint">
              When a Flex client leaves, refund their balance in Stripe, then record the same amount here as Paid back.
            </p>
            <div style={{ marginTop: 12 }}>
              <ActionForm action={expireBudget} submit="Expire unused budget past rollover" pending="Checking" buttonClass="btn btn-small btn-line">
                <input type="hidden" name="org" value={org.id} />
              </ActionForm>
            </div>
          </section>
          <section className="panel">
            <h2>People</h2>
            <ul className="list">
              {(members ?? []).map((m) => (
                <li key={m.user_id} style={{ padding: "6px 0" }}>
                  {displayName(who.get(m.user_id))} <span className="muted small">{m.role}, {who.get(m.user_id)?.email}</span>
                </li>
              ))}
            </ul>
          </section>
          <section className="panel">
            <h2>Brand book</h2>
            <p className="small">{book?.about || "Not filled in yet."}</p>
          </section>
        </aside>
      </div>
    </>
  );
}
