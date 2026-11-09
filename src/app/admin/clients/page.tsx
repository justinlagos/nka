import Link from "next/link";
import { requireStaff } from "@/lib/session";
import { planLabel } from "@/lib/plans";
import { date } from "@/lib/format";

export default async function Clients() {
  const { supabase } = await requireStaff();
  const [{ data: orgs }, { data: projects }] = await Promise.all([
    supabase.from("orgs").select("id, name, country, plan, plan_status, active_limit, created_at").order("created_at", { ascending: false }),
    supabase.from("projects").select("org_id, status").not("status", "in", "(draft,completed,cancelled)"),
  ]);
  const open = new Map<string, number>();
  for (const p of projects ?? []) open.set(p.org_id, (open.get(p.org_id) ?? 0) + 1);

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
                    <span className="small muted">{o.country}</span>
                  </td>
                  <td>{planLabel(o.plan)}</td>
                  <td>{o.plan_status.replace("_", " ")}</td>
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
