import { NextResponse, type NextRequest } from "next/server";
import { createHash } from "node:crypto";
import { serverEnv, env } from "@/lib/env";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { custardSignatureValid, readIdentity } from "@/lib/custard-sign";
import { notifyStudio } from "@/lib/notify";

export const dynamic = "force-dynamic";

const json = (body: unknown, status = 200) => NextResponse.json(body, { status });
const text = (v: unknown, max: number) => (typeof v === "string" ? v.slice(0, max) : "");

type Row = {
  event_key: string;
  kind: "conversation" | "case_opened" | "case_resolved" | "other";
  conversation_id: string | null;
  org_id: string | null;
  user_id: string | null;
  summary: string;
  intent: string;
  needs_human: boolean;
  case_number: number | null;
  case_subject: string;
  case_status: string;
  case_priority: string;
  detail: Record<string, unknown>;
};

// Custard AI posts here after each conversation and when a support case opens or closes. Each is
// saved once for /admin/support; anything that needs a person is emailed to the studio.
// Transcripts are not stored in Nka.
export async function POST(request: NextRequest) {
  const { custardSigningSecret, custardIdentitySecret } = serverEnv();
  if (!custardSigningSecret) return json({ error: "not_configured" }, 503);

  const raw = await request.text();
  if (!custardSignatureValid(raw, request.headers.get("x-custard-signature"), custardSigningSecret)) {
    return json({ error: "invalid_signature" }, 401);
  }
  let body: Record<string, unknown>;
  try {
    body = JSON.parse(raw);
  } catch {
    return json({ error: "bad_request" }, 400);
  }
  if (body.test === true) return json({ ok: true });

  const db = supabaseAdmin();
  const event = String(body.event ?? "");
  const conversationId = text(body.conversation_id, 200) || text((body.case as Record<string, unknown> | undefined)?.conversation_id, 200) || null;

  // Who it was: the signed id Nka passed in, or the conversation Nka already knows.
  const meta = (body.metadata ?? {}) as Record<string, unknown>;
  let who = readIdentity(meta.userId, custardIdentitySecret);
  if (!who && conversationId) {
    const { data } = await db.from("support_conversations").select("user_id, org_id").eq("conversation_id", conversationId).maybeSingle();
    if (data) who = { userId: data.user_id as string, orgId: data.org_id as string };
  }

  const row: Row = {
    event_key: "",
    kind: "other",
    conversation_id: conversationId,
    org_id: who?.orgId ?? null,
    user_id: who?.userId ?? null,
    summary: "",
    intent: "",
    needs_human: false,
    case_number: null,
    case_subject: "",
    case_status: "",
    case_priority: "",
    detail: {},
  };

  const c = (body.case ?? {}) as Record<string, unknown>;
  if (event === "conversation.finished") {
    row.kind = "conversation";
    row.event_key = `conversation:${conversationId ?? hash(raw)}`;
    row.summary = text(body.summary, 4000);
    row.intent = text(body.intent, 200);
    row.needs_human = body.needs_follow_up === true;
    row.detail = {
      channel: text(body.channel, 40),
      status: text(body.status, 40),
      duration_seconds: Number(body.duration_seconds) || 0,
      extracted_data: body.extracted_data ?? null,
    };
  } else if (event === "case.opened" || event === "case.resolved") {
    row.kind = event === "case.opened" ? "case_opened" : "case_resolved";
    row.event_key = `${event}:${text(c.id, 100) || hash(raw)}${event === "case.resolved" ? `:${text(c.resolved_at, 40)}` : ""}`;
    row.summary = text(event === "case.resolved" ? body.note : c.details, 4000);
    row.needs_human = event === "case.opened";
    row.case_number = Number.isInteger(Number(c.number)) ? Number(c.number) : null;
    row.case_subject = text(c.subject, 500);
    row.case_status = text(c.status, 40);
    row.case_priority = text(c.priority, 40);
    row.detail = { kind: text(c.kind, 40) };
  } else {
    row.event_key = `${event || "event"}:${text(body.id, 200) || hash(raw)}`;
    row.detail = { event };
  }

  const { error } = await db.from("support_events").insert(row);
  if (error) {
    if (error.code === "23505") return json({ ok: true, duplicate: true }); // Custard retries; saved already.
    console.error("Saving Custard event failed", error.message);
    return json({ error: "save_failed" }, 500);
  }

  if (row.needs_human) {
    const org = row.org_id ? (await db.from("orgs").select("name").eq("id", row.org_id).maybeSingle()).data?.name : null;
    const site = env.siteUrl || new URL(request.url).origin;
    await notifyStudio(
      row.kind === "case_opened" ? `Support case ${row.case_number ?? ""}: ${row.case_subject || "new case"}`.trim() : "A support chat needs a person",
      [
        `Client: ${org ?? "not signed in"}`,
        row.case_priority ? `Priority: ${row.case_priority}` : "",
        "",
        row.summary || "(no summary)",
        "",
        `See it in Nka: ${site}/admin/support`,
        "Reply to the client in Custard AI, under Inbox.",
      ].filter((l, i, a) => l !== "" || a[i - 1] !== ""),
    );
  }
  return json({ ok: true });
}

function hash(raw: string): string {
  return createHash("sha256").update(raw).digest("hex").slice(0, 32);
}
