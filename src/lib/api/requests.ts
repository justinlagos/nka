import "server-only";
import { normaliseBrief } from "@/lib/brief";
import { notifyClient, notifyStudio } from "@/lib/notify";
import { projectRef } from "@/lib/format";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { ON_REQUEST } from "./catalogue";
import { requestSchema } from "./openapi";
import { validate } from "./schema";
import { beginJob, invalid } from "./server";
import { ApiError } from "./types";

type RequestInput = {
  service: string; title: string; summary: string; objective?: string; audience?: string;
  deliverables?: string; messages?: string; mandatories?: string; references?: string; deadline?: string;
};

// On-request work: files a draft brief in the caller's Nka workspace and tells the studio and the
// client's team. It stays a draft on purpose. Sending a brief can spend plan hours or start a
// priced estimate, and that is a person's decision, not an API call's.
export async function createRequest(keyHash: string, body: unknown, idempotencyKey: string | null, origin: string) {
  const checked = validate<RequestInput>(requestSchema, body);
  if (!checked.ok) throw invalid(checked.issues);
  const input = checked.value;
  const service = ON_REQUEST.find((s) => s.id === input.service);
  if (!service) throw new ApiError(422, "invalid_request", "Unknown service.");

  // Recorded as a zero-credit job, so requests share the key check, rate limit and idempotency.
  const { job, replayed } = await beginJob(keyHash, "request", 0, input, idempotencyKey, null);
  if (replayed && job.output?.result) return job.output.result;

  const db = supabaseAdmin();
  const { data: key } = job.key_id ? await db.from("api_keys").select("created_by").eq("id", job.key_id).maybeSingle() : { data: null };
  const brief = normaliseBrief({
    summary: input.summary,
    objective: input.objective,
    audience: input.audience,
    deliverables: input.deliverables,
    messages: input.messages,
    mandatories: input.mandatories,
    references: input.references,
    questions: `Requested through the API: ${service.title}.`,
  });
  const { data: project, error } = await db
    .from("projects")
    .insert({ org_id: job.org_id, title: input.title, service: service.service, brief, deadline: input.deadline ?? null, created_by: key?.created_by ?? null })
    .select("id, number, status")
    .single();
  if (error || !project) {
    await db.from("api_jobs").update({ status: "failed", error: { code: "internal_error", message: "The request couldn't be filed." }, finished_at: new Date().toISOString() }).eq("id", job.id);
    throw new Error(error?.message ?? "Request insert failed");
  }
  const result = {
    request_id: project.id,
    reference: projectRef(project.number),
    service: service.id,
    status: "draft",
    url: `${origin}/app/projects/${project.id}`,
    next: "A person on your team opens the brief in Nka and sends it. The studio then confirms the date and any price.",
  };
  await db.from("api_jobs").update({ status: "succeeded", output: { result, files: [] }, finished_at: new Date().toISOString() }).eq("id", job.id);
  await Promise.all([
    notifyStudio(`API request: ${service.title}`, [`${projectRef(project.number)} ${input.title}`, input.summary.slice(0, 400), `${origin}/admin/projects/${project.id}`]),
    notifyClient(job.org_id, {
      origin,
      subject: `A brief arrived through the API: ${input.title}`,
      heading: "A brief is waiting to be sent",
      lines: [`${projectRef(project.number)} ${input.title}`, `It was filed through your API key as "${service.title}". Check it and send it when you're ready.`],
      path: `/app/projects/${project.id}`,
      button: "Open the brief",
    }),
  ]);
  return result;
}
