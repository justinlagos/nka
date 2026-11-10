"use client";
import { useState, useTransition, type MouseEvent } from "react";
import { useRouter } from "next/navigation";
import { addComment, decideFile, setResolved } from "@/app/app/actions";
import { StatusPill } from "@/components/StatusPill";
import { dateTime, fileSize, initials } from "@/lib/format";

export type ReviewComment = {
  id: string;
  body: string;
  authorName: string;
  authorStaff: boolean;
  // Overrides the " (Nka)" note after the name, e.g. on the admin screen.
  authorTag?: string;
  createdAt: string;
  pinX: number | null;
  pinY: number | null;
  resolved: boolean;
};

export type ReviewDeliverable = {
  id: string;
  title: string;
  version: number;
  status: string;
  mime: string;
  fileName: string;
  size: number;
  note: string;
  url: string | null;
  createdAt: string;
};

const DELIVERABLE_STATUS: Record<string, string> = {
  in_review: "in_review",
  changes_requested: "changes_requested",
  approved: "completed",
};

export function ReviewFile({
  d,
  older,
  comments,
  projectId,
  orgId,
  canComment,
  canDecide,
}: {
  d: ReviewDeliverable;
  older: { id: string; version: number; url: string | null; status: string }[];
  comments: ReviewComment[];
  projectId: string;
  orgId: string;
  canComment: boolean;
  canDecide: boolean;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [pin, setPin] = useState<{ x: number; y: number } | null>(null);
  const [text, setText] = useState("");
  const [changes, setChanges] = useState(false);
  const [changeNote, setChangeNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const isImage = d.mime.startsWith("image/");
  const isPdf = d.mime === "application/pdf";
  const pinned = comments.filter((c) => c.pinX !== null && c.pinY !== null);

  function place(e: MouseEvent<HTMLDivElement>) {
    if (!canComment) return;
    const rect = e.currentTarget.getBoundingClientRect();
    setPin({ x: (e.clientX - rect.left) / rect.width, y: (e.clientY - rect.top) / rect.height });
  }

  function run(fn: () => Promise<{ ok?: boolean; error?: string }>, after?: () => void) {
    setError(null);
    start(async () => {
      const res = await fn();
      if (!res.ok) setError(res.error ?? "That didn't work.");
      else {
        after?.();
        router.refresh();
      }
    });
  }

  return (
    <article className="file" aria-labelledby={`f-${d.id}`}>
      <div className="file-head">
        <div>
          <h3 id={`f-${d.id}`}>
            {d.title} <span className="muted small">v{d.version}</span>
          </h3>
          <div className="small muted">
            {d.fileName}, {fileSize(d.size)}, added {dateTime(d.createdAt)}
          </div>
        </div>
        <div className="inline-actions">
          <StatusPill status={DELIVERABLE_STATUS[d.status] ?? d.status} />
          {d.url && (
            <a className="btn btn-small btn-line" href={d.url} target="_blank" rel="noreferrer" download={d.fileName}>
              Download
            </a>
          )}
        </div>
      </div>
      <div className="file-body">
        {d.note && <p className="small">Studio note: {d.note}</p>}
        {d.url && isImage ? (
          <>
            <div
              className="stage-img"
              onClick={place}
              role={canComment ? "button" : undefined}
              aria-label={canComment ? "Click on the image to place a comment" : undefined}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={d.url} alt={d.title} draggable={false} />
              {pinned.map((c, i) => (
                <button
                  type="button"
                  key={c.id}
                  className={`pin ${c.resolved ? "resolved" : ""}`}
                  style={{ left: `${(c.pinX ?? 0) * 100}%`, top: `${(c.pinY ?? 0) * 100}%` }}
                  title={c.body}
                  onClick={(e) => {
                    e.stopPropagation();
                    document.getElementById(`c-${c.id}`)?.scrollIntoView({ behavior: "smooth", block: "center" });
                  }}
                >
                  {i + 1}
                </button>
              ))}
              {pin && (
                <span className="pin draft" style={{ left: `${pin.x * 100}%`, top: `${pin.y * 100}%` }} aria-hidden="true">
                  +
                </span>
              )}
            </div>
            {canComment && <p className="small muted">Click on the image to pin a comment to that spot.</p>}
          </>
        ) : d.url && isPdf ? (
          <iframe className="pdf-frame" src={d.url} title={d.title} />
        ) : (
          <p className="muted">Preview isn&apos;t available for this file type. Download it to review.</p>
        )}

        {older.length > 0 && (
          <div className="version-list" style={{ margin: "10px 0" }}>
            <span className="muted">Earlier versions:</span>
            {older.map((o) =>
              o.url ? (
                <a key={o.id} href={o.url} target="_blank" rel="noreferrer">
                  v{o.version}
                </a>
              ) : (
                <span key={o.id}>v{o.version}</span>
              ),
            )}
          </div>
        )}

        {comments.length > 0 && (
          <div className="comments" style={{ marginTop: 16 }}>
            {comments.map((c) => {
              const n = pinned.findIndex((p) => p.id === c.id);
              return (
                <div key={c.id} id={`c-${c.id}`} className={`comment ${c.resolved ? "resolved" : ""}`}>
                  <span className={`avatar ${c.authorStaff ? "staff" : ""}`} aria-hidden="true">
                    {initials(c.authorName)}
                  </span>
                  <div>
                    <div className="comment-meta">
                      <b>{c.authorName}</b>
                      {c.authorTag ?? (c.authorStaff ? " (Nka)" : "")}, {dateTime(c.createdAt)}
                      {n >= 0 ? `, pin ${n + 1}` : ""}
                    </div>
                    <p className="comment-body">{c.body}</p>
                    {canComment && (
                      <button
                        type="button"
                        className="link-quiet small"
                        style={{ background: "none", border: 0, padding: 0, cursor: "pointer", textDecoration: "underline" }}
                        disabled={pending}
                        onClick={() => run(() => setResolved({ commentId: c.id, projectId, resolved: !c.resolved }))}
                      >
                        {c.resolved ? "Reopen" : "Mark resolved"}
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {canComment && (
          <div style={{ marginTop: 16 }}>
            <label className="field" style={{ marginBottom: 8 }}>
              <span>{pin ? "Comment at the pin" : "Comment on this file"}</span>
              <textarea rows={2} value={text} onChange={(e) => setText(e.target.value)} maxLength={5000} />
            </label>
            <div className="inline-actions">
              <button
                type="button"
                className="btn btn-small btn-ink"
                disabled={pending || !text.trim()}
                onClick={() =>
                  run(
                    () =>
                      addComment({ projectId, orgId, deliverableId: d.id, body: text, pinX: pin?.x ?? null, pinY: pin?.y ?? null }),
                    () => {
                      setText("");
                      setPin(null);
                    },
                  )
                }
              >
                Add comment
              </button>
              {pin && (
                <button type="button" className="btn btn-small btn-line" onClick={() => setPin(null)}>
                  Remove pin
                </button>
              )}
            </div>
          </div>
        )}

        {canDecide && d.status === "in_review" && (
          <div className="callout" style={{ marginTop: 18 }}>
            <p style={{ marginBottom: 10 }}>
              <b>Your decision on v{d.version}</b>
            </p>
            {!changes ? (
              <div className="inline-actions">
                <button
                  type="button"
                  className="btn btn-small"
                  disabled={pending}
                  onClick={() => run(() => decideFile({ deliverableId: d.id, projectId, decision: "approved", note: "" }))}
                >
                  Approve
                </button>
                <button type="button" className="btn btn-small btn-line" onClick={() => setChanges(true)}>
                  Request changes
                </button>
              </div>
            ) : (
              <>
                <label className="field">
                  <span>What needs to change?</span>
                  <textarea rows={3} value={changeNote} onChange={(e) => setChangeNote(e.target.value)} maxLength={5000} />
                </label>
                <div className="inline-actions">
                  <button
                    type="button"
                    className="btn btn-small"
                    disabled={pending || !changeNote.trim()}
                    onClick={() =>
                      run(
                        () => decideFile({ deliverableId: d.id, projectId, decision: "changes_requested", note: changeNote }),
                        () => {
                          setChanges(false);
                          setChangeNote("");
                        },
                      )
                    }
                  >
                    Send changes
                  </button>
                  <button type="button" className="btn btn-small btn-line" onClick={() => setChanges(false)}>
                    Back
                  </button>
                </div>
              </>
            )}
          </div>
        )}
        {error && (
          <p className="form-result is-error" role="alert">
            {error}
          </p>
        )}
      </div>
    </article>
  );
}
