import Link from "next/link";
import { ActionForm } from "@/components/ActionForm";
import { startBrief } from "../../actions";
import { canEdit, requireMembership } from "@/lib/session";
import { SERVICE_OPTIONS } from "@/lib/brief";

export default async function NewBrief() {
  const { supabase, org, role, profile } = await requireMembership();
  const { data: book } = await supabase.from("brand_books").select("about, voice, colours").eq("org_id", org.id).maybeSingle();
  const bookEmpty = !book?.about && !book?.voice && !book?.colours;

  if (!canEdit(role, profile.is_staff)) {
    return (
      <div className="panel">
        <h1 className="h3">You have view-only access</h1>
        <p>Ask an owner or admin in your organisation to make you a member so you can send briefs.</p>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 760 }}>
      <div className="app-head">
        <div>
          <h1>New brief</h1>
          <p className="muted">Say what you need the way you&apos;d say it to a designer. You&apos;ll see and edit the full brief next.</p>
        </div>
      </div>
      {bookEmpty && (
        <div className="callout">
          <p>
            Your <Link href="/app/brand">brand book</Link> is empty. Fill it in and drafted briefs will use your colours,
            audiences and tone.
          </p>
        </div>
      )}
      <section className="panel composer">
        <ActionForm action={startBrief} submit="Draft my brief" pending="Drafting">
          <input type="hidden" name="intent" value="draft" />
          <label className="field">
            <span>What do you need?</span>
            <textarea
              name="request"
              className="big"
              required
              minLength={8}
              maxLength={4000}
              placeholder="We're at Moonshot in Lagos on 14 October. We need the booth (3 m x 3 m, L-shaped), two roll-ups, and a loop for the screen. Copy attached."
            />
          </label>
          <div className="row-2">
            <label className="field">
              <span>Type of work</span>
              <select name="service" defaultValue="">
                {SERVICE_OPTIONS.map((s) => (
                  <option key={s.value} value={s.value}>
                    {s.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="field">
              <span>Final files needed by</span>
              <input type="date" name="deadline" />
            </label>
          </div>
        </ActionForm>
      </section>
      <section className="panel panel-quiet">
        <ActionForm action={startBrief} submit="Write the brief myself" pending="Opening" buttonClass="btn btn-line">
          <input type="hidden" name="intent" value="manual" />
          <label className="field">
            <span>Prefer to fill in every field yourself? Start with a one-line summary.</span>
            <input type="text" name="request" required minLength={8} maxLength={300} />
          </label>
        </ActionForm>
      </section>
    </div>
  );
}
