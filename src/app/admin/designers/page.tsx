import Link from "next/link";
import { ActionForm } from "@/components/ActionForm";
import { addDesigner, savePartner, updateDesigner } from "@/app/admin/actions";
import { requireStaff } from "@/lib/session";
import { onTimeRecord, ukDate } from "@/lib/ontime";
import { date, dateTime, projectRef } from "@/lib/format";

// Admin only. Who provides the designers (partners), who the designers are, how each one is
// delivering, and a log of their work. Clients never see any of this.

type Partner = { id: string; name: string; contact_name: string; contact_email: string; share_percent: number | null; agreement: string; active: boolean };
type Designer = { id: string; email: string; full_name: string; alias: string; partner_id: string | null; talent_active: boolean; created_at: string };

const OPEN = ["submitted", "awaiting_approval", "in_progress", "in_review", "changes_requested"];
const EVENT: Record<string, string> = {
  estimate_sent: "confirmed a date",
  estimate_proposed: "proposed a date",
  deliverable_added: "uploaded a file",
  status: "changed the stage",
};

export default async function Designers() {
  const { supabase } = await requireStaff();
  const [{ data: partners }, { data: designers }, { data: pending }, { data: projects }, { data: files }, { data: orgs }, { data: events }] =
    await Promise.all([
      supabase.from("partners").select("*").order("name"),
      supabase.from("profiles").select("id, email, full_name, alias, partner_id, talent_active, created_at").eq("is_talent", true).order("created_at"),
      supabase.from("talent_emails").select("email, alias, partner_id, created_at").order("created_at"),
      supabase.from("projects").select("id, number, title, status, estimate_due, assignee, org:orgs(name)").not("assignee", "is", null).limit(5000),
      supabase.from("deliverables").select("project_id, created_at").order("created_at").limit(10000),
      supabase.from("orgs").select("id, name, lead_id"),
      supabase
        .from("project_events")
        .select("id, project_id, actor, kind, detail, created_at")
        .in("kind", Object.keys(EVENT))
        .order("created_at", { ascending: false })
        .limit(60),
    ]);
  const ps = (partners ?? []) as Partner[];
  const ds = (designers ?? []) as Designer[];
  const partnerName = new Map(ps.map((p) => [p.id, p.name]));
  const signedUp = new Set(ds.map((d) => d.email));
  const invited = (pending ?? []).filter((t) => !signedUp.has(t.email));
  const today = ukDate(new Date());
  const firstFile = new Map<string, string>();
  for (const f of files ?? []) if (!firstFile.has(f.project_id)) firstFile.set(f.project_id, ukDate(f.created_at));
  type P = { id: string; number: number; title: string; status: string; estimate_due: string | null; assignee: string; org: { name: string } | null };
  const prj = (projects ?? []) as unknown as P[];
  const byId = new Map(prj.map((p) => [p.id, p]));
  const designerIds = new Set(ds.map((d) => d.id));
  const stats = (id: string) => {
    const mine = prj.filter((p) => p.assignee === id);
    const open = mine.filter((p) => OPEN.includes(p.status));
    const late = open.filter((p) => ["submitted", "in_progress", "changes_requested"].includes(p.status) && p.estimate_due && p.estimate_due < today);
    const rec = onTimeRecord(mine.map((p) => ({ due: p.estimate_due, firstDelivered: firstFile.get(p.id) ?? null })));
    return { clients: (orgs ?? []).filter((o) => o.lead_id === id).length, open: open.length, late: late.length, rec };
  };
  const unassigned = (orgs ?? []).filter((o) => !o.lead_id);
  const log = (events ?? []).filter((e) => e.actor && designerIds.has(e.actor));
  const nameOf = new Map(ds.map((d) => [d.id, d.full_name || d.email]));

  return (
    <>
      <div className="app-head">
        <div>
          <h1>Designers</h1>
          <p className="muted">
            Designers see only the clients they lead. Clients see a designer&apos;s alias, never their name, partner or contact details.
          </p>
        </div>
      </div>

      {unassigned.length > 0 && (
        <div className="callout">
          <p>
            No designer:{" "}
            {unassigned.map((o, i) => (
              <span key={o.id}>
                {i > 0 ? ", " : ""}
                <Link href={`/admin/clients/${o.id}`}>{o.name}</Link>
              </span>
            ))}
            . New clients get the least busy designer; these were made before any designer was active.
          </p>
        </div>
      )}

      <section className="panel">
        <h2>How each designer is delivering</h2>
        {ds.length === 0 ? (
          <div className="empty">
            <strong>No designers yet.</strong>
            Add one below. Until then, new clients are led by you.
          </div>
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>Designer</th>
                <th>Clients see</th>
                <th>Partner</th>
                <th>Clients</th>
                <th>Open</th>
                <th>Late</th>
                <th>First drafts on time</th>
              </tr>
            </thead>
            <tbody>
              {ds.map((d) => {
                const s = stats(d.id);
                return (
                  <tr key={d.id} className={d.talent_active ? "" : "muted"}>
                    <td>
                      {d.full_name || d.email}
                      <br />
                      <span className="small muted">{d.email}</span>
                      {!d.talent_active && <span className="small"> (paused: gets no new clients)</span>}
                    </td>
                    <td>{d.alias || "Your designer"}</td>
                    <td>{d.partner_id ? partnerName.get(d.partner_id) : "Direct"}</td>
                    <td>{s.clients}</td>
                    <td>{s.open}</td>
                    <td className={s.late ? "is-late" : ""}>{s.late}</td>
                    <td>{s.rec.total ? `${s.rec.onTime} of ${s.rec.total}` : "None yet"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
        {invited.length > 0 && (
          <p className="small muted" style={{ marginTop: 12 }}>
            Added, not signed in yet: {invited.map((t) => t.email).join(", ")}
          </p>
        )}
      </section>

      <div className="grid-2">
        <section className="panel">
          <h2>Add a designer</h2>
          <ActionForm action={addDesigner} submit="Add designer" pending="Adding" buttonClass="btn btn-small" resetOnSuccess>
            <label className="field">
              <span>Their email</span>
              <input type="email" name="email" required placeholder="designer@partner.com" />
              <span className="hint">They sign in with it. Clients never see it.</span>
            </label>
            <label className="field">
              <span>Name clients see</span>
              <input type="text" name="alias" maxLength={60} placeholder="For example a first name, or leave empty" />
              <span className="hint">Empty shows &ldquo;Your designer&rdquo;.</span>
            </label>
            <label className="field">
              <span>Provided by</span>
              <select name="partner" defaultValue="">
                <option value="">Direct (no partner)</option>
                {ps.filter((p) => p.active).map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </label>
          </ActionForm>
        </section>

        <section className="panel">
          <h2>Add a partner</h2>
          <p className="small muted">An agency or creative group that provides designers under an agreement with Nka.</p>
          <ActionForm action={savePartner} submit="Add partner" pending="Saving" buttonClass="btn btn-small" resetOnSuccess>
            <label className="field">
              <span>Name</span>
              <input type="text" name="name" required maxLength={200} />
            </label>
            <div className="row-2">
              <label className="field">
                <span>Contact name</span>
                <input type="text" name="contact_name" maxLength={200} />
              </label>
              <label className="field">
                <span>Contact email</span>
                <input type="email" name="contact_email" maxLength={200} />
              </label>
            </div>
            <label className="field">
              <span>Partner&apos;s share (%)</span>
              <input type="number" name="share" min={0} max={100} step="0.5" />
            </label>
            <label className="field">
              <span>Agreement</span>
              <textarea name="agreement" rows={3} maxLength={5000} placeholder="Service terms, how work is paid, notice, anything agreed" />
            </label>
          </ActionForm>
        </section>
      </div>

      {ds.length > 0 && (
        <section className="panel">
          <h2>Edit designers</h2>
          {ds.map((d) => (
            <details key={d.id} style={{ marginBottom: 10 }}>
              <summary className="label" style={{ cursor: "pointer" }}>
                {d.full_name || d.email}
              </summary>
              <ActionForm action={updateDesigner} submit="Save" pending="Saving" buttonClass="btn btn-small btn-line">
                <input type="hidden" name="id" value={d.id} />
                <div className="row-2">
                  <label className="field">
                    <span>Name clients see</span>
                    <input type="text" name="alias" defaultValue={d.alias} maxLength={60} />
                  </label>
                  <label className="field">
                    <span>Provided by</span>
                    <select name="partner" defaultValue={d.partner_id ?? ""}>
                      <option value="">Direct (no partner)</option>
                      {ps.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
                <label className="check">
                  <input type="checkbox" name="active" defaultChecked={d.talent_active} /> Taking new clients
                </label>
              </ActionForm>
            </details>
          ))}
        </section>
      )}

      {ps.length > 0 && (
        <section className="panel">
          <h2>Partners</h2>
          {ps.map((p) => {
            const theirs = ds.filter((d) => d.partner_id === p.id);
            return (
              <details key={p.id} style={{ marginBottom: 10 }}>
                <summary className="label" style={{ cursor: "pointer" }}>
                  {p.name}
                  {p.active ? "" : " (inactive)"}: {theirs.length} designer{theirs.length === 1 ? "" : "s"}
                  {p.share_percent !== null ? `, ${p.share_percent}% share` : ""}
                </summary>
                <ActionForm action={savePartner} submit="Save partner" pending="Saving" buttonClass="btn btn-small btn-line">
                  <input type="hidden" name="id" value={p.id} />
                  <label className="field">
                    <span>Name</span>
                    <input type="text" name="name" defaultValue={p.name} required maxLength={200} />
                  </label>
                  <div className="row-2">
                    <label className="field">
                      <span>Contact name</span>
                      <input type="text" name="contact_name" defaultValue={p.contact_name} maxLength={200} />
                    </label>
                    <label className="field">
                      <span>Contact email</span>
                      <input type="email" name="contact_email" defaultValue={p.contact_email} maxLength={200} />
                    </label>
                  </div>
                  <label className="field">
                    <span>Partner&apos;s share (%)</span>
                    <input type="number" name="share" min={0} max={100} step="0.5" defaultValue={p.share_percent ?? undefined} />
                  </label>
                  <label className="field">
                    <span>Agreement</span>
                    <textarea name="agreement" rows={4} defaultValue={p.agreement} maxLength={5000} />
                  </label>
                  <label className="check">
                    <input type="checkbox" name="active" defaultChecked={p.active} /> Active
                  </label>
                </ActionForm>
              </details>
            );
          })}
        </section>
      )}

      <section className="panel">
        <h2>Work log</h2>
        <p className="small muted" style={{ marginTop: -6 }}>
          What designers did, newest first. The record to settle with partners from.
        </p>
        {log.length === 0 ? (
          <p className="muted">Nothing yet.</p>
        ) : (
          <ul className="events">
            {log.map((e) => {
              const p = byId.get(e.project_id);
              const d = e.detail as { due?: string; title?: string; version?: number };
              return (
                <li key={e.id}>
                  <b>{nameOf.get(e.actor!)}</b> {EVENT[e.kind]}
                  {e.kind === "deliverable_added" && d.title ? ` (${d.title} v${d.version})` : ""}
                  {d.due && e.kind !== "deliverable_added" ? `, due ${date(d.due)}` : ""} on{" "}
                  <Link href={`/app/projects/${e.project_id}`}>{p ? `${projectRef(p.number)} ${p.title}` : "a project"}</Link>
                  {p?.org?.name ? ` for ${p.org.name}` : ""}
                  <br />
                  <span className="small">{dateTime(e.created_at)}</span>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </>
  );
}
