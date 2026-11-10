import { notFound } from "next/navigation";
import Link from "next/link";
import { BrandCard } from "@/components/BrandCard";
import { ProjectList, type ProjectRow } from "@/components/ProjectList";
import { requireStudio } from "@/lib/session";
import { signedUrls } from "@/lib/data";
import { planLabel } from "@/lib/plans";

// One client, as their designer sees it: the brand book to work from and every project.
// No people, emails or numbers: the client's team is reached through the projects.
export default async function ClientForDesigner({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { supabase } = await requireStudio();
  const [{ data: org }, { data: book }, { data: projects }] = await Promise.all([
    supabase.from("orgs").select("id, name, plan, plan_status").eq("id", id).maybeSingle(),
    supabase
      .from("brand_books")
      .select("about, audiences, voice, rules, palette, fonts, logo_path, website")
      .eq("org_id", id)
      .maybeSingle(),
    supabase
      .from("projects")
      .select("id, number, title, status, deadline, estimate_due, updated_at")
      .eq("org_id", id)
      .neq("status", "draft")
      .order("updated_at", { ascending: false })
      .limit(200),
  ]);
  if (!org) notFound();
  const urls = await signedUrls(supabase, book?.logo_path ? [book.logo_path] : []);

  return (
    <>
      <div className="app-head">
        <div>
          <p className="muted small" style={{ margin: 0 }}>
            <Link href="/studio/clients">Your clients</Link>
          </p>
          <h1>{org.name}</h1>
          <p className="muted">
            {planLabel(org.plan)}
            {org.plan_status === "paused" ? ", paused" : ""}
          </p>
        </div>
      </div>
      <div className="grid-main">
        <section className="panel">
          <h2>Projects</h2>
          <ProjectList rows={(projects ?? []) as ProjectRow[]} empty="No projects yet." base="/studio/projects" />
        </section>
        <aside>
          <section className="panel">
            <h2>Brand book</h2>
            <BrandCard
              name={org.name}
              logoUrl={book?.logo_path ? urls.get(book.logo_path) : null}
              palette={(book?.palette as string[] | null) ?? []}
              fonts={(book?.fonts as string[] | null) ?? []}
              website={book?.website}
            />
            {book?.about && <p>{book.about}</p>}
            {book?.audiences && (
              <p className="small">
                <b>Audiences:</b> {book.audiences}
              </p>
            )}
            {book?.voice && (
              <p className="small">
                <b>Tone:</b> {book.voice}
              </p>
            )}
            {book?.rules && (
              <p className="small">
                <b>Do and don&apos;t:</b> {book.rules}
              </p>
            )}
            {!book?.about && !book?.voice && <p className="small muted">The client hasn&apos;t filled in their brand book yet. Ask in a project.</p>}
          </section>
        </aside>
      </div>
    </>
  );
}
