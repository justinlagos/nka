import { NextResponse, type NextRequest } from "next/server";
import { areaOf, getCurrentMembership, getSession } from "@/lib/session";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { serverEnv } from "@/lib/env";
import { signIdentity } from "@/lib/custard-sign";
import { SUPPORT_DAILY_CAP, SUPPORT_MESSAGE_MAX, custardChat, supportChatReady } from "@/lib/custard";

export const dynamic = "force-dynamic";

const reply = (body: Record<string, unknown>, status = 200) =>
  NextResponse.json(body, { status, headers: { "cache-control": "no-store" } });

// One message from the workspace chat to Abigail. Who is asking comes from the Supabase session on
// this server, never from the browser: the browser sends only the text and the conversation it's in.
export async function POST(request: NextRequest) {
  // Only our own pages may post here.
  const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host");
  let originHost = "";
  try {
    originHost = new URL(request.headers.get("origin") ?? "").host;
  } catch {
    /* missing or "null" */
  }
  if (!host || originHost !== host) return reply({ error: "Not allowed." }, 403);

  if (!supportChatReady()) return reply({ error: "Support chat isn't switched on yet." }, 503);

  const { userId, profile } = await getSession();
  if (!userId || !profile) return reply({ error: "Please sign in again." }, 401);
  if (areaOf(profile) === "designer") return reply({ error: "Support chat is for clients." }, 403);
  const membership = await getCurrentMembership();
  if (!membership) return reply({ error: "Open a workspace first." }, 403);

  const body = (await request.json().catch(() => null)) as { message?: unknown; conversationId?: unknown } | null;
  const message = typeof body?.message === "string" ? body.message.trim() : "";
  if (!message) return reply({ error: "Write a message first." }, 400);
  if (message.length > SUPPORT_MESSAGE_MAX) return reply({ error: `Keep it under ${SUPPORT_MESSAGE_MAX} characters.` }, 400);
  const asked = typeof body?.conversationId === "string" && body.conversationId.length <= 200 ? body.conversationId : null;

  const db = supabaseAdmin();
  const { data: begin, error } = await db.rpc("support_begin", {
    p_user: userId,
    p_org: membership.org.id,
    p_conversation: asked,
    p_cap: SUPPORT_DAILY_CAP,
  });
  if (error) {
    console.error("support_begin failed", error.message);
    return reply({ error: "Support chat isn't available right now." }, 500);
  }
  const b = begin as { ok: boolean; reason?: string; conversation?: string | null };
  if (!b.ok) {
    return b.reason === "daily_cap"
      ? reply({ error: "That's today's limit for the support chat. Message the studio from your project page, or try again tomorrow." }, 429)
      : reply({ error: "Open a workspace first." }, 403);
  }

  const { custardIdentitySecret } = serverEnv();
  const result = await custardChat(message, b.conversation ?? null, {
    userId: signIdentity(userId, membership.org.id, custardIdentitySecret),
    email: profile.email,
    fullName: profile.full_name,
    organisation: membership.org.name,
    role: membership.role,
  });

  if (!result.ok) {
    console.error("Custard chat failed", result.status, result.code);
    if (result.status === 504) return reply({ error: "Abigail took too long to answer. Try again in a moment." }, 504);
    if (result.status === 422) return reply({ error: "Abigail couldn't take that message. Try a shorter one, or start a new chat." }, 422);
    return reply({ error: "Support chat isn't available right now. Message the studio from your project page." }, 503);
  }

  let conversationId = result.conversationId;
  if (conversationId) {
    const { data: mine } = await db.rpc("support_remember", { p_user: userId, p_org: membership.org.id, p_conversation: conversationId });
    if (mine !== true) conversationId = null;
  }
  return reply({ reply: result.reply, conversationId });
}
