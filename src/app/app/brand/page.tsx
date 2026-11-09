import { ActionForm } from "@/components/ActionForm";
import { Uploader } from "@/components/Uploader";
import { removeAttachment, saveBrandBook } from "../actions";
import { scanMyWebsite } from "../brief-actions";
import { BrandCard } from "@/components/BrandCard";
import { canEdit, requireMembership } from "@/lib/session";
import { signedUrls } from "@/lib/data";
import { dateTime, fileSize } from "@/lib/format";

const FIELDS = [
  { key: "about", label: "About your organisation", hint: "What you do, for whom, and what makes you different. A short paragraph.", rows: 4 },
  { key: "audiences", label: "Audiences", hint: "Who you're talking to, one per line, with what they care about.", rows: 3 },
  { key: "voice", label: "Tone of voice", hint: "Three or four words, and a sentence on what you never sound like.", rows: 3 },
  { key: "colours", label: "Colours", hint: "Name and value, one per line. For example: Green #94C11F (print C45 M0 Y100 K0).", rows: 3 },
  { key: "typefaces", label: "Typefaces", hint: "Headings and body, and where to get them.", rows: 2 },
  { key: "rules", label: "Do and don't", hint: "Logo rules, words to avoid, imagery that's off-limits.", rows: 4 },
] as const;

export const maxDuration = 120;

export default async function BrandBook({ searchParams }: { searchParams: Promise<{ welcome?: string }> }) {
  const { supabase, org, role, profile } = await requireMembership();
  const { welcome } = await searchParams;
  const [{ data: book }, { data: assets }] = await Promise.all([
    supabase.from("brand_books").select("*").eq("org_id", org.id).maybeSingle(),
    supabase.from("attachments").select("id, file_name, size, storage_path").eq("org_id", org.id).eq("kind", "brand").order("created_at"),
  ]);
  const editable = canEdit(role, profile.is_staff);
  const urls = await signedUrls(supabase, [...(assets ?? []).map((a) => a.storage_path), ...(book?.logo_path ? [book.logo_path] : [])]);

  return (
    <>
      <div className="app-head">
        <div>
          <h1>Brand book</h1>
          <p className="muted">
            The brief assistant and every designer read this before starting. Ten minutes here saves a round of changes later.
          </p>
        </div>
      </div>
      {welcome && (
        <div className="callout">
          <p>Your workspace is ready. Start by filling in your brand book, then invite your team or send your first brief.</p>
        </div>
      )}
      {editable && (
        <section className="panel scan-panel">
          <BrandCard
            name={org.name}
            logoUrl={book?.logo_path ? urls.get(book.logo_path) : null}
            palette={(book?.palette as string[] | null) ?? []}
            fonts={(book?.fonts as string[] | null) ?? []}
            website={book?.website}
          />
          <ActionForm action={scanMyWebsite} submit={book?.scanned_at ? "Read it again" : "Fill it in from my website"} pending="Reading your website">
            <label className="field">
              <span>Your website</span>
              <input type="text" name="website" defaultValue={book?.website ?? ""} placeholder="yourcompany.com" maxLength={300} />
              <span className="hint">We read it for your logo, colours, fonts, what you do and how you sound. Anything you&apos;ve written below is kept.</span>
            </label>
          </ActionForm>
        </section>
      )}
      <div className="grid-main">
        <section className="panel">
          {editable ? (
            <ActionForm action={saveBrandBook} submit="Save brand book" pending="Saving">
              {FIELDS.map((f) => (
                <label className="field" key={f.key}>
                  <span>{f.label}</span>
                  <span className="hint">{f.hint}</span>
                  <textarea name={f.key} rows={f.rows} defaultValue={(book?.[f.key] as string) ?? ""} maxLength={f.key === "colours" || f.key === "typefaces" ? 2000 : 4000} />
                </label>
              ))}
            </ActionForm>
          ) : (
            <div className="brief-view">
              {FIELDS.map((f) => (
                <div key={f.key}>
                  <h3>{f.label}</h3>
                  <p>{(book?.[f.key] as string) || "Not filled in yet."}</p>
                </div>
              ))}
            </div>
          )}
          {book?.updated_at && <p className="small muted" style={{ marginTop: 12 }}>Last saved {dateTime(book.updated_at)}</p>}
        </section>
        <aside>
          <section className="panel">
            <h2>Brand files</h2>
            <p className="small muted">Logos, guidelines, fonts, photography. Only your team and the studio can see them.</p>
            {(assets ?? []).length > 0 && (
              <ul className="list" style={{ margin: "10px 0 14px" }}>
                {(assets ?? []).map((a) => (
                  <li key={a.id} style={{ padding: "6px 0", display: "flex", justifyContent: "space-between", gap: 8 }}>
                    <span>
                      {urls.get(a.storage_path) ? (
                        <a href={urls.get(a.storage_path)} target="_blank" rel="noreferrer">
                          {a.file_name}
                        </a>
                      ) : (
                        a.file_name
                      )}{" "}
                      <span className="muted small">{fileSize(a.size)}</span>
                    </span>
                    {editable && (
                      <form action={removeAttachment}>
                        <input type="hidden" name="id" value={a.id} />
                        <input type="hidden" name="back" value="/app/brand" />
                        <button className="btn btn-small btn-line" type="submit" aria-label={`Remove ${a.file_name}`}>
                          Remove
                        </button>
                      </form>
                    )}
                  </li>
                ))}
              </ul>
            )}
            {editable && <Uploader orgId={org.id} projectId={null} kind="brand" label="Add brand files" />}
          </section>
        </aside>
      </div>
    </>
  );
}
