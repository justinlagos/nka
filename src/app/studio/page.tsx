import Link from "next/link";
import { ProjectList, type ProjectRow } from "@/components/ProjectList";
import { requireStudio } from "@/lib/session";
import { onTimeRecord, ukDate } from "@/lib/ontime";

// What the designer works from every day: their own projects, by what they need to do next.
const LANES: { title: string; hint: string; pick: (r: Row) => boolean }[] = [
  {
    title: "Needs a date",
    hint: "New briefs. Read the brief and brand book, ask the client anything in the project, then confirm the date.",
    pick: (r) => r.status === "submitted" && !r.estimate_due,
  },
  { title: "Changes asked", hint: "The client has asked for changes. Their notes are on the file.", pick: (r) => r.status === "changes_requested" },
  { title: "In production", hint: "Upload a file for review when the draft is ready. Soonest first.", pick: (r) => r.status === "in_progress" },
  {
    title: "With Nka for a price",
    hint: "You proposed a date. The Nka admin is pricing it for the client.",
    pick: (r) => r.status === "submitted" && !!r.estimate_due,
  },
  { title: "With the client", hint: "Waiting for the client to approve an estimate or review a file.", pick: (r) => ["awaiting_approval", "in_review"].includes(r.status) },
  { title: "Queued", hint: "Over the client's plan limit. They start by themselves when a slot frees up.", pick: (r) => r.status === "queued" },
];

type Row = ProjectRow & { assignee: string | null; org: { name: string; lead_id: string | null } | null };

export default async function YourWork() {
  const { supabase, userId, profile } = await requireStudio();
  const [{ data }, { data: done }, { data: files }] = await Promise.all([
    supabase
      .from("projects")
      .select("id, number, title, status, deadline, estimate_due, estimate_sent_at, updated_at, assignee, org:orgs(name, lead_id)")
      .in("status", ["submitted", "awaiting_approval", "in_progress", "in_review", "changes_requested", "queued"])
      .order("estimate_due", { ascending: true, nullsFirst: true })
      .limit(500),
    supabase.from("projects").select("id, estimate_due").eq("assignee", userId).not("estimate_due", "is", null).limit(1000),
    supabase.from("deliverables").select("project_id, created_at, uploaded_by").eq("uploaded_by", userId).order("created_at").limit(5000),
  ]);
  // Row-level security already limits this to the designer's clients; the admin sees everything, so filter to "mine".
  const rows = ((data ?? []) as unknown as Row[])
    .filter((r) => r.assignee === userId || (!r.assignee && r.org?.lead_id === userId))
    .map((r) => ({ ...r, org_name: r.org?.name }));
  const today = ukDate(new Date());
  const late = rows.filter((r) => ["submitted", "in_progress", "changes_requested"].includes(r.status) && r.estimate_due && r.estimate_due < today);
  const first = new Map<string, string>();
  for (const f of files ?? []) if (!first.has(f.project_id)) first.set(f.project_id, ukDate(f.created_at));
  const record = onTimeRecord((done ?? []).map((p) => ({ due: p.estimate_due, firstDelivered: first.get(p.id) ?? null })));

  return (
    <>
      <div className="app-head">
        <div>
          <h1>Your work</h1>
          <p className="muted">
            {profile.alias ? `Clients see you as ${profile.alias}. ` : ""}Your clients never see your name, email or number, and you
            don&apos;t see theirs. Keep every conversation in the project.
          </p>
        </div>
      </div>

      <div className="stats">
        <div className="stat">
          <b>{rows.filter((r) => !["queued"].includes(r.status)).length}</b>
          <span>Open projects</span>
        </div>
        <div className="stat">
          <b>{rows.filter((r) => r.status === "submitted" && !r.estimate_due).length + rows.filter((r) => r.status === "changes_requested").length}</b>
          <span>Waiting on you</span>
        </div>
        <div className="stat">
          <b className={late.length ? "is-late" : ""}>{late.length}</b>
          <span>Late</span>
        </div>
        {record.total > 0 && (
          <div className="stat">
            <b>
              {record.onTime} of {record.total}
            </b>
            <span>First drafts on time</span>
          </div>
        )}
      </div>

      {rows.length === 0 && (
        <div className="callout">
          <p>
            Nothing assigned to you yet. When Nka gives you a client, their briefs land here and you get an email.{" "}
            <Link href="/studio/clients">Your clients</Link>
          </p>
        </div>
      )}
      {LANES.map((lane) => {
        const laneRows = rows.filter(lane.pick);
        if (!laneRows.length) return null;
        return (
          <section className="panel" key={lane.title}>
            <h2>
              {lane.title} <span className="muted">({laneRows.length})</span>
            </h2>
            <p className="small muted" style={{ marginTop: -6 }}>
              {lane.hint}
            </p>
            <ProjectList rows={laneRows} empty={null} showOrg />
          </section>
        );
      })}
    </>
  );
}
