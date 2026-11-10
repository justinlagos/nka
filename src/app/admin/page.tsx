import Link from "next/link";
import { ProjectList, type ProjectRow } from "@/components/ProjectList";
import { requireStaff } from "@/lib/session";

const LANES: { title: string; hint: string; statuses: string[]; pick?: (r: { estimate_due: string | null }) => boolean }[] = [
  {
    title: "Needs a price",
    hint: "The designer proposed a date for a client who isn't on a paid-up plan. Add the price and send it.",
    statuses: ["submitted"],
    pick: (r) => !!r.estimate_due,
  },
  {
    title: "Needs a date",
    hint: "New briefs. The designer confirms the date; step in if it's been more than a working day.",
    statuses: ["submitted"],
    pick: (r) => !r.estimate_due,
  },
  { title: "Changes requested", hint: "The client has asked for changes.", statuses: ["changes_requested"] },
  { title: "In production", hint: "Approved and being made.", statuses: ["in_progress"] },
  { title: "With the client", hint: "Waiting for an estimate approval or a file review.", statuses: ["awaiting_approval", "in_review"] },
  { title: "Queued", hint: "Over the client's plan limit. They start automatically.", statuses: ["queued"] },
];

export default async function StudioQueue() {
  const { supabase, userId } = await requireStaff();
  const { data } = await supabase
    .from("projects")
    .select("id, number, title, status, deadline, estimate_due, updated_at, assignee, org:orgs(name)")
    .in("status", LANES.flatMap((l) => l.statuses))
    .order("updated_at", { ascending: true })
    .limit(500);
  const rows = ((data ?? []) as unknown as (ProjectRow & { assignee: string | null; org: { name: string } | null })[]).map((r) => ({
    ...r,
    org_name: r.org?.name,
  }));
  const mine = rows.filter((r) => r.assignee === userId && !["awaiting_approval", "in_review", "queued"].includes(r.status));

  return (
    <>
      <div className="app-head">
        <div>
          <h1>Studio queue</h1>
          <p className="muted">
            Oldest first within each lane. {rows.length} open projects across all clients. Designers and how they&apos;re delivering:{" "}
            <Link href="/admin/designers">Designers</Link>.
          </p>
        </div>
      </div>
      {rows.length === 0 && (
        <div className="callout">
          <p>
            No open work yet. New briefs from clients land here, oldest first. To see what a client sees, open{" "}
            <Link href="/app">the client side</Link> and create a test workspace.
          </p>
        </div>
      )}
      {mine.length > 0 && (
        <section className="panel">
          <h2>Assigned to you</h2>
          <ProjectList rows={mine} empty={null} showOrg />
        </section>
      )}
      {LANES.map((lane) => {
        const laneRows = rows.filter((r) => lane.statuses.includes(r.status) && (!lane.pick || lane.pick(r)));
        return (
          <section className="panel" key={lane.title}>
            <h2>
              {lane.title} <span className="muted">({laneRows.length})</span>
            </h2>
            <p className="small muted" style={{ marginTop: -6 }}>
              {lane.hint}
            </p>
            <ProjectList rows={laneRows} empty="Nothing here." showOrg />
          </section>
        );
      })}
    </>
  );
}
