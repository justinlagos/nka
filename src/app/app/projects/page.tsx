import Link from "next/link";
import { ProjectList, type ProjectRow } from "@/components/ProjectList";
import { requireMembership } from "@/lib/session";

const VIEWS: Record<string, { label: string; statuses: string[] | null }> = {
  active: { label: "Active", statuses: ["submitted", "awaiting_approval", "in_progress", "in_review", "changes_requested"] },
  queued: { label: "Queued", statuses: ["queued"] },
  drafts: { label: "Drafts", statuses: ["draft"] },
  completed: { label: "Completed", statuses: ["completed"] },
  all: { label: "All", statuses: null },
};

export default async function Projects({ searchParams }: { searchParams: Promise<{ view?: string }> }) {
  const { supabase, org } = await requireMembership();
  const key = (await searchParams).view ?? "active";
  const view = VIEWS[key] ?? VIEWS.active;

  let q = supabase
    .from("projects")
    .select("id, number, title, status, deadline, estimate_due, updated_at")
    .eq("org_id", org.id)
    .order("updated_at", { ascending: false })
    .limit(300);
  if (view.statuses) q = q.in("status", view.statuses);
  const { data } = await q;

  return (
    <>
      <div className="app-head">
        <div>
          <h1>Projects</h1>
        </div>
        <Link href="/app/projects/new" className="btn">
          New brief
        </Link>
      </div>
      <nav className="tabs" aria-label="Filter projects">
        {Object.entries(VIEWS).map(([k, v]) => (
          <Link key={k} href={`/app/projects?view=${k}`} aria-current={k === key || (!VIEWS[key] && k === "active") ? "page" : undefined}>
            {v.label}
          </Link>
        ))}
      </nav>
      <section className="panel">
        <ProjectList
          rows={(data ?? []) as ProjectRow[]}
          empty={
            <>
              <strong>Nothing here.</strong>
              {key === "drafts" ? "Briefs you save without sending appear here." : <Link href="/app/projects/new">Start a brief</Link>}
            </>
          }
        />
      </section>
    </>
  );
}
