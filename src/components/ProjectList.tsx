import Link from "next/link";
import { StatusPill } from "@/components/StatusPill";
import { date, projectRef } from "@/lib/format";
import { ukDate } from "@/lib/ontime";

// Agreed date passed and nothing yet with the client for review.
const WORKING = ["submitted", "in_progress", "changes_requested"];

export type ProjectRow = {
  id: string;
  number: number;
  title: string;
  status: string;
  deadline: string | null;
  estimate_due: string | null;
  updated_at: string;
  org_name?: string;
};

// base: where rows link to. Clients /app/projects, the admin /admin/projects, designers /studio/projects.
export function ProjectList({
  rows,
  empty,
  showOrg = false,
  base = "/app/projects",
}: {
  rows: ProjectRow[];
  empty: React.ReactNode;
  showOrg?: boolean;
  base?: string;
}) {
  if (!rows.length) return <div className="empty">{empty}</div>;
  const today = ukDate(new Date());
  return (
    <ul className="list">
      {rows.map((p) => {
        const due = p.estimate_due ?? p.deadline;
        const overdue = Boolean(p.estimate_due && p.estimate_due < today && WORKING.includes(p.status));
        return (
          <li key={p.id}>
            <Link
              className="proj-row"
              href={p.status === "draft" && base === "/app/projects" ? `/app/projects/${p.id}/edit` : `${base}/${p.id}`}
            >
              <span className="proj-ref">{projectRef(p.number)}</span>
              <span className="proj-title">
                {showOrg && p.org_name ? <span className="muted">{p.org_name}: </span> : null}
                {p.title}
              </span>
              <span className={`proj-meta ${overdue ? "is-late" : ""}`}>
                {overdue ? `Overdue since ${date(p.estimate_due)}` : due ? `Due ${date(due)}` : `Updated ${date(p.updated_at)}`}
              </span>
              <StatusPill status={p.status} />
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
