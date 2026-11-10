import Link from "next/link";
import { requireStudio } from "@/lib/session";
import { planLabel } from "@/lib/plans";
import { date } from "@/lib/format";

// The clients Nka has given this designer.
export default async function YourClients() {
  const { supabase, userId } = await requireStudio();
  const [{ data: orgs }, { data: open }] = await Promise.all([
    supabase.from("orgs").select("id, name, plan, plan_status, lead_since").eq("lead_id", userId).order("name"),
    supabase
      .from("projects")
      .select("org_id, status")
      .in("status", ["submitted", "awaiting_approval", "in_progress", "in_review", "changes_requested", "queued"])
      .limit(2000),
  ]);
  const count = new Map<string, number>();
  for (const p of open ?? []) count.set(p.org_id, (count.get(p.org_id) ?? 0) + 1);

  return (
    <>
      <div className="app-head">
        <div>
          <h1>Your clients</h1>
          <p className="muted">You lead these accounts. New briefs from them come to you.</p>
        </div>
      </div>
      <section className="panel">
        {(orgs ?? []).length === 0 ? (
          <div className="empty">
            <strong>No clients yet.</strong>
            Nka assigns new clients to the designer with the fewest open projects.
          </div>
        ) : (
          <ul className="list">
            {(orgs ?? []).map((o) => (
              <li key={o.id}>
                <Link className="proj-row" href={`/studio/clients/${o.id}`}>
                  <span className="proj-title">{o.name}</span>
                  <span className="proj-meta">
                    {planLabel(o.plan)}
                    {o.plan_status === "paused" ? ", paused" : ""}, {count.get(o.id) ?? 0} open
                    {o.lead_since ? `, yours since ${date(o.lead_since)}` : ""}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  );
}
