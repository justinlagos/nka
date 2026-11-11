import { ActionForm } from "@/components/ActionForm";
import { reviewVersion } from "@/app/admin/actions";
import { dateTime } from "@/lib/format";

export type QueueItem = {
  id: string;
  title: string;
  version: number;
  status: string;
  note: string;
  review_note?: string;
  created_at: string;
  url: string | null;
  maker: string;
};

// Versions waiting for Nka review, and ones sent back. Only the admin and the client's creative lead
// (from another agency) can pass a version; the client never sees this box.
export function ReviewQueue({ items, canReview }: { items: QueueItem[]; canReview: boolean }) {
  const waiting = items.filter((d) => d.status === "internal_review");
  const returned = items.filter((d) => d.status === "returned");
  if (!waiting.length && !returned.length) return null;
  return (
    <section className="panel">
      <h2>Nka review</h2>
      <p className="small muted">
        The client sees a version only after it passes. Check it against the brief and the brand book; reject generic or unedited AI
        work.
      </p>
      {waiting.map((d) => (
        <div key={d.id} className="review-item" style={{ borderTop: "1px solid var(--rule)", paddingTop: 12, marginTop: 12 }}>
          <p style={{ margin: 0 }}>
            <b>
              {d.title} v{d.version}
            </b>{" "}
            <span className="small muted">
              from {d.maker}, {dateTime(d.created_at)}
            </span>
          </p>
          {d.note && <p className="small">{d.note}</p>}
          {d.url && (
            <p className="small">
              <a href={d.url} target="_blank" rel="noreferrer">
                Open the file
              </a>
            </p>
          )}
          {canReview ? (
            <div className="grid-2" style={{ marginTop: 8 }}>
              <ActionForm action={reviewVersion} submit="Pass to the client" pending="Passing" buttonClass="btn btn-small">
                <input type="hidden" name="id" value={d.id} />
                <input type="hidden" name="decision" value="release" />
                <label className="field">
                  <span>Minutes spent reviewing</span>
                  <input type="number" name="minutes" min={0} max={600} inputMode="numeric" />
                </label>
              </ActionForm>
              <ActionForm action={reviewVersion} submit="Send back" pending="Sending" buttonClass="btn btn-small btn-line">
                <input type="hidden" name="id" value={d.id} />
                <input type="hidden" name="decision" value="return" />
                <label className="field">
                  <span>What to fix (the client won&apos;t see this)</span>
                  <textarea name="note" rows={2} required maxLength={2000} />
                </label>
                <label className="field">
                  <span>Minutes spent reviewing</span>
                  <input type="number" name="minutes" min={0} max={600} inputMode="numeric" />
                </label>
              </ActionForm>
            </div>
          ) : (
            <p className="small muted">Waiting for Nka review. The client hasn&apos;t seen it yet.</p>
          )}
        </div>
      ))}
      {returned.length > 0 && (
        <details style={{ marginTop: 12 }}>
          <summary className="small">Sent back ({returned.length})</summary>
          <ul className="small">
            {returned.map((d) => (
              <li key={d.id}>
                {d.title} v{d.version}: {d.review_note}
              </li>
            ))}
          </ul>
        </details>
      )}
    </section>
  );
}
