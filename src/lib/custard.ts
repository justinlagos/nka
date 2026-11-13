import "server-only";
import { serverEnv } from "@/lib/env";

// Abigail, Nka's support assistant, runs on Custard AI (custardai.dev). Clients talk to her from
// the workspace through /api/support/chat; Nka's server is the only thing that talks to Custard, so the
// API key never reaches a browser. Custard calls back to /api/custard/lookup for live answers and
// /api/custard/webhook with summaries and support cases.

export const CUSTARD_API = "https://custardai.dev/api/public/v1";

// Messages one person can send Abigail in a UK day. Each reply costs Custard credit.
export const SUPPORT_DAILY_CAP = 60;
export const SUPPORT_MESSAGE_MAX = 1500;

// The chat shows only when everything it needs is set.
export function supportChatReady(): boolean {
  const e = serverEnv();
  return Boolean(e.custardApiKey && e.custardStaffId && e.custardIdentitySecret && e.supabaseSecret);
}

export type CustardUser = { userId: string; email?: string; fullName?: string } & Record<string, string | number | boolean | undefined>;

export type ChatResult =
  | { ok: true; reply: string; conversationId: string | null }
  | { ok: false; status: number; code: string };

export async function custardChat(message: string, conversationId: string | null, user: CustardUser): Promise<ChatResult> {
  const { custardApiKey, custardStaffId } = serverEnv();
  try {
    const res = await fetch(`${CUSTARD_API}/chat`, {
      method: "POST",
      headers: { authorization: `Bearer ${custardApiKey}`, "content-type": "application/json" },
      body: JSON.stringify({ agentId: custardStaffId, message, conversationId, user }),
      signal: AbortSignal.timeout(45_000),
      cache: "no-store",
    });
    const data = (await res.json().catch(() => null)) as
      | { ok?: boolean; reply?: string; conversationId?: string | null; error?: string }
      | null;
    if (!res.ok || !data?.ok || typeof data.reply !== "string") {
      return { ok: false, status: res.status, code: data?.error ?? "unknown" };
    }
    return { ok: true, reply: data.reply, conversationId: data.conversationId ?? null };
  } catch (err) {
    const timedOut = err instanceof Error && (err.name === "TimeoutError" || err.name === "AbortError");
    return { ok: false, status: timedOut ? 504 : 502, code: timedOut ? "timeout" : "network" };
  }
}
