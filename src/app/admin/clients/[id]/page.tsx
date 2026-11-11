import Link from "next/link";
import { notFound } from "next/navigation";
import { ActionForm } from "@/components/ActionForm";
import { ProjectList, type ProjectRow } from "@/components/ProjectList";
import { adjustHours, setInternal, setLead, setPlan, setTeam } from "../../actions";
import { requireStaff } from "@/lib/session";
import { people, displayName , studioPeople } from "@/lib/data";
import { PLANS, planById, planLabel } from "@/lib/plans";
import { date, dateTime } from "@/lib/format";

const TEAM_ROLES = [
  { role: "copywriter", label: "Copywriter" },
  { role: "creative_lead", label: "Creative lead (reviews every version)" },
  { role: "marketing_lead", label: "Marketing lead (Studio)" },
  { role: "motion", label: "Motion (Studio)" },
];

export default async function Client({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { supabase } = await requireStaff();
  const { data: org } = await supabase.from("orgs").select("*").eq("id", id).maybeSingle();
  if (!org) notFound();

  const [{ data: members }, { data: projects }, { data: ledger }, { data: book }, { data: staffRows }, { data: leadRows }, { data: teamRows }, { data: bal }] = await Promise.all([
    supabase.from("org_members").select("user_id, role").eq("org_id", id),
    supabase.from("projects").select("id, number, title, status, deadline, estimate_due, updated_at").eq("org_id", id).order("updated_at", { ascending: false }).limit(100),
    supabase.from("hours_ledger").select("id, kind, hours, note, created_at").eq("org_id", id).order("created_at", { ascending: false }).limit(60),
    supabase.from("brand_books").select("about, updated_at").eq("org_id", id).maybeSingle(),
    studioPeople(supabase),
    supabase.from("lead_changes").select("id, from_user, to_user, note, created_at").eq("org_id", id).order("created_at", { ascending: false }).limit(20),
    supabase.from("org_team").select("role, user_id").eq("org_id", id),
    supabase.rpc("hours_balance", { p_org: id }),
  ]);
  const team = new Map((teamRows ?? []).map((t) => [t.role as string, t.user_id as string]));
  const balance = bal as { allowance: number; carried: number; granted: number; used: number; left: number; top_ups: number } | null;
  const plan = planById(org.plan);
  const leads = leadRows ?? [];
  const who = await people(supabase, [
    ...(members ?? []).map((m) => m.user_id),
    org.lead_id,
    ...leads.flatMap((l) => [l.from_user, l.to_user]),
    ...[...team.values()],
  ]);

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
            <ProjectList rows={(projects ?? []) as ProjectRow[]} empty="No projects yet." base="/admin/projects" />
          </section>
          {(plan || (ledger ?? []).length > 0) && (
            <section className="panel">
              <h2>Team hours</h2>
              {balance && (
                <div className="stats">
                  <div className="stat">
                    <b>{Number(balance.left)}</b>
                    <span>Left this month</span>
                  </div>
                  <div className="stat">
                    <b>{Number(balance.used)}</b>
                    <span>Used</span>
                  </div>
                  <div className="stat">
                    <b>{Number(balance.allowance)}</b>
                    <span>Plan hours</span>
                  </div>
                  <div className="stat">
                    <b>{Number(balance.carried)}</b>
                    <span>Carried over</span>
                  </div>
                </div>
              )}
              <div className="table-scroll">
                <table className="table">
                  <thead>
                    <tr>
                      <th>Date</th>
                      <th>Kind</th>
                      <th>Note</th>
                      <th className="num">Hours</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(ledger ?? []).map((l) => (
                      <tr key={l.id}>
                        <td>{date(l.created_at)}</td>
                        <td>{String(l.kind).replace("_", " ")}</td>
                        <td>{l.note}</td>
                        <td className="num">{Number(l.hours) > 0 ? `+${Number(l.hours)}` : Number(l.hours)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <ActionForm action={adjustHours} submit="Adjust hours" pending="Saving" buttonClass="btn btn-small btn-line" resetOnSuccess>
                <input type="hidden" name="org" value={org.id} />
                <div className="row-2">
                  <label className="field">
                    <span>Hours (+ or -)</span>
                    <input type="number" name="hours" step="0.5" required />
                  </label>
                  <label className="field">
                    <span>Why</span>
                    <input type="text" name="note" maxLength={500} required placeholder="Goodwill for a slow week" />
                  </label>
                </div>
              </ActionForm>
            </section>
          )}
        </div>
        <aside>
          <section className="panel">
            <h2>Lead</h2>
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
                  {(staffRows ?? []).filter((s) => !s.is_talent || ["designer", "copywriter"].includes(s.talent_role)).map((s) => (
                    <option key={s.id} value={s.id} disabled={s.is_talent && s.vetting !== "passed" && !org.internal}>
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
            <h2>Team</h2>
            <p className="small muted">
              The lead above is the designer (or the copywriter on a copy-only Instant plan). Only people who passed the Nka test task
              can be chosen, unless this is an internal test workspace. The creative lead must come from a different agency to the
              makers they review.
            </p>
            {TEAM_ROLES.map((t) => (
              <ActionForm key={t.role} action={setTeam} submit="Save" pending="Saving" buttonClass="btn btn-small btn-line">
                <input type="hidden" name="org" value={org.id} />
                <input type="hidden" name="role" value={t.role} />
                <label className="field">
                  <span>{t.label}</span>
                  <select name="user" defaultValue={team.get(t.role) ?? ""}>
                    <option value="">Nobody</option>
                    {(staffRows ?? [])
                      .filter((p) => p.is_talent && p.talent_role === t.role)
                      .map((p) => (
                        <option key={p.id} value={p.id} disabled={p.vetting !== "passed" && !org.internal}>
                          {p.full_name || p.email}
                          {p.alias ? ` ("${p.alias}")` : ""}
                          {p.vetting !== "passed" ? " (test task not passed)" : ""}
                        </option>
                      ))}
                  </select>
                </label>
              </ActionForm>
            ))}
            <ActionForm action={setInternal} submit="Save" pending="Saving" buttonClass="btn btn-small btn-line">
              <input type="hidden" name="org" value={org.id} />
              <label className="check">
                <input type="checkbox" name="internal" defaultChecked={Boolean(org.internal)} /> Internal test workspace (for test tasks)
              </label>
            </ActionForm>
          </section>
          <section className="panel">
            <h2>Plan</h2>
            <ActionForm action={setPlan} submit="Save plan" pending="Saving" buttonClass="btn btn-small">
              <input type="hidden" name="org" value={org.id} />
              <label className="field">
                <span>Plan</span>
                <select name="plan" defaultValue={org.plan}>
                  <option value="none">No plan (Instant trial only)</option>
                  {PLANS.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} ({p.activeLimit} active)
                    </option>
                  ))}
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
              <label className="field">
                <span>Active limit</span>
                <input type="number" name="limit" min={1} defaultValue={org.active_limit ?? ""} placeholder="Plan default" />
              </label>
              <label className="field">
                <span>Currency</span>
                <select name="currency" defaultValue={org.currency}>
                  <option value="gbp">GBP</option>
                  <option value="usd">USD</option>
                  <option value="ngn">NGN</option>
                </select>
              </label>
              <p className="hint">Card plans are kept in step by Stripe; edits here are for Bespoke and corrections.</p>
            </ActionForm>
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
