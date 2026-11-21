// The OpenAPI document, built from the same schemas that validate requests.
import { API_VERSION, ENDPOINTS, ON_REQUEST } from "./catalogue.ts";
import { toJsonSchema, type Schema } from "./schema.ts";

export const requestSchema: Schema = {
  type: "object",
  properties: {
    service: { type: "string", enum: ON_REQUEST.map((s) => s.id), description: "Which on-request service this is for." },
    title: { type: "string", minLength: 1, maxLength: 160 },
    summary: { type: "string", minLength: 1, maxLength: 4000, description: "What is needed, in a sentence or two." },
    objective: { type: "string", maxLength: 4000 },
    audience: { type: "string", maxLength: 4000 },
    deliverables: { type: "string", maxLength: 4000, description: "One per line: item, format, size, how many." },
    messages: { type: "string", maxLength: 4000, description: "Copy and key messages, verbatim if final." },
    mandatories: { type: "string", maxLength: 4000 },
    references: { type: "string", maxLength: 4000 },
    deadline: { type: "string", format: "date" },
  },
  required: ["service", "title", "summary"],
};

const errorSchema = {
  type: "object",
  properties: {
    error: {
      type: "object",
      properties: {
        code: { type: "string" },
        message: { type: "string" },
        details: { type: "array", items: { type: "object", properties: { path: { type: "string" }, message: { type: "string" } } } },
      },
      required: ["code", "message"],
    },
  },
};

const jobSchema = {
  type: "object",
  properties: {
    id: { type: "string", format: "uuid" },
    endpoint: { type: "string" },
    status: { type: "string", enum: ["queued", "running", "succeeded", "failed"] },
    credits: { type: "integer", description: "Credits this job costs. Failed jobs cost nothing." },
    created_at: { type: "string", format: "date-time" },
    finished_at: { type: ["string", "null"], format: "date-time" },
    result: { type: "object", description: "Present when status is succeeded. Shape depends on the endpoint." },
    files: {
      type: "array",
      description: "Files made by the job. Links are signed and last 24 hours; fetch the job again for fresh ones.",
      items: { type: "object", properties: { name: { type: "string" }, mime: { type: "string" }, size: { type: "integer" }, url: { type: "string", format: "uri" } } },
    },
    error: { type: "object", description: "Present when status is failed.", properties: { code: { type: "string" }, message: { type: "string" } } },
  },
  required: ["id", "endpoint", "status"],
};

export function openapi(origin: string) {
  const errors = (codes: number[]) =>
    Object.fromEntries(codes.map((c) => [String(c), { description: { 401: "Missing or invalid API key", 402: "Monthly credits used up", 404: "Not found", 409: "Idempotency key reused for a different endpoint", 413: "Body over 1 MB", 422: "Invalid request", 429: "Too many requests this minute", 503: "Temporarily unavailable" }[c] ?? "Error", content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } } }]));
  const paths: Record<string, unknown> = {
    "/": { get: { operationId: "catalogue", summary: "List live and on-request services", security: [], responses: { "200": { description: "The catalogue" } } } },
    "/jobs": {
      get: {
        operationId: "list_jobs",
        summary: "Your most recent jobs",
        parameters: [{ name: "limit", in: "query", schema: { type: "integer", minimum: 1, maximum: 100, default: 20 } }],
        responses: { "200": { description: "Jobs, newest first, without results" }, ...errors([401]) },
      },
    },
    "/jobs/{id}": {
      get: {
        operationId: "get_job",
        summary: "A job's status, result and files",
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "string", format: "uuid" } }],
        responses: { "200": { description: "The job", content: { "application/json": { schema: { $ref: "#/components/schemas/Job" } } } }, ...errors([401, 404]) },
      },
    },
    "/ecards/{id}": {
      get: {
        operationId: "ecard_stats",
        summary: "Open counts for a card",
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "string", format: "uuid" } }],
        responses: { "200": { description: "Totals and per-recipient opens" }, ...errors([401, 404]) },
      },
    },
    "/requests": {
      post: {
        operationId: "request_service",
        summary: "Ask the studio for an on-request service",
        description: "Creates a draft brief in your Nka workspace and tells the studio. A person on your team sends it, so plan hours and prices are never committed by software.",
        requestBody: { required: true, content: { "application/json": { schema: toJsonSchema(requestSchema) } } },
        responses: { "201": { description: "The draft brief" }, ...errors([401, 422]) },
      },
    },
  };
  for (const e of ENDPOINTS) {
    paths[`/${e.path}`] = {
      post: {
        operationId: e.id,
        summary: e.title,
        description: `${e.summary}\n\nReturns: ${e.returns}\n\nCosts ${e.units} credit${e.units === 1 ? "" : "s"}.`,
        parameters: [
          { name: "wait", in: "query", schema: { type: "boolean", default: false }, description: "true: hold the connection and return the finished job (200). false: return at once (202) and poll the job or use a webhook." },
          { name: "Idempotency-Key", in: "header", schema: { type: "string", maxLength: 200 }, description: "Send the same key again and you get the first job back instead of a second one." },
          { name: "Nka-Webhook-Url", in: "header", schema: { type: "string", format: "uri" }, description: "https address to POST the finished job to. Signed with your key's webhook secret in Nka-Signature." },
        ],
        requestBody: { required: true, content: { "application/json": { schema: toJsonSchema(e.input), example: e.example } } },
        responses: {
          "200": { description: "Finished job (wait=true, or a replayed idempotency key)", content: { "application/json": { schema: { $ref: "#/components/schemas/Job" } } } },
          "202": { description: "Job accepted", content: { "application/json": { schema: { $ref: "#/components/schemas/Job" } } } },
          ...errors([401, 402, 409, 413, 422, 429, 503]),
        },
      },
    };
  }
  return {
    openapi: "3.1.0",
    info: {
      title: "Nka API",
      version: API_VERSION,
      description: "Design work for agents and platforms, from Nka Studio (MotionPlay Labs Ltd). Send a brand and a brief, get finished files back.",
    },
    servers: [{ url: `${origin}/api/v1` }],
    security: [{ bearer: [] }],
    components: {
      securitySchemes: { bearer: { type: "http", scheme: "bearer", description: "Your API key: Authorization: Bearer nka_live_..." } },
      schemas: { Job: jobSchema, Error: errorSchema },
    },
    paths,
  };
}
