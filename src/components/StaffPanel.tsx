import { ActionForm } from "@/components/ActionForm";
import { DeliverableUploader } from "@/components/DeliverableUploader";
import { assign, sendEstimate, setStatus } from "@/app/admin/actions";
import { supabaseServer } from "@/lib/supabase/server";

const STATUS_CHOICES = [
  ["submitted", "Brief received"],
  ["in_progress", "In production"],
  ["in_review", "Ready for review"],
  ["changes_requested", "Changes requested"],
  ["completed", "Completed"],
  ["cancelled", "Cancelled"],
] as const;

export async function StaffPanel({
  project,
  staff,
}: {
  project: { id: string; orgId: string; status: string; assignee: string | null; plan: string; currency: string };
  staff: { id: string; full_name: string; email: string }[];
}) {
  const supabase = await supabaseServer();
  const { data } = await supabase.from("deliverables").select("title").eq("project_id", project.id);
  const titles = [...new Set((data ?? []).map((d) => d.title as string))];
  const onPlan = ["starter", "growth", "studio"].includes(project.plan);

  return (
    <section className="panel" style={{ borderColor: "var(--ochre)", borderWidth: 2 }}>
      <h2>Studio controls</h2>

      {["submitted", "awaiting_approval"].includes(project.status) && (
        <details open={project.status === "submitted"} style={{ marginBottom: 14 }}>
          <summary className="label" style={{ cursor: "pointer" }}>
            {project.status === "awaiting_approval" ? "Revise estimate" : "Send estimate"}
          </summary>
          <ActionForm action={sendEstimate} submit={onPlan ? "Confirm and start" : "Send estimate"} pending="Sending" buttonClass="btn btn-small">
            <input type="hidden" name="id" value={project.id} />
            {onPlan ? (
              <p className="small muted">Plan client: the amount isn&apos;t charged; work starts as soon as you confirm.</p>
            ) : (
              <label className="field">
                <span>Amount ({project.currency.toUpperCase()})</span>
                <input type="number" name="amount" min={0} step="0.01" required />
              </label>
            )}
            <div className="row-2">
              <label className="field">
                <span>Hours</span>
                <input type="number" name="hours" min={0} step="0.5" />
              </label>
              <label className="field">
                <span>Delivery date</span>
                <input type="date" name="due" required />
              </label>
            </div>
            <label className="field">
              <span>Scope and notes</span>
              <textarea name="notes" rows={3} maxLength={4000} placeholder="What's included, rounds of changes, assumptions" />
            </label>
          </ActionForm>
        </details>
      )}

      {!["draft", "queued", "cancelled"].includes(project.status) && (
        <details open={["in_progress", "changes_requested"].includes(project.status)} style={{ marginBottom: 14 }}>
          <summary className="label" style={{ cursor: "pointer" }}>
            Upload a file for review
          </summary>
          <DeliverableUploader projectId={project.id} orgId={project.orgId} titles={titles} />
        </details>
      )}

      <details style={{ marginBottom: 14 }}>
        <summary className="label" style={{ cursor: "pointer" }}>
          Assign designer
        </summary>
        <ActionForm action={assign} submit="Assign" pending="Saving" buttonClass="btn btn-small btn-line">
          <input type="hidden" name="id" value={project.id} />
          <label className="field">
            <span className="skip">Designer</span>
            <select name="user" defaultValue={project.assignee ?? ""}>
              <option value="">Unassigned</option>
              {staff.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.full_name || s.email}
                </option>
              ))}
            </select>
          </label>
        </ActionForm>
      </details>

      <details>
        <summary className="label" style={{ cursor: "pointer" }}>
          Change stage
        </summary>
        <ActionForm action={setStatus} submit="Update" pending="Saving" buttonClass="btn btn-small btn-line">
          <input type="hidden" name="id" value={project.id} />
          <label className="field">
            <span className="skip">Stage</span>
            <select name="status" defaultValue={project.status}>
              {STATUS_CHOICES.map(([v, l]) => (
                <option key={v} value={v}>
                  {l}
                </option>
              ))}
            </select>
          </label>
        </ActionForm>
      </details>
    </section>
  );
}
