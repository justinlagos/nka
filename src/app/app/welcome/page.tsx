import { cookies } from "next/headers";
import Link from "next/link";
import { planById } from "@/lib/plans";
import { redirect } from "next/navigation";
import { BrandCard } from "@/components/BrandCard";
import { LaneChoice } from "@/components/LaneChoice";
import { requireMembership } from "@/lib/session";
import { signedUrls, people, displayName } from "@/lib/data";
import { normaliseBrief } from "@/lib/brief";
import { instantStatus } from "@/lib/instant";

export const maxDuration = 300;

// Where a new client lands after the demo questions: their brand, read from their site,
// and their first brief, written and ready to send one of two ways.
export default async function Welcome({ searchParams }: { searchParams: Promise<{ p?: string }> }) {
  const { p: projectId } = await searchParams;
  const { supabase, org, profile } = await requireMembership();
  const [{ data: book }, { data: project }, { data: o }, instant] = await Promise.all([
    supabase.from("brand_books").select("about, audiences, voice, palette, fonts, logo_path, website").eq("org_id", org.id).maybeSingle(),
    projectId
      ? supabase.from("projects").select("id, title, status, brief").eq("id", projectId).eq("org_id", org.id).maybeSingle()
      : Promise.resolve({ data: null }),
    supabase.from("orgs").select("name, lead_id").eq("id", org.id).single(),
    instantStatus(supabase, org.id),
  ]);
  if (project && project.status !== "draft") redirect(`/app/projects/${project.id}`);
  const urls = await signedUrls(supabase, book?.logo_path ? [book.logo_path] : []);
  const who = await people(supabase, [o?.lead_id]);
  const lead = o?.lead_id ? who.get(o.lead_id) : undefined;
  const brief = project ? normaliseBrief(project.brief) : null;
  const first = profile.full_name.split(" ")[0];
  const [planId, cur, interval] = ((await cookies()).get("nka_plan")?.value ?? "").split("|");
  const chosen = planById(planId);

  return (
    <div className="welcome">
      <p className="eyebrow">Your workspace is ready</p>
      <h1>{first ? `Welcome, ${first}.` : "Welcome."} Here&apos;s what we set up.</h1>
      {chosen && (
        <div className="callout">
          <p>
            You picked {chosen.name}. Start it when you&apos;re ready to send work to your team; Instant briefs are free until then.{" "}
            <Link href={`/app/billing?plan=${chosen.id}&cur=${cur}&interval=${interval}`}>Start {chosen.name}</Link>
          </p>
        </div>
      )}

      <div className="welcome-grid">
        <section className="panel">
          <h2>Your brand</h2>
          <BrandCard
            name={o?.name ?? org.name}
            logoUrl={book?.logo_path ? urls.get(book.logo_path) : null}
            palette={(book?.palette as string[] | null) ?? []}
            fonts={(book?.fonts as string[] | null) ?? []}
            website={book?.website}
          />
          {book?.about ? <p>{book.about}</p> : <p className="muted">Add your website on the brand book page and we&apos;ll fill this in.</p>}
          {book?.voice && <p className="small muted">Tone: {book.voice}</p>}
          <p className="small">
            <Link href="/app/brand">Check your brand book</Link>
          </p>
          {lead && (
            <p className="small" style={{ marginTop: 16 }}>
              <b>{displayName(lead)}</b> is your designer and leads your team.
            </p>
          )}
        </section>

        {project && brief ? (
          <section className="panel brief-card">
            <p className="eyebrow">Your first brief, written for you</p>
            <h2 className="h3">{project.title}</h2>
            <p>{brief.summary}</p>
            {brief.deliverables && (
              <ul className="ticks">
                {brief.deliverables
                  .split("\n")
                  .filter(Boolean)
                  .slice(0, 6)
                  .map((d) => (
                    <li key={d}>{d}</li>
                  ))}
              </ul>
            )}
            {brief.questions && <p className="small muted">We&apos;ll confirm: {brief.questions}</p>}
            <LaneChoice projectId={project.id} instant={instant.on} instantLeft={instant.left} />
            <p className="small muted">
              <Link href={`/app/projects/${project.id}/edit`}>Edit the details first</Link>
            </p>
          </section>
        ) : (
          <section className="panel">
            <h2>Send your first brief</h2>
            <p>
              <Link href="/app/projects/new" className="btn">
                New brief
              </Link>
            </p>
          </section>
        )}
      </div>
    </div>
  );
}
