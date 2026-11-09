import "server-only";
import { serverEnv } from "@/lib/env";
import { DRAFT_SYSTEM_PROMPT, draftUserMessage, parseDraft, structureBrief, type Brief } from "@/lib/brief";

export type Draft = { title: string; service: string; brief: Brief; source: "claude" | "layout" };

// Drafts a brief with Claude when a key is set; otherwise lays out the client's own words.
export async function draftBrief(request: string, brand: string, deadline?: string): Promise<Draft> {
  const { anthropicKey, anthropicModel, anthropicWorkspace } = serverEnv();
  const fallback = (): Draft => {
    const s = structureBrief(request, deadline);
    return { title: s.title, service: "", brief: s.brief, source: "layout" };
  };
  if (!anthropicKey) return fallback();

  try {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${anthropicKey}`,
        "anthropic-version": "2026-10-21",
        // Only needed for keys not scoped to a workspace.
        ...(anthropicWorkspace ? { "anthropic-workspace-id": anthropicWorkspace } : {}),
      },
      body: JSON.stringify({
        model: anthropicModel,
        max_tokens: 1500,
        system: DRAFT_SYSTEM_PROMPT,
        messages: [{ role: "user", content: draftUserMessage(request, brand, deadline) }],
      }),
      signal: AbortSignal.timeout(45_000),
    });
    if (!res.ok) {
      console.error("Brief drafting failed", res.status, (await res.text()).slice(0, 300));
      return fallback();
    }
    const data = (await res.json()) as { content?: { type: string; text?: string }[] };
    const text = (data.content ?? []).filter((c) => c.type === "text").map((c) => c.text ?? "").join("");
    const parsed = parseDraft(text);
    return parsed ? { ...parsed, source: "claude" } : fallback();
  } catch (err) {
    console.error("Brief drafting error", err);
    return fallback();
  }
}
