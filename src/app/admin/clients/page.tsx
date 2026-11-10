import Link from "next/link";
import { requireStaff } from "@/lib/session";
import { planLabel } from "@/lib/plans";
import { date } from "@/lib/format";

export default async function Clients() {
  const { supabase } = await requireStaff();
  const [{ data: orgs }, { data: projects }, { data: members }, { data: studio }] = await Promise.all([
    supabase
      .from("orgs")
      .select("id, name, country, plan, plan_status, active_limit, created_at, lead_id")
      .order("created_at", { ascending: false }),
    supabase.from("projects").select("org_id, status").not("status", "in", "(draft,completed,cancelled)"),
    supabase.from("org_members").select("org_id"),
    supabase.from("profiles").select("*").or("is_staff.eq.true,is_talent.eq.true"),
  ]);
  const open = new Map<string, number>();
  for (const p of projects ?? []) open.set(p.org_id, (open.get(p.org_id) ?? 0) + 1);
  const people = new Map<string, number>();
  for (const m of members ?? []) people.set(m.org_id, (people.get(m.org_id) ?? 0) + 1);
  // Who leads each client: their real name for you, and the name the client sees.
  const lead = new Map<string, { name: string; seen: string }>();
  for (const r of (studio ?? []) as { id: string; email: string; full_name: string; is_staff: boolean; alias?: string }[]) {
    lead.set(r.id, {
      name: r.full_name || r.email,
      seen: r.is_staff ? "Nka Studio" : r.alias || "Your designer",
    });
  }

  return (
    <>
      <div className="app-head">
        <div>
          <h1>Clients</h1>
          <p className="muted">Every organisation with a workspace. Set Flex and bespoke plans here; card plans update themselves from Stripe.</p>
        </div>
      </div>
      <section className="panel">
        <div className="table-scroll">
          <table className="table">
            <thead>
              <tr>
                <th>Organisation</th>
                <th>Plan</th>
                <th>Status</th>
                <th>Lead designer</th>
                <th className="num">Open projects</th>
                <th>Joined</th>
              </tr>
            </thead>
            <tbody>
              {(orgs ?? []).map((o) => (
                <tr key={o.id}>
                  <td>
                    <Link href={`/admin/clients/${o.id}`}>{o.name}</Link>
                    <br />
                    <span className="small muted">
                      {[o.country, people.get(o.id) ? null : "no one on the team"].filter(Boolean).join(", ")}
                    </span>
                  </td>
                  <td>{planLabel(o.plan)}</td>
                  <td>{o.plan_status.replace("_", " ")}</td>
                  <td className={o.lead_id ? "" : "is-late"}>
                    {o.lead_id && lead.get(o.lead_id) ? (
                      <>
                        {lead.get(o.lead_id)!.name}
                        <br />
                        <span className="small muted">Client sees {lead.get(o.lead_id)!.seen}</span>
                      </>
                    ) : (
                      "No designer"
                    )}
                  </td>
                  <td className="num">{open.get(o.id) ?? 0}</td>
                  <td>{date(o.created_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {(orgs ?? []).length === 0 && <div className="empty">No clients yet. They appear here when they create a workspace.</div>}
      </section>
    </>
  );
}
