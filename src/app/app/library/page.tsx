import Link from "next/link";
import { requireMembership } from "@/lib/session";
import { signedUrls } from "@/lib/data";
import { date, fileSize, projectRef } from "@/lib/format";

export default async function Library({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const { supabase, org } = await requireMembership();
  const q = ((await searchParams).q ?? "").trim().slice(0, 80);

  let query = supabase
    .from("deliverables")
    .select("id, title, version, mime, file_name, size, storage_path, created_at, project:projects(id, number, title)")
    .eq("org_id", org.id)
    .eq("status", "approved")
    .order("created_at", { ascending: false })
    .limit(240);
  if (q) query = query.or(`title.ilike.%${q.replace(/[%,()]/g, "")}%,file_name.ilike.%${q.replace(/[%,()]/g, "")}%`);
  const { data } = await query;
  const files = (data ?? []) as unknown as {
    id: string;
    title: string;
    version: number;
    mime: string;
    file_name: string;
    size: number;
    storage_path: string;
    created_at: string;
    project: { id: string; number: number; title: string } | null;
  }[];
  const urls = await signedUrls(supabase, files.map((f) => f.storage_path));

  return (
    <>
      <div className="app-head">
        <div>
          <h1>Library</h1>
          <p className="muted">Every file you&apos;ve approved, newest first. Links work for an hour; refresh to get new ones.</p>
        </div>
        <form role="search" style={{ display: "flex", gap: 8 }}>
          <label className="skip" htmlFor="lib-q">
            Search files
          </label>
          <input id="lib-q" type="text" name="q" defaultValue={q} placeholder="Search by title or file name" />
          <button className="btn btn-small btn-line" type="submit">
            Search
          </button>
        </form>
      </div>
      {files.length === 0 ? (
        <div className="panel empty">
          <strong>{q ? `Nothing matches "${q}".` : "No approved files yet."}</strong>
          {q ? <Link href="/app/library">Show everything</Link> : "When you approve a file in a project, it appears here."}
        </div>
      ) : (
        <div className="lib-grid">
          {files.map((f) => {
            const url = urls.get(f.storage_path);
            const ext = f.file_name.split(".").pop()?.toUpperCase() ?? "FILE";
            return (
              <div className="lib-item" key={f.id}>
                <div className="lib-thumb">
                  {url && f.mime.startsWith("image/") ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={url} alt="" loading="lazy" />
                  ) : (
                    <span>{ext.slice(0, 5)}</span>
                  )}
                </div>
                <div className="lib-meta">
                  <b>
                    {f.title} <span className="muted">v{f.version}</span>
                  </b>
                  {f.project && (
                    <Link href={`/app/projects/${f.project.id}`} className="muted">
                      {projectRef(f.project.number)} {f.project.title}
                    </Link>
                  )}
                  <span className="muted">
                    {fileSize(f.size)}, {date(f.created_at)}
                  </span>
                  {url && (
                    <a href={url} download={f.file_name} target="_blank" rel="noreferrer">
                      Download
                    </a>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </>
  );
}
