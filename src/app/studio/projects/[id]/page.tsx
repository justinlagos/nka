import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ActionForm } from "@/components/ActionForm";
import { StatusPill } from "@/components/StatusPill";
import { BrandCard } from "@/components/BrandCard";
import { ReviewFile, type ReviewComment } from "@/components/ReviewFile";
import { DeliverableUploader } from "@/components/DeliverableUploader";
import { AutoRefresh } from "@/components/AutoRefresh";
import { addProjectComment } from "@/app/app/actions";
import { sendEstimate, setStatus } from "@/app/admin/actions";
import { areaOf, requireProfile } from "@/lib/session";
import { signedUrls, people, displayName } from "@/lib/data";
import { STATUS, type ProjectStatus } from "@/lib/status";
import { BRIEF_FIELDS, normaliseBrief, SERVICE_OPTIONS } from "@/lib/brief";
import { date, dateTime, fileSize, projectRef, initials } from "@/lib/format";
import { onPlan as planIsOn, planLabel } from "@/lib/plans";
import { ReviewQueue } from "@/components/ReviewQueue";
import { deliveryTiming, timingText, ukDate } from "@/lib/ontime";

export const maxDuration = 300;

// The designer's workspace for one project. Built around what to do next: confirm the date,
// make the draft, answer the changes. The client's brief, brand and files are all here; their
// people, emails and numbers never are, and there's nothing about prices.

type Deliverable = {
  id: string;
  title: string;
  version: number;
  status: string;
  mime: string;
  file_name: string;
  size: number;
  note: string;
  storage_path: string;
  created_at: string;
  uploaded_by: string | null;
};

const EVENT_TEXT: Record<string, (d: Record<string, unknown>) => string> = {
  status: (d) => `moved to ${STATUS[d.to as ProjectStatus]?.label ?? d.to}`,
  estimate_sent: () => "confirmed the date",
  estimate_proposed: (d) => `proposed delivery by ${date(String(d.due))}`,
  estimate_approved: () => "approved the date",
  estimate_declined: () => "asked for a different date",
  deliverable_added: (d) => `added ${d.title} v${d.version}`,
  deliverable_approved: (d) => `approved ${d.title} v${d.version}`,
  deliverable_changes_requested: (d) => `asked for changes to ${d.title} v${d.version}`,
  resize_requested: (d) => `asked for resizes of ${d.from} v${d.version}`,
  auto_started: (d) => `started automatically, due ${date(String(d.due))}`,
  instant_failed: () => "Instant couldn't make options, so it came to you",
};

const STAGES: [string, string][] = [
  ["in_progress", "In production"],
  ["in_review", "Ready for review"],
  ["changes_requested", "Changes requested"],
  ["completed", "Completed"],
];

export default async function DesignerProject({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { supabase, profile, userId } = await requireProfile();
  const area = areaOf(profile);
  if (area === "admin") redirect(`/admin/projects/${id}`);
  if (area === "client") redirect(`/app/projects/${id}`);

  const { data: p } = await supabase
    .from("projects")
    .select(
      "id, number, org_id, title, service, kind, status, brief, deadline, estimate_due, estimate_hours, estimate_notes, estimate_sent_at, suggested_due, suggested_hours, suggested_notes, sized_at, assignee, submitted_at, completed_at, kickoff_call, allow_ai, source_deliverable, org:orgs(name, plan, plan_status, lead_id)",
    )
    .eq("id", id)
    .maybeSingle();
  if (!p || p.status === "draft") notFound();
  const org = p.org as unknown as { name: string; plan: string; plan_status: string; lead_id: string | null };
  const onPlan = planIsOn(org.plan, org.plan_status);

  const [{ data: dRows }, { data: cRows }, { data: aRows }, { data: eRows }, { data: book }] = await Promise.all([
    supabase
      .from("deliverables")
      .select("id, title, version, status, mime, file_name, size, note, storage_path, created_at, uploaded_by, review_note")
      .eq("project_id", id)
      .order("created_at"),
    supabase.from("comments").select("id, body, author, created_at, pin_x, pin_y, resolved, deliverable_id").eq("project_id", id).order("created_at"),
    supabase.from("attachments").select("id, file_name, size, storage_path, mime, kind").eq("project_id", id).order("created_at"),
    supabase.from("project_events").select("id, actor, kind, detail, created_at").eq("project_id", id).order("created_at", { ascending: false }).limit(40),
    supabase.from("brand_books").select("about, audiences, voice, rules, palette, fonts, logo_path, website").eq("org_id", p.org_id).maybeSingle(),
  ]);
  const allVersions = (dRows ?? []) as (Deliverable & { uploaded_by: string | null; review_note: string })[];
  // What the client sees, and what's waiting for Nka review or was sent back.
  const deliverables = allVersions.filter((d) => d.status !== "internal_review" && d.status !== "returned");
  const queue = allVersions.filter((d) => d.status === "internal_review" || d.status === "returned");
  const { data: leadRow } = await supabase.from("org_team").select("user_id").eq("org_id", p.org_id).eq("role", "creative_lead").maybeSingle();
  const iAmCreativeLead = leadRow?.user_id === userId;
  const comments = cRows ?? [];
  const attachments = ((aRows ?? []) as { id: string; file_name: string; size: number; storage_path: string; mime: string; kind: string }[]).filter(
    (a) => a.kind !== "concept",
  );
  const events = eRows ?? [];
  const urls = await signedUrls(supabase, [
    ...allVersions.map((d) => d.storage_path),
    ...attachments.map((a) => a.storage_path),
    ...(book?.logo_path ? [book.logo_path] : []),
  ]);
  const who = await people(supabase, [...comments.map((c) => c.author), ...events.map((e) => e.actor), ...queue.map((d) => d.uploaded_by)]);
  const toReview = (c: (typeof comments)[number]): ReviewComment => {
    const person = who.get(c.author);
    return {
      id: c.id,
      body: c.body,
      authorName: c.author === userId ? "You" : displayName(person),
      authorStaff: Boolean(person?.is_staff),
      createdAt: c.created_at,
      pinX: c.pin_x,
      pinY: c.pin_y,
      resolved: c.resolved,
    };
  };

  const groups = new Map<string, Deliverable[]>();
  for (const d of deliverables) groups.set(d.title.toLowerCase(), [...(groups.get(d.title.toLowerCase()) ?? []), d]);
  const fileGroups = [...groups.values()]
    .map((g) => g.sort((a, b) => b.version - a.version))
    .sort((a, b) => b[0].created_at.localeCompare(a[0].created_at));
  const titles = [...new Set(deliverables.map((d) => d.title))];

  const status = p.status as ProjectStatus;
  const brief = normaliseBrief(p.brief);
  const today = ukDate(new Date());
  const timing = deliveryTiming(p.estimate_due, deliverables.length ? ukDate(deliverables[0].created_at) : null, today);
  const general = comments.filter((c) => !c.deliverable_id);
  const proposed = status === "submitted" && !!p.estimate_due && !p.estimate_sent_at;
  const needsDate = status === "submitted" && !p.estimate_due;
  // The client's notes on the latest version they asked to change.
  const changed = deliverables.filter((d) => d.status === "changes_requested").sort((a, b) => b.created_at.localeCompare(a.created_at))[0];
  const changeNotes = changed ? comments.filter((c) => c.deliverable_id === changed.id && !who.get(c.author)?.is_staff) : [];
  const live = status === "submitted" && !p.sized_at;

  return (
    <>
      {live && <AutoRefresh />}
      <div className="app-head">
        <div>
          <p className="muted small" style={{ margin: 0 }}>
            <Link href="/studio">Your work</Link> / <Link href={`/studio/clients/${p.org_id}`}>{org.name}</Link> / {projectRef(p.number)}
          </p>
          <h1>{p.title}</h1>
          <p className="muted" style={{ margin: 0 }}>
            {p.kind === "resize" ? "Other sizes (free)" : SERVICE_OPTIONS.find((s) => s.value === p.service)?.label ?? "Design"}
            {p.estimate_due && (
              <>
                {" "}
                · due {date(p.estimate_due)}
                {timing.state !== "none" && <span className={`timing timing-${timing.state}`}>{timingText(timing)}</span>}
              </>
            )}
          </p>
        </div>
        <StatusPill status={status} />
      </div>

      <section className="next-step">
        <h2>Next</h2>
        {needsDate && (
          <>
            <p>
              Read the brief and brand book, ask the client anything below, then {onPlan ? "confirm the date and hours. It starts as soon as you do, on the client's plan hours." : "propose a date. Nka quotes it and sends it to the client."}
            </p>
            <ActionForm action={sendEstimate} submit={onPlan ? "Confirm the date and start" : "Send to Nka to quote"} pending="Sending" buttonClass="btn">
              <input type="hidden" name="id" value={p.id} />
              <div className="row-2">
                <label className="field">
                  <span>First draft by</span>
                  <input type="date" name="due" required min={today} defaultValue={p.suggested_due ?? undefined} />
                </label>
                <label className="field">
                  <span>Hours</span>
                  <input type="number" name="hours" min={0} step="0.5" defaultValue={p.suggested_hours ?? undefined} />
                </label>
              </div>
              <label className="field">
                <span>What&apos;s included</span>
                <textarea name="notes" rows={2} maxLength={4000} defaultValue={p.suggested_notes || undefined} placeholder="Options, rounds of changes, sizes" />
              </label>
              {p.suggested_due && <p className="small muted">Pre-filled from Nka&apos;s reading of the brief. Change anything.</p>}
            </ActionForm>
          </>
        )}
        {proposed && <p>You proposed {date(p.estimate_due)}. Nka is pricing it for the client; you&apos;ll get an email when it starts.</p>}
        {status === "awaiting_approval" && <p>With the client to approve. You&apos;ll get an email when they do.</p>}
        {status === "queued" && <p>Queued: the client&apos;s plan is full. It starts by itself when one of their projects finishes.</p>}
        {(status === "in_progress" || status === "changes_requested") && (
          <>
            {status === "changes_requested" && changed ? (
              <div className="change-notes">
                <p>
                  The client asked for changes to <b>{changed.title} v{changed.version}</b>:
                </p>
                {changeNotes.length ? (
                  <ul>
                    {changeNotes.map((c) => (
                      <li key={c.id}>{c.body}</li>
                    ))}
                  </ul>
                ) : (
                  <p className="muted">See their comments on the file below.</p>
                )}
              </div>
            ) : (
              <p>Make the first draft{p.estimate_due ? ` by ${date(p.estimate_due)}` : ""}. Uploading it sends it to the client for review.</p>
            )}
            <DeliverableUploader projectId={p.id} orgId={p.org_id} titles={titles} />
          </>
        )}
        {status === "in_review" && <p>With the client for review. You&apos;ll get an email when they approve or ask for changes.</p>}
        {status === "completed" && <p>Completed{p.completed_at ? ` ${date(p.completed_at)}` : ""}. Nothing more to do.</p>}
      </section>

      <div className="grid-main">
        <div>
          <ReviewQueue
            canReview={iAmCreativeLead}
            items={queue.map((d) => ({
              id: d.id,
              title: d.title,
              version: d.version,
              status: d.status,
              note: d.note,
              review_note: d.review_note,
              created_at: d.created_at,
              url: urls.get(d.storage_path) ?? null,
              maker: d.uploaded_by === userId ? "you" : displayName(who.get(d.uploaded_by ?? "")),
            }))}
          />
          <section className="panel">
            <h2>Files the client sees</h2>
            {fileGroups.length === 0 ? (
              <div className="empty">
                <strong>No files yet.</strong>
                Your drafts appear here, with the client&apos;s comments pinned on them.
              </div>
            ) : (
              <div className="files">
                {fileGroups.map(([latest, ...older]) => (
                  <ReviewFile
                    key={latest.id}
                    d={{
                      id: latest.id,
                      title: latest.title,
                      version: latest.version,
                      status: latest.status,
                      mime: latest.mime,
                      fileName: latest.file_name,
                      size: latest.size,
                      note: latest.note,
                      url: urls.get(latest.storage_path) ?? null,
                      createdAt: latest.created_at,
                    }}
                    older={older.map((o) => ({ id: o.id, version: o.version, status: o.status, url: urls.get(o.storage_path) ?? null }))}
                    comments={comments.filter((c) => c.deliverable_id === latest.id).map(toReview)}
                    projectId={p.id}
                    orgId={p.org_id}
                    canComment={status !== "cancelled"}
                    canDecide={false}
                  />
                ))}
              </div>
            )}
          </section>

          <section className="panel">
            <h2>Conversation with the client</h2>
            {general.length === 0 ? (
              <p className="muted">Ask questions about the brief here. The client is emailed when you post.</p>
            ) : (
              <div className="comments" style={{ marginBottom: 16 }}>
                {general.map((c) => {
                  const r = toReview(c);
                  return (
                    <div key={c.id} className="comment">
                      <span className={`avatar ${r.authorStaff ? "staff" : ""}`} aria-hidden="true">
                        {initials(r.authorName)}
                      </span>
                      <div>
                        <div className="comment-meta">
                          <b>{r.authorName}</b>
                          {!r.authorStaff ? ` (${org.name})` : ""}, {dateTime(r.createdAt)}
                        </div>
                        <p className="comment-body">{r.body}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
            {status !== "cancelled" && (
              <ActionForm action={addProjectComment} submit="Send to the client" pending="Sending" buttonClass="btn btn-small btn-ink" resetOnSuccess>
                <input type="hidden" name="project_id" value={p.id} />
                <input type="hidden" name="org_id" value={p.org_id} />
                <label className="field" style={{ marginBottom: 8 }}>
                  <span className="skip">Message</span>
                  <textarea name="body" rows={3} required maxLength={5000} placeholder="Write to the client" />
                </label>
                <p className="small muted" style={{ margin: "0 0 8px" }}>
                  They see you as &ldquo;{profile.alias || "Your designer"}&rdquo;. Phone numbers, email addresses and social links can&apos;t be shared.
                </p>
              </ActionForm>
            )}
          </section>
        </div>

        <aside>
          <section className="panel brief-view">
            <h2>Brief</h2>
            {BRIEF_FIELDS.filter((f) => brief[f.key]).map((f) => (
              <div key={f.key}>
                <h3>{f.label}</h3>
                <p>{brief[f.key]}</p>
              </div>
            ))}
            <dl className="kv" style={{ marginTop: 12 }}>
              <dt>Client needs it by</dt>
              <dd>{p.deadline ? date(p.deadline) : "No date given"}</dd>
              <dt>Kickoff call</dt>
              <dd>{p.kickoff_call ? "Asked for one: arrange it through Nka" : "No"}</dd>
              <dt>AI tools</dt>
              <dd>{p.allow_ai ? "Allowed" : "Not allowed"}</dd>
            </dl>
          </section>

          <section className="panel">
            <h2>{org.name}</h2>
            <p className="small muted" style={{ marginTop: -6 }}>
              {planLabel(org.plan)}
              {org.plan_status === "paused" ? ", paused" : ""}
            </p>
            <BrandCard
              name={org.name}
              logoUrl={book?.logo_path ? urls.get(book.logo_path) : null}
              palette={(book?.palette as string[] | null) ?? []}
              fonts={(book?.fonts as string[] | null) ?? []}
              website={book?.website}
            />
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
            <p className="small">
              <Link href={`/studio/clients/${p.org_id}`}>Full brand book and other projects</Link>
            </p>
          </section>

          {attachments.length > 0 && (
            <section className="panel">
              <h2>References</h2>
              <ul className="list">
                {attachments.map((a) => (
                  <li key={a.id} style={{ padding: "6px 0" }}>
                    {urls.get(a.storage_path) ? (
                      <a href={urls.get(a.storage_path)} target="_blank" rel="noreferrer">
                        {a.file_name}
                      </a>
                    ) : (
                      a.file_name
                    )}{" "}
                    <span className="muted small">{fileSize(a.size)}</span>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {!["submitted", "queued", "awaiting_approval", "cancelled"].includes(status) && (
            <section className="panel">
              <h2>Stage</h2>
              <ActionForm action={setStatus} submit="Update" pending="Saving" buttonClass="btn btn-small btn-line">
                <input type="hidden" name="id" value={p.id} />
                <label className="field">
                  <span className="skip">Stage</span>
                  <select name="status" defaultValue={status}>
                    {STAGES.map(([v, l]) => (
                      <option key={v} value={v}>
                        {l}
                      </option>
                    ))}
                  </select>
                </label>
              </ActionForm>
              <p className="small muted">Uploading a file moves it to Ready for review by itself.</p>
            </section>
          )}

          <section className="panel">
            <h2>Activity</h2>
            <ul className="events">
              {events.map((e) => (
                <li key={e.id}>
                  <b>{e.actor === userId ? "You" : e.actor ? displayName(who.get(e.actor)) : "Nka"}</b>{" "}
                  {(EVENT_TEXT[e.kind] ?? (() => e.kind))(e.detail as Record<string, unknown>)}
                  <br />
                  <span className="small">{dateTime(e.created_at)}</span>
                </li>
              ))}
            </ul>
          </section>
        </aside>
      </div>
    </>
  );
}
