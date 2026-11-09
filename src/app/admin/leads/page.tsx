import { setLeadStatus } from "../actions";
import { requireStaff } from "@/lib/session";
import { dateTime } from "@/lib/format";

export default async function Leads() {
  const { supabase } = await requireStaff();
  const { data } = await supabase.from("leads").select("*").order("created_at", { ascending: false }).limit(300);
  const leads = data ?? [];
  return (
    <>
      <div className="app-head">
        <div>
          <h1>Call requests</h1>
          <p className="muted">From Book a demo. Each one already has a workspace with their first brief drafted. Call them, then mark them here.</p>
        </div>
      </div>
      {leads.length === 0 ? (
        <div className="panel empty">
          <strong>No requests yet.</strong>
          They arrive from /demo.
        </div>
      ) : (
        leads.map((l) => (
          <section className="panel" key={l.id}>
            <div className="inline-actions" style={{ justifyContent: "space-between" }}>
              <div>
                <h2 style={{ marginBottom: 4 }}>
                  {l.name}
                  {l.company ? `, ${l.company}` : ""}
                </h2>
                <p className="small muted" style={{ margin: 0 }}>
                  <a href={`mailto:${l.email}`}>{l.email}</a>, {dateTime(l.created_at)}
                </p>
              </div>
              <form action={setLeadStatus} className="inline-actions">
                <input type="hidden" name="id" value={l.id} />
                <label className="skip" htmlFor={`s-${l.id}`}>
                  Status
                </label>
                <select id={`s-${l.id}`} name="status" defaultValue={l.status} style={{ width: "auto" }}>
                  <option value="new">New</option>
                  <option value="contacted">Contacted</option>
                  <option value="won">Won</option>
                  <option value="lost">Lost</option>
                </select>
                <button className="btn btn-small btn-line" type="submit">
                  Save
                </button>
              </form>
            </div>
            <dl className="kv" style={{ marginTop: 12 }}>
              <dt>Interested in</dt>
              <dd>{l.interest || "Not said"}</dd>
              <dt>Budget</dt>
              <dd>{l.budget || "Not said"}</dd>
              <dt>Team size</dt>
              <dd>{l.company_size || "Not said"}</dd>
              <dt>Country</dt>
              <dd>{l.country || "Not said"}</dd>
            </dl>
            {l.message && <p style={{ whiteSpace: "pre-wrap", marginTop: 12 }}>{l.message}</p>}
          </section>
        ))
      )}
    </>
  );
}
