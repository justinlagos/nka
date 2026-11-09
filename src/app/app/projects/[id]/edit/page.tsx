import { notFound, redirect } from "next/navigation";
import { ActionForm } from "@/components/ActionForm";
import { Uploader } from "@/components/Uploader";
import { deleteDraft, removeAttachment, saveBrief } from "../../../actions";
import { requireProfile, getMemberships } from "@/lib/session";
import { BRIEF_FIELDS, SERVICE_OPTIONS, normaliseBrief } from "@/lib/brief";
import { fileSize, projectRef } from "@/lib/format";

export default async function EditBrief({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ drafted?: string }>;
}) {
  const { id } = await params;
  const { drafted } = await searchParams;
  const { supabase } = await requireProfile();
  const { data: p } = await supabase
    .from("projects")
    .select("id, number, org_id, title, service, status, brief, deadline, kickoff_call, allow_ai, auto_approve, org:orgs(plan)")
    .eq("id", id)
    .maybeSingle();
  if (!p) notFound();
  if (p.status !== "draft") redirect(`/app/projects/${id}`);

  const memberships = await getMemberships();
  const plan = (p.org as unknown as { plan: string } | null)?.plan ?? "none";
  const onPlan = ["starter", "growth", "studio"].includes(plan);
  const brief = normaliseBrief(p.brief);
  const { data: files } = await supabase
    .from("attachments")
    .select("id, file_name, size")
    .eq("project_id", id)
    .order("created_at");
  const isMember = memberships.some((m) => m.org.id === p.org_id);

  return (
    <div style={{ maxWidth: 820 }}>
      <div className="app-head">
        <div>
          <p className="muted small" style={{ margin: 0 }}>
            {projectRef(p.number)}, draft
          </p>
          <h1>Check your brief</h1>
          <p className="muted">
            {drafted
              ? "Here's the brief laid out from what you wrote. Fix anything that's off, answer what you can under open questions, then send it."
              : "Fill in what you know. The studio will ask about the rest."}
          </p>
        </div>
      </div>

      <section className="panel">
        <ActionForm action={saveBrief} submit="Send to the studio" pending="Working" submitValue="send" secondary={{ label: "Save draft", value: "save" }}>
          <input type="hidden" name="id" value={p.id} />
          <label className="field">
            <span>Project title</span>
            <input type="text" name="title" defaultValue={p.title} required maxLength={200} />
          </label>
          <div className="row-2">
            <label className="field">
              <span>Type of work</span>
              <select name="service" defaultValue={p.service}>
                {SERVICE_OPTIONS.map((s) => (
                  <option key={s.value} value={s.value}>
                    {s.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="field">
              <span>Final files needed by</span>
              <input type="date" name="deadline" defaultValue={p.deadline ?? ""} />
            </label>
          </div>
          {BRIEF_FIELDS.map((f) => (
            <label className="field" key={f.key}>
              <span>{f.label}</span>
              <span className="hint">{f.hint}</span>
              <textarea name={f.key} rows={f.rows} defaultValue={brief[f.key]} maxLength={4000} required={f.key === "summary"} />
            </label>
          ))}
          <label className="check">
            <input type="checkbox" name="kickoff_call" defaultChecked={p.kickoff_call} />
            <span>I&apos;d like a short kickoff call before work starts.</span>
          </label>
          <label className="check">
            <input type="checkbox" name="allow_ai" defaultChecked={p.allow_ai} />
            <span>The studio may use AI tools on this project (for example early concepts or resizing). Every file is still made and checked by a person.</span>
          </label>
          {!onPlan && (
            <label className="check">
              <input type="checkbox" name="auto_approve" defaultChecked={p.auto_approve} />
              <span>Start work as soon as the estimate is ready, without waiting for my approval.</span>
            </label>
          )}
        </ActionForm>
      </section>

      {isMember && (
        <section className="panel">
          <h2>References and files</h2>
          <p className="muted small">Copy documents, logos, photos, examples you like. They stay private to your organisation and the studio.</p>
          {files && files.length > 0 && (
            <ul className="list" style={{ marginBottom: 14 }}>
              {files.map((f) => (
                <li key={f.id} className="inline-actions" style={{ justifyContent: "space-between", padding: "8px 0" }}>
                  <span>
                    {f.file_name} <span className="muted small">{fileSize(f.size)}</span>
                  </span>
                  <form action={removeAttachment}>
                    <input type="hidden" name="id" value={f.id} />
                    <input type="hidden" name="back" value={`/app/projects/${p.id}/edit`} />
                    <button className="btn btn-small btn-line" type="submit">
                      Remove
                    </button>
                  </form>
                </li>
              ))}
            </ul>
          )}
          <Uploader orgId={p.org_id} projectId={p.id} kind="reference" />
        </section>
      )}

      <form action={deleteDraft} style={{ marginTop: 18 }}>
        <input type="hidden" name="id" value={p.id} />
        <button type="submit" className="btn btn-small btn-danger">
          Delete draft
        </button>
      </form>
    </div>
  );
}
