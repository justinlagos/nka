import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ActionForm } from "@/components/ActionForm";
import { StatusPill } from "@/components/StatusPill";
import { ReviewFile, type ReviewComment } from "@/components/ReviewFile";
import { StaffPanel } from "@/components/StaffPanel";
import { addProjectComment, approveEstimate, cancelProject, completeProject, declineEstimate } from "../../actions";
import { finishWithDesigner } from "../../brief-actions";
import { AutoRefresh } from "@/components/AutoRefresh";
import { getMemberships, requireProfile, canAdmin, canEdit, type Role } from "@/lib/session";
import { signedUrls, people, displayName } from "@/lib/data";
import { STATUS, STAGES, stageIndex, type ProjectStatus } from "@/lib/status";
import { BRIEF_FIELDS, normaliseBrief, SERVICE_OPTIONS } from "@/lib/brief";
import { date, dateTime, fileSize, money, projectRef, initials } from "@/lib/format";
import { planLabel } from "@/lib/plans";
import { deliveryTiming, timingText, ukDate } from "@/lib/ontime";

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
};

const EVENT_TEXT: Record<string, (d: Record<string, unknown>) => string> = {
  status: (d) => `moved to ${STATUS[d.to as ProjectStatus]?.label ?? d.to}`,
  estimate_sent: () => "sent an estimate",
  estimate_proposed: (d) => `proposed delivery by ${date(String(d.due))}`,
  estimate_approved: () => "approved the estimate",
  estimate_declined: () => "sent the estimate back",
  deliverable_added: (d) => `added ${d.title} v${d.version}`,
  deliverable_approved: (d) => `approved ${d.title} v${d.version}`,
  deliverable_changes_requested: (d) => `asked for changes to ${d.title} v${d.version}`,
  resize_requested: (d) => `asked for resizes of ${d.from} v${d.version}`,
  auto_started: (d) => `started automatically, due ${date(String(d.due))}`,
  instant_started: () => "asked for instant options",
  instant_ready: (d) => `made ${d.count} instant options`,
  instant_failed: () => "couldn't make the instant options, so your designer is making it instead",
};

export const maxDuration = 300;

export default async function ProjectPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ sent?: string }>;
}) {
  const { id } = await params;
  const { sent } = await searchParams;
  const { supabase, profile } = await requireProfile();

  const { data: p } = await supabase
    .from("projects")
    .select("*, org:orgs(id, name, plan, currency)")
    .eq("id", id)
    .maybeSingle();
  if (!p) notFound();
  if (p.status === "draft") redirect(`/app/projects/${id}/edit`);

  const org = p.org as { id: string; name: string; plan: string; currency: string };
  const memberships = await getMemberships();
  const role = (memberships.find((m) => m.org.id === p.org_id)?.role ?? null) as Role | null;
  // admin: Nka, sees everything. designer: the client's designer (row-level security already limits them to
  // their own clients). Either is "studio" on this page.
  const admin = profile.is_staff;
  const designer = profile.is_talent && !profile.is_staff;
  const staff = admin || designer;
  const mayEdit = admin || (role !== null && canEdit(role));
  const mayTalk = mayEdit || designer;
  const mayAdmin = role !== null && canAdmin(role);

  const [{ data: dRows }, { data: cRows }, { data: aRows }, { data: eRows }, staffList] = await Promise.all([
    supabase
      .from("deliverables")
      .select("id, title, version, status, mime, file_name, size, note, storage_path, created_at")
      .eq("project_id", id)
      .order("created_at"),
    supabase
      .from("comments")
      .select("id, body, author, created_at, pin_x, pin_y, resolved, deliverable_id")
      .eq("project_id", id)
      .order("created_at"),
    supabase.from("attachments").select("id, file_name, size, storage_path, mime, kind").eq("project_id", id).order("created_at"),
    supabase.from("project_events").select("id, actor, kind, detail, created_at").eq("project_id", id).order("created_at", { ascending: false }).limit(40),
    admin
      ? supabase.from("profiles").select("id, full_name, email").or("is_staff.eq.true,is_talent.eq.true").order("full_name")
      : Promise.resolve({ data: [] as { id: string; full_name: string; email: string }[] }),
  ]);

  const deliverables = (dRows ?? []) as Deliverable[];
  const comments = cRows ?? [];
  const allAttachments = (aRows ?? []) as { id: string; file_name: string; size: number; storage_path: string; mime: string; kind?: string }[];
  const attachments = allAttachments.filter((a) => a.kind !== "concept");
  const concepts = allAttachments.filter((a) => a.kind === "concept");
  const events = eRows ?? [];
  const { data: source } = p.source_deliverable
    ? await supabase.from("deliverables").select("title, storage_path, mime").eq("id", p.source_deliverable).maybeSingle()
    : { data: null };
  const urls = await signedUrls(supabase, [
    ...deliverables.map((d) => d.storage_path),
    ...allAttachments.map((a) => a.storage_path),
    ...(source ? [source.storage_path] : []),
  ]);
  const who = await people(supabase, [...comments.map((c) => c.author), ...events.map((e) => e.actor), p.assignee, p.approved_by]);

  // Latest version of each titled file first; older ones listed under it.
  const groups = new Map<string, Deliverable[]>();
  for (const d of deliverables) {
    const key = d.title.toLowerCase();
    groups.set(key, [...(groups.get(key) ?? []), d]);
  }
  const fileGroups = [...groups.values()]
    .map((g) => g.sort((a, b) => b.version - a.version))
    .sort((a, b) => b[0].created_at.localeCompare(a[0].created_at));

  const toReview = (c: (typeof comments)[number]): ReviewComment => {
    const person = who.get(c.author);
    return {
      id: c.id,
      body: c.body,
      authorName: displayName(person),
      authorStaff: Boolean(person?.is_staff),
      createdAt: c.created_at,
      pinX: c.pin_x,
      pinY: c.pin_y,
      resolved: c.resolved,
    };
  };

  const status = p.status as ProjectStatus;
  const brief = normaliseBrief(p.brief);
  const showMoney = !designer && (org.plan === "flex" || org.plan === "none" || org.plan === "bespoke");
  const current = stageIndex(status);
  const general = comments.filter((c) => !c.deliverable_id);
  const timing = deliveryTiming(
    p.estimate_due,
    deliverables.length ? ukDate(deliverables[0].created_at) : null,
    ukDate(new Date()),
  );
  const isResize = p.kind === "resize";
  const isInstant = p.kind === "instant";
  const making = isInstant && status === "in_progress" && p.concepts_status === "pending";
  const sizing = !isResize && !isInstant && ["submitted", "queued"].includes(status) && !p.sized_at;
  const live = making || sizing || p.concepts_status === "pending";
  const instantFailed = !isInstant && (eRows ?? []).some((e) => e.kind === "instant_failed");

  return (
    <>
      <div className="app-head">
        <div>
          <p className="muted small" style={{ margin: 0 }}>
            {projectRef(p.number)}
            {staff ? `, ${org.name} (${planLabel(org.plan)})` : ""}
          </p>
          <h1>{p.title}</h1>
        </div>
        <StatusPill status={status} />
      </div>

      {sent === "1" && (
        <div className="callout">
          <p>
            {status === "queued"
              ? "Brief sent. Your plan's active requests are full, so this one is queued and will start automatically."
              : "Brief sent. The studio will confirm scope and a delivery date, usually within one working day."}
          </p>
        </div>
      )}

      {live && <AutoRefresh />}
      {(sent === "instant" || making) && (
        <div className={`callout ${making ? "callout-live" : ""}`}>
          <p>
            {making
              ? "Making three options from your brief and brand. This takes about a minute; this page updates by itself."
              : "Instant brief sent."}
          </p>
        </div>
      )}
      {instantFailed && !["completed", "cancelled"].includes(status) && (
        <div className="callout">
          <p>
            Instant couldn&apos;t make options this time, so this brief has gone to your designer instead. It didn&apos;t use
            one of your Instant briefs.
          </p>
        </div>
      )}
      {sent === "designer" && (
        <div className="callout">
          <p>
            {status === "queued"
              ? "Brief sent. Your plan's active requests are full, so this one is queued and starts automatically."
              : status === "in_progress"
                ? `Brief sent and started. First draft due ${date(p.estimate_due)}.`
                : sizing
                  ? "Brief sent. Working out your delivery date…"
                  : "Brief sent. Your designer confirms the date within a working day."}
          </p>
        </div>
      )}
      {!p.estimate_due && p.suggested_due && !["completed", "cancelled"].includes(status) && (
        <div className="expected">
          <span className="expected-label">Expected first draft</span>
          <b>{date(p.suggested_due)}</b>
          <span className="small muted">Nka&apos;s estimate from your brief. Your designer confirms it.</span>
        </div>
      )}
      {isResize && !sent && (
        <div className="callout">
          <p>Free resize. It doesn&apos;t use one of your plan&apos;s request slots or any Flex budget.</p>
        </div>
      )}
      {sent === "resize" && (
        <div className="callout">
          <p>Resize requested. It&apos;s free, it&apos;s already with your designer, and it doesn&apos;t use a request slot.</p>
        </div>
      )}

      {status !== "cancelled" && status !== "queued" && (
        <ol className="stages" aria-label="Project stages">
          {STAGES.map((s, i) => (
            <li key={s} className={i < current || status === "completed" ? "done" : i === current ? "now" : ""} aria-current={i === current ? "step" : undefined}>
              {STATUS[s].label}
            </li>
          ))}
        </ol>
      )}

      <div className="grid-main">
        <div>
          <div className="callout">
            <p>{STATUS[status]?.client}</p>
          </div>

          {(status === "awaiting_approval" || (p.estimate_sent_at && showMoney)) && (
            <section className="estimate" style={{ marginBottom: 18 }}>
              <h2 className="h3" style={{ marginBottom: 8 }}>
                Estimate
              </h2>
              {showMoney && p.estimate_amount !== null && <div className="amount">{money(p.estimate_amount, org.currency, 2)}</div>}
              <p className="small muted" style={{ margin: "4px 0 0" }}>
                {showMoney
                  ? "Fixed price. If it takes us longer, that's on us. It only changes if you ask for something new and approve the new price."
                  : "Included in your plan. No extra charge."}
              </p>
              <dl className="kv" style={{ margin: "10px 0" }}>
                {p.estimate_hours !== null && (
                  <>
                    <dt>Time</dt>
                    <dd>{p.estimate_hours} hours</dd>
                  </>
                )}
                {p.estimate_due && (
                  <>
                    <dt>Delivery</dt>
                    <dd>{date(p.estimate_due)}</dd>
                  </>
                )}
                {org.plan === "flex" && (
                  <>
                    <dt>Paid from</dt>
                    <dd>Your Flex budget, when approved</dd>
                  </>
                )}
              </dl>
              {p.estimate_notes && <p style={{ whiteSpace: "pre-wrap" }}>{p.estimate_notes}</p>}
              {status === "awaiting_approval" &&
                (mayAdmin ? (
                  <div className="grid-2" style={{ marginTop: 12 }}>
                    <ActionForm action={approveEstimate} submit="Approve and start" pending="Approving">
                      <input type="hidden" name="id" value={p.id} />
                    </ActionForm>
                    <details>
                      <summary className="link-quiet" style={{ cursor: "pointer" }}>
                        Ask for a different estimate
                      </summary>
                      <ActionForm action={declineEstimate} submit="Send back" pending="Sending" buttonClass="btn btn-line">
                        <input type="hidden" name="id" value={p.id} />
                        <label className="field">
                          <span>What should change?</span>
                          <textarea name="note" rows={3} required maxLength={2000} />
                        </label>
                      </ActionForm>
                    </details>
                  </div>
                ) : (
                  <p className="small muted">An owner or admin in {org.name} needs to approve this.</p>
                ))}
              {p.approved_at && (
                <p className="small muted" style={{ margin: 0 }}>
                  Approved {dateTime(p.approved_at)}
                  {p.approved_by ? ` by ${displayName(who.get(p.approved_by))}` : ""}.
                </p>
              )}
            </section>
          )}

          <section className="panel">
            <h2>Files from the studio</h2>
            {fileGroups.length === 0 ? (
              <div className="empty">
                <strong>No files yet.</strong>
                Drafts appear here for review as soon as they&apos;re ready.
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
                    canComment={mayTalk && status !== "cancelled"}
                    canDecide={(role !== null && canEdit(role)) && status !== "cancelled"}
                  />
                ))}
              </div>
            )}
          </section>

          {isInstant && deliverables.length > 0 && mayEdit && (
            <section className="panel">
              <h2>Want a designer to finish one?</h2>
              <p className="muted">They start from the option you pick and make it properly: real fonts, exact copy, every size.</p>
              <ActionForm action={finishWithDesigner} submit="Send to my designer" pending="Sending" buttonClass="btn btn-small">
                <label className="field">
                  <span>Option</span>
                  <select name="deliverable" defaultValue={deliverables[0].id}>
                    {deliverables.map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.title}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="field">
                  <span>Anything to change? (optional)</span>
                  <input type="text" name="note" maxLength={1000} placeholder="Keep the layout, use our real logo, bigger headline" />
                </label>
              </ActionForm>
            </section>
          )}

          {(concepts.length > 0 || (!isInstant && p.concepts_status === "pending")) && (
            <section className="panel">
              <h2>Early directions</h2>
              <p className="muted">
                Made by AI from your brief while your designer starts. Tell us which feels closest; the final work is designed by a
                person.
              </p>
              {concepts.length === 0 ? (
                <p className="small muted">Making three directions…</p>
              ) : (
                <div className="concepts">
                  {concepts.map((c) => (
                    <figure key={c.id}>
                      {urls.get(c.storage_path) && (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={urls.get(c.storage_path)} alt={c.file_name} loading="lazy" />
                      )}
                      <figcaption>
                        <span>{c.file_name}</span>
                        {mayEdit && (
                          <ActionForm action={addProjectComment} submit="This one's closest" pending="Sending" buttonClass="btn btn-small btn-line">
                            <input type="hidden" name="project_id" value={p.id} />
                            <input type="hidden" name="org_id" value={p.org_id} />
                            <input type="hidden" name="body" value={`Closest direction: ${c.file_name}`} />
                          </ActionForm>
                        )}
                      </figcaption>
                    </figure>
                  ))}
                </div>
              )}
            </section>
          )}

          {source && (
            <section className="panel">
              <h2>Starting point</h2>
              <p className="muted">{source.title}</p>
              {urls.get(source.storage_path) && source.mime.startsWith("image/") && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={urls.get(source.storage_path)} alt={source.title} className="source-img" />
              )}
            </section>
          )}

          <section className="panel">
            <h2>Conversation</h2>
            {general.length === 0 ? (
              <p className="muted">Questions and notes about the project as a whole go here.</p>
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
                          {r.authorStaff ? " (Nka)" : ""}, {dateTime(r.createdAt)}
                        </div>
                        <p className="comment-body">{r.body}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
            {mayTalk && (
              <ActionForm action={addProjectComment} submit="Post" pending="Posting" buttonClass="btn btn-small btn-ink" resetOnSuccess>
                <input type="hidden" name="project_id" value={p.id} />
                <input type="hidden" name="org_id" value={p.org_id} />
                <label className="field" style={{ marginBottom: 8 }}>
                  <span className="skip">Message</span>
                  <textarea
                    name="body"
                    rows={3}
                    required
                    maxLength={5000}
                    placeholder={staff ? "Write a message to the client" : "Write a message to your designer"}
                  />
                </label>
                <p className="small muted" style={{ margin: "0 0 8px" }}>
                  {staff ? "The client is emailed that there's a new message." : "Your designer is emailed that there's a new message."} Phone
                  numbers, email addresses and social links can&apos;t be shared here.
                </p>
              </ActionForm>
            )}
          </section>
        </div>

        <aside>
          {staff && (
            <StaffPanel
              project={{
                id: p.id,
                orgId: p.org_id,
                status,
                assignee: p.assignee,
                plan: org.plan,
                currency: org.currency,
                // A date the designer proposed wins over Nka's own suggestion.
                suggested:
                  p.estimate_due && !p.estimate_sent_at
                    ? { hours: p.estimate_hours, due: p.estimate_due, amount: p.suggested_amount, notes: p.estimate_notes ?? "" }
                    : p.sized_at
                      ? { hours: p.suggested_hours, due: p.suggested_due, amount: p.suggested_amount, notes: p.suggested_notes ?? "" }
                      : null,
              }}
              staff={(staffList.data ?? []) as { id: string; full_name: string; email: string }[]}
              admin={admin}
            />
          )}
          {staff && (
            <p className="small" style={{ margin: "0 0 16px" }}>
              <Link href={admin ? `/admin/clients/${p.org_id}` : `/studio/clients/${p.org_id}`}>{org.name}: brand book and other projects</Link>
            </p>
          )}
          <section className="panel">
            <h2>Details</h2>
            <dl className="kv">
              <dt>Type</dt>
              <dd>
                {isResize
                  ? "Other sizes and formats (free)"
                  : isInstant
                    ? "Instant (AI)"
                    : SERVICE_OPTIONS.find((s) => s.value === p.service)?.label ?? "Not set"}
              </dd>
              <dt>Needed by</dt>
              <dd>{p.deadline ? date(p.deadline) : "No date given"}</dd>
              {p.estimate_due && (
                <>
                  <dt>Delivery</dt>
                  <dd>
                    {date(p.estimate_due)}
                    {timing.state !== "none" && status !== "cancelled" && (
                      <span className={`timing timing-${timing.state}`}>{timingText(timing)}</span>
                    )}
                  </dd>
                </>
              )}
              <dt>Designer</dt>
              <dd>{p.assignee ? displayName(who.get(p.assignee)) : "Being assigned"}</dd>
              <dt>Kickoff call</dt>
              <dd>{p.kickoff_call ? "Requested" : "No"}</dd>
              <dt>AI tools</dt>
              <dd>{p.allow_ai ? "Allowed" : "Not allowed"}</dd>
              <dt>Sent</dt>
              <dd>{p.submitted_at ? dateTime(p.submitted_at) : ""}</dd>
            </dl>
          </section>

          <section className="panel brief-view">
            <h2>Brief</h2>
            {BRIEF_FIELDS.filter((f) => brief[f.key]).map((f) => (
              <div key={f.key}>
                <h3>{f.label}</h3>
                <p>{brief[f.key]}</p>
              </div>
            ))}
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

          <section className="panel">
            <h2>Activity</h2>
            <ul className="events">
              {events.map((e) => (
                <li key={e.id}>
                  <b>{e.actor ? displayName(who.get(e.actor)) : "Nka"}</b> {(EVENT_TEXT[e.kind] ?? (() => e.kind))(e.detail as Record<string, unknown>)}
                  <br />
                  <span className="small">{dateTime(e.created_at)}</span>
                </li>
              ))}
            </ul>
          </section>

          {mayEdit && !["completed", "cancelled"].includes(status) && (
            <section className="panel panel-quiet">
              {["in_review", "in_progress", "changes_requested"].includes(status) && (
                <ActionForm action={completeProject} submit="Mark project complete" pending="Completing" buttonClass="btn btn-small" confirm="Mark this project complete?">
                  <input type="hidden" name="id" value={p.id} />
                </ActionForm>
              )}
              {["queued", "submitted", "awaiting_approval"].includes(status) && (
                <ActionForm action={cancelProject} submit="Cancel project" pending="Cancelling" buttonClass="btn btn-small btn-danger" confirm="Cancel this project?">
                  <input type="hidden" name="id" value={p.id} />
                </ActionForm>
              )}
            </section>
          )}
          <p className="small">
            <Link href={designer ? "/studio" : staff && !role ? "/admin" : "/app/projects"}>
              Back to {designer ? "your work" : staff && !role ? "the studio queue" : "projects"}
            </Link>
          </p>
        </aside>
      </div>
    </>
  );
}
