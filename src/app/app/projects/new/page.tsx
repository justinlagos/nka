import Link from "next/link";
import { ActionForm } from "@/components/ActionForm";
import { BriefChat } from "@/components/BriefChat";
import { startBrief } from "../../actions";
import { canEdit, requireMembership } from "@/lib/session";
import { instantStatus } from "@/lib/instant";

export const maxDuration = 300;

export default async function NewBrief() {
  const { supabase, org, role, profile } = await requireMembership();
  if (!canEdit(role, profile.is_staff)) {
    return (
      <div className="panel">
        <h1 className="h3">You have view-only access</h1>
        <p>Ask an owner or admin in your organisation to make you a member so you can send briefs.</p>
      </div>
    );
  }
  const [{ data: book }, instant] = await Promise.all([
    supabase.from("brand_books").select("about, scanned_at").eq("org_id", org.id).maybeSingle(),
    instantStatus(supabase, org.id),
  ]);

  return (
    <div style={{ maxWidth: 760 }}>
      <div className="app-head">
        <div>
          <h1>New brief</h1>
          <p className="muted">Type it or say it. We&apos;ll ask at most two quick questions, then write the brief for you.</p>
        </div>
      </div>
      {!book?.about && !book?.scanned_at && (
        <div className="callout">
          <p>
            Tip: add your website on the <Link href="/app/brand">brand book</Link> page and every brief will use your colours,
            fonts and tone.
          </p>
        </div>
      )}
      <section className="panel">
        <BriefChat instant={instant.on} instantLeft={instant.left} />
      </section>
      <details className="panel panel-quiet">
        <summary className="link-quiet" style={{ cursor: "pointer" }}>
          Prefer a form? Fill in every field yourself
        </summary>
        <ActionForm action={startBrief} submit="Open the form" pending="Opening" buttonClass="btn btn-line">
          <input type="hidden" name="intent" value="manual" />
          <label className="field">
            <span>A one-line summary to start</span>
            <input type="text" name="request" required minLength={8} maxLength={300} />
          </label>
        </ActionForm>
      </details>
    </div>
  );
}
