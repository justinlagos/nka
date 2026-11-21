import "server-only";
import { after, NextResponse, type NextRequest } from "next/server";
import { askClaude, type ClaudePart } from "@/lib/ai";
import { scanWebsite } from "@/lib/brand-sync";
import { env, serverEnv } from "@/lib/env";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { keyHashFrom, signWebhook } from "./keys";
import { fetchPublic, resolvesPublic, UA } from "./fetch";
import { publicUrl } from "./net";
import { validate, type Issue } from "./schema";
import { endpointByPath, ENDPOINTS } from "./catalogue";
import { ApiError, type Deps, type Endpoint } from "./types";

// Everything the API routes share: reading the key, running a job, storing its files, and the
// one error shape every route returns.

const MAX_BODY = 1_000_000;
const JOB_TIMEOUT_MS = 240_000;
const STALE_MS = 10 * 60_000;

type JobRow = {
  id: string; org_id: string; key_id: string | null; endpoint: string; status: "queued" | "running" | "succeeded" | "failed";
  units: number; input: unknown; output: { result?: unknown; files?: StoredFile[] } | null; error: { code: string; message: string } | null;
  webhook_url: string | null; created_at: string; started_at: string | null; finished_at: string | null;
};
type StoredFile = { name: string; mime: string; size: number; path: string };

export function errorResponse(status: number, code: string, message: string, details?: unknown, headers?: Record<string, string>) {
  return NextResponse.json({ error: { code, message, ...(details ? { details } : {}) } }, { status, headers: { "cache-control": "no-store", ...headers } });
}

export function fromError(err: unknown) {
  if (err instanceof ApiError) return errorResponse(err.status, err.code, err.message, err.details);
  console.error("API error", err);
  return errorResponse(500, "internal_error", "Something went wrong on our side. Try again.");
}

// The address callers should see in links. Never taken from a request header an attacker controls
// when NEXT_PUBLIC_SITE_URL is set.
export function apiOrigin(request: Request): string {
  if (env.siteUrl) return env.siteUrl;
  const u = new URL(request.url);
  const host = request.headers.get("x-forwarded-host") ?? u.host;
  const proto = request.headers.get("x-forwarded-proto") ?? u.protocol.replace(":", "");
  return `${proto}://${host}`;
}

// ---------- What endpoints are given to work with ----------

export function buildDeps(origin: string, orgId: string, jobId: string): Deps {
  const hasModel = Boolean(serverEnv().anthropicKey);
  return {
    origin,
    model: hasModel
      ? (system, parts, maxTokens = 1500) =>
          askClaude(
            system,
            parts.map((p): ClaudePart => (p.type === "text" ? p : { type: "image", source: { type: "base64", media_type: p.media_type, data: p.data } })),
            maxTokens,
            90_000,
          )
      : null,
    fetchFile: fetchPublic,
    scanSite: async (url) => {
      const safe = publicUrl(url);
      if (!safe || !(await resolvesPublic(safe.hostname))) return null;
      const scan = await scanWebsite(safe.toString());
      return scan ? { company: scan.company, about: scan.about, voice: scan.voice, palette: scan.palette, fonts: scan.fonts, logoUrl: scan.logoUrl } : null;
    },
    saveCard: async (spec, recipients, expiresAt) => {
      const db = supabaseAdmin();
      const { data, error } = await db.from("ecards").insert({ org_id: orgId, job_id: jobId, spec, expires_at: expiresAt }).select("id").single();
      if (error || !data) throw new Error(`Card couldn't be saved: ${error?.message}`);
      const rows = recipients.map((r) => ({ ...r, ecard_id: data.id }));
      const { error: e2 } = await db.from("ecard_recipients").insert(rows);
      if (e2) {
        await db.from("ecards").delete().eq("id", data.id);
        throw new Error(`Card recipients couldn't be saved: ${e2.message}`);
      }
      return data.id as string;
    },
  };
}

// ---------- Keys ----------

export type Caller = { key_id: string; org_id: string; created_by: string | null; monthly_credits: number; credits_used: number };

export function keyHash(request: Request): string {
  const hash = keyHashFrom(request.headers.get("authorization"), request.headers.get("x-api-key"));
  if (!hash) throw new ApiError(401, "invalid_key", "Send your API key as: Authorization: Bearer nka_live_...");
  return hash;
}

export async function authenticate(request: Request): Promise<Caller> {
  const hash = keyHash(request);
  const { data, error } = await supabaseAdmin().rpc("api_auth", { p_key_hash: hash });
  if (error) throw new Error(error.message);
  if (!data) throw new ApiError(401, "invalid_key", "That API key isn't valid, has been revoked, or the API is switched off for its workspace.");
  return data as Caller;
}

const BEGIN_ERRORS: Record<string, [number, string]> = {
  invalid_key: [401, "That API key isn't valid or has been revoked."],
  api_disabled: [403, "The API is switched off for this workspace. Ask Nka to turn it on."],
  rate_limited: [429, "Too many requests in the last minute. Wait and try again."],
  quota_exceeded: [402, "This month's credits are used up. Ask Nka to raise the limit."],
  idempotency_mismatch: [409, "That Idempotency-Key was already used for a different endpoint."],
};

// ---------- Jobs ----------

export async function presentJob(row: JobRow, withResult = true) {
  const db = supabaseAdmin();
  let job = row;
  // A job whose server died mid-run would sit at "running" for ever. Close it so callers can retry.
  if ((job.status === "queued" || job.status === "running") && Date.now() - new Date(job.created_at).getTime() > STALE_MS) {
    const error = { code: "timed_out", message: "The job didn't finish. It wasn't charged. Send it again." };
    const { data } = await db.from("api_jobs").update({ status: "failed", error, finished_at: new Date().toISOString() }).eq("id", job.id).in("status", ["queued", "running"]).select("*").maybeSingle();
    if (data) job = data as JobRow;
  }
  const base = {
    id: job.id,
    endpoint: job.endpoint,
    status: job.status,
    credits: job.status === "failed" ? 0 : job.units,
    created_at: job.created_at,
    finished_at: job.finished_at,
  };
  if (!withResult) return base;
  if (job.status === "failed") return { ...base, error: job.error ?? { code: "internal_error", message: "The job failed." } };
  if (job.status !== "succeeded") return base;
  const stored = job.output?.files ?? [];
  let files: { name: string; mime: string; size: number; url: string | null }[] = [];
  if (stored.length) {
    const { data } = await db.storage.from("api").createSignedUrls(stored.map((f) => f.path), 86_400);
    files = stored.map((f, i) => ({ name: f.name, mime: f.mime, size: f.size, url: data?.[i]?.signedUrl ?? null }));
  }
  return { ...base, result: job.output?.result ?? {}, files };
}

async function sendWebhook(job: JobRow, body: Record<string, unknown>) {
  if (!job.webhook_url || !job.key_id) return;
  const db = supabaseAdmin();
  const target = publicUrl(job.webhook_url);
  let status = "blocked";
  if (target && target.protocol === "https:" && (await resolvesPublic(target.hostname))) {
    const { data: key } = await db.from("api_keys").select("webhook_secret").eq("id", job.key_id).maybeSingle();
    const payload = JSON.stringify({ type: "job.finished", job: body });
    status = "failed";
    for (let attempt = 0; key && attempt < 2 && status !== "delivered"; attempt++) {
      try {
        const res = await fetch(target, {
          method: "POST",
          redirect: "manual",
          headers: { "content-type": "application/json", "user-agent": UA, "nka-signature": signWebhook(key.webhook_secret, payload, Math.floor(Date.now() / 1000)) },
          body: payload,
          signal: AbortSignal.timeout(8_000),
        });
        status = res.ok ? "delivered" : `failed_${res.status}`;
      } catch {
        status = "failed";
      }
    }
  }
  await db.from("api_jobs").update({ webhook_status: status }).eq("id", job.id);
}

const FILE_NAME = /^[a-z0-9][a-z0-9._-]{0,120}$/;

// Runs a queued job to the end. Never throws: the outcome is written to the job.
export async function runJob(jobId: string, origin: string): Promise<JobRow | null> {
  const db = supabaseAdmin();
  const { data: claimed } = await db.from("api_jobs").update({ status: "running", started_at: new Date().toISOString() }).eq("id", jobId).eq("status", "queued").select("*").maybeSingle();
  if (!claimed) {
    const { data } = await db.from("api_jobs").select("*").eq("id", jobId).maybeSingle();
    return (data as JobRow) ?? null;
  }
  const job = claimed as JobRow;
  const endpoint = ENDPOINTS.find((e) => e.id === job.endpoint);
  let patch: Record<string, unknown>;
  try {
    if (!endpoint) throw new ApiError(500, "internal_error", "Unknown endpoint.");
    let timer: ReturnType<typeof setTimeout> | undefined;
    const timeout = new Promise<never>((_, reject) => {
      timer = setTimeout(() => reject(new ApiError(504, "timed_out", "The job took too long. It wasn't charged. Try a smaller request.")), JOB_TIMEOUT_MS);
    });
    const out = await Promise.race([endpoint.run(job.input as never, buildDeps(origin, job.org_id, job.id)), timeout]).finally(() => clearTimeout(timer));
    const files: StoredFile[] = [];
    for (const f of out.files) {
      if (!FILE_NAME.test(f.name)) throw new Error(`Bad file name: ${f.name}`);
      const bytes = typeof f.data === "string" ? new TextEncoder().encode(f.data) : f.data;
      const path = `${job.org_id}/${job.id}/${f.name}`;
      const { error } = await db.storage.from("api").upload(path, bytes, { contentType: f.mime, upsert: true });
      if (error) throw new Error(`File couldn't be stored: ${error.message}`);
      files.push({ name: f.name, mime: f.mime.split(";")[0], size: bytes.byteLength, path });
    }
    patch = { status: "succeeded", output: { result: out.result, files }, finished_at: new Date().toISOString() };
  } catch (err) {
    const known = err instanceof ApiError;
    if (!known) console.error("API job failed", job.id, job.endpoint, err);
    patch = {
      status: "failed",
      error: known ? { code: err.code, message: err.message, ...(err.details ? { details: err.details } : {}) } : { code: "internal_error", message: "The job failed on our side. It wasn't charged. Try again." },
      finished_at: new Date().toISOString(),
    };
  }
  const { data: done } = await db.from("api_jobs").update(patch).eq("id", job.id).select("*").maybeSingle();
  const final = (done as JobRow) ?? { ...job, ...(patch as Partial<JobRow>) };
  if (final.webhook_url) await sendWebhook(final, await presentJob(final)).catch((e) => console.error("Webhook error", e));
  return final;
}

export async function readJson(request: Request): Promise<unknown> {
  if (!/application\/json/i.test(request.headers.get("content-type") ?? "")) {
    throw new ApiError(415, "unsupported_media_type", "Send JSON with Content-Type: application/json.");
  }
  if (Number(request.headers.get("content-length") ?? 0) > MAX_BODY) throw new ApiError(413, "too_large", "The request body is over 1 MB.");
  const text = await request.text();
  if (text.length > MAX_BODY) throw new ApiError(413, "too_large", "The request body is over 1 MB.");
  try {
    return JSON.parse(text);
  } catch {
    throw new ApiError(400, "invalid_json", "The request body isn't valid JSON.");
  }
}

export function invalid(issues: Issue[]): ApiError {
  return new ApiError(422, "invalid_request", `${issues[0].path} ${issues[0].message}${issues.length > 1 ? ` (and ${issues.length - 1} more)` : ""}.`, issues);
}

type Begin = { job: JobRow; replayed: boolean };

export async function beginJob(hash: string, endpointId: string, units: number, input: unknown, idempotencyKey: string | null, webhookUrl: string | null): Promise<Begin> {
  const { data, error } = await supabaseAdmin().rpc("api_begin_job", {
    p_key_hash: hash, p_endpoint: endpointId, p_units: units, p_input: input, p_idempotency_key: idempotencyKey, p_webhook_url: webhookUrl,
  });
  if (error) throw new Error(error.message);
  const out = data as { error?: string; job?: JobRow; replayed?: boolean };
  if (out.error || !out.job) {
    const [status, message] = BEGIN_ERRORS[out.error ?? ""] ?? [500, "The job couldn't be started."];
    throw new ApiError(status, out.error ?? "internal_error", message);
  }
  return { job: out.job, replayed: Boolean(out.replayed) };
}

// Checks a request and starts its job. Shared by the HTTP routes and the MCP server.
export async function startJob(request: Request, endpoint: Endpoint, body: unknown): Promise<Begin> {
  const hash = keyHash(request);
  const checked = validate<Record<string, unknown>>(endpoint.input, body);
  if (!checked.ok) throw invalid(checked.issues);
  const idem = request.headers.get("idempotency-key")?.trim() || null;
  if (idem && idem.length > 200) throw new ApiError(422, "invalid_request", "Idempotency-Key is too long (200 characters at most).");
  const hook = request.headers.get("nka-webhook-url")?.trim() || null;
  if (hook) {
    const u = publicUrl(hook);
    if (!u || u.protocol !== "https:" || hook.length > 500) throw new ApiError(422, "invalid_request", "Nka-Webhook-Url must be a public https address.");
  }
  return beginJob(hash, endpoint.id, endpoint.units, checked.value, idem, hook);
}

// POST /api/v1/<endpoint>
export async function handleRun(request: NextRequest, path: string) {
  try {
    const endpoint = endpointByPath(path);
    if (!endpoint) return errorResponse(404, "not_found", "No such endpoint.");
    keyHash(request); // fail on a missing key before reading the body
    const body = await readJson(request);
    const { job, replayed } = await startJob(request, endpoint, body);
    const origin = apiOrigin(request);
    const wait = ["1", "true"].includes(request.nextUrl.searchParams.get("wait") ?? "") || /\bwait\b/i.test(request.headers.get("prefer") ?? "");
    const headers = { "cache-control": "no-store", location: `${origin}/api/v1/jobs/${job.id}`, ...(replayed ? { "idempotent-replayed": "true" } : {}) };
    if (replayed) return NextResponse.json(await presentJob(job), { status: 200, headers });
    if (wait) {
      const done = await runJob(job.id, origin);
      return NextResponse.json(await presentJob(done ?? job), { status: 200, headers });
    }
    after(() => runJob(job.id, origin));
    return NextResponse.json(await presentJob(job), { status: 202, headers });
  } catch (err) {
    const res = fromError(err);
    if (err instanceof ApiError && err.status === 429) res.headers.set("retry-after", "60");
    if (err instanceof ApiError && err.status === 401) res.headers.set("www-authenticate", 'Bearer realm="nka"');
    return res;
  }
}

export async function findJob(caller: Caller, id: string) {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) throw new ApiError(404, "not_found", "No such job.");
  const { data } = await supabaseAdmin().from("api_jobs").select("*").eq("id", id).eq("org_id", caller.org_id).maybeSingle();
  if (!data) throw new ApiError(404, "not_found", "No such job.");
  return presentJob(data as JobRow);
}
