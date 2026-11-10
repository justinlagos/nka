"use server";
import { after } from "next/server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { done, fail, type ActionState } from "@/lib/action";
import { getCurrentMembership, requireProfile } from "@/lib/session";
import { askClaude, jsonFrom, aiEnabled } from "@/lib/ai";
import { brandBookText, normaliseBrief, structureBrief, SERVICE_OPTIONS, type Brief } from "@/lib/brief";
import { makeImages, sizeAndStart } from "@/lib/automation";
import { imagesEnabled } from "@/lib/images";
import { siteOrigin } from "@/lib/origin";
import { applyBrandScan, scanWebsite } from "@/lib/brand-sync";

export type ChatMessage = { from: "you" | "nka"; text: string };
export type TurnResult =
  | { kind: "ask"; text: string; options: string[] }
  | { kind: "brief"; projectId: string; title: string; summary: string; deliverables: string; deadline: string | null }
  | { kind: "error"; text: string };

const CHAT_PROMPT = (today: string) => `You help a client brief a design studio. You get the conversation so far and the client's brand book.
If a designer could start with what's known (what it is, roughly what format or size, and what it's for), write the brief.
Otherwise ask ONE short, friendly question with 2 to 4 short tap-to-answer options. Never more than two questions in the whole conversation.
Reply with JSON only, one of:
{"ask":"question","options":["...","..."]}
{"brief":{"title":"","service":"","deadline":"","summary":"","objective":"","audience":"","deliverables":"","messages":"","mandatories":"","references":"","tone":"","questions":""}}
- service: one of brand-identity, event-branding, reports-documents, presentations, social-ads, motion-video, web-product, print-merch, or empty.
- deadline: YYYY-MM-DD only if the client gave a date; today is ${today}.
- deliverables: one per line (item, format, size, how many).
- questions: anything still unknown that the designer should confirm.
Use the client's own words. Never invent facts, copy, dates or sizes; leave unknown fields empty. British English, plain and short.`;

// One step of the talk-to-brief conversation.
export async function briefTurn(messages: ChatMessage[]): Promise<TurnResult> {
  const { supabase, userId } = await requireProfile();
  const m = await getCurrentMembership();
  if (!m) return { kind: "error", text: "Set up your workspace first." };
  const clean = messages
    .slice(-12)
    .map((x) => ({ from: x.from === "nka" ? "nka" : "you", text: String(x.text ?? "").slice(0, 2000) }))
    .filter((x) => x.text.trim());
  const firstClient = clean.find((x) => x.from === "you")?.text ?? "";
  if (firstClient.trim().length < 4) return { kind: "error", text: "Tell me what you need in a sentence." };

  const today = new Date().toISOString().slice(0, 10);
  let brief: Brief | null = null;
  let title = "";
  let service = "";
  let deadline: string | null = null;

  if (aiEnabled()) {
    const { data: book } = await supabase.from("brand_books").select("*").eq("org_id", m.org.id).maybeSingle();
    const asked = clean.filter((x) => x.from === "nka").length;
    const convo = clean.map((x) => `${x.from === "you" ? "Client" : "Nka"}: ${x.text}`).join("\n");
    const reply = jsonFrom<{ ask?: string; options?: string[]; brief?: Record<string, string> }>(
      await askClaude(
        CHAT_PROMPT(today),
        `Brand book:\n${brandBookText(book) || "(empty)"}\n\nConversation:\n${convo}${asked >= 2 ? "\n\nYou have asked enough. Write the brief now." : ""}`,
        1500,
        30_000,
      ),
    );
    if (reply?.ask && asked < 2) {
      return {
        kind: "ask",
        text: reply.ask.slice(0, 300),
        options: (reply.options ?? []).map((o) => String(o).slice(0, 80)).filter(Boolean).slice(0, 4),
      };
    }
    if (reply?.brief) {
      brief = normaliseBrief(reply.brief);
      title = String(reply.brief.title ?? "").slice(0, 200);
      service = SERVICE_OPTIONS.some((s) => s.value === reply.brief?.service) ? String(reply.brief.service) : "";
      deadline = /^\d{4}-\d{2}-\d{2}$/.test(reply.brief.deadline ?? "") ? reply.brief.deadline : null;
    }
  }
  if (!brief || !brief.summary) {
    const s = structureBrief(clean.filter((x) => x.from === "you").map((x) => x.text).join("\n"));
    brief = s.brief;
    title = s.title;
  }

  const { data, error } = await supabase
    .from("projects")
    .insert({ org_id: m.org.id, title: title || "New brief", service, brief, deadline, created_by: userId })
    .select("id")
    .single();
  if (error) return { kind: "error", text: "Couldn't save the brief. Try again." };
  return {
    kind: "brief",
    projectId: data.id,
    title: title || "New brief",
    summary: brief.summary,
    deliverables: brief.deliverables,
    deadline,
  };
}

// Runs the automatic work for a brief once it's been sent.
async function afterSend(projectId: string, lane: "designer" | "instant") {
  const origin = await siteOrigin();
  after(async () => {
    if (lane === "instant") {
      await makeImages(projectId, "instant", origin);
    } else {
      await Promise.all([sizeAndStart(projectId, origin), imagesEnabled() ? makeImages(projectId, "concepts", origin) : null]);
    }
  });
}

export async function sendBrief(projectId: string, lane: "designer" | "instant"): Promise<{ ok: boolean; error?: string; path?: string }> {
  const { supabase } = await requireProfile();
  if (lane === "instant") {
    if (!imagesEnabled()) return { ok: false, error: "Instant isn't switched on yet. Send it to your designer." };
    const { error } = await supabase.rpc("start_instant", { p_project: projectId });
    if (error) return { ok: false, error: fail(error).error };
  } else {
    const { error } = await supabase.rpc("submit_project", { p_project: projectId });
    if (error) return { ok: false, error: fail(error).error };
  }
  // The designer is emailed by sizeAndStart once Nka has worked out the date (or by makeImages if Instant fails).
  await afterSend(projectId, lane);
  revalidatePath("/app", "layout");
  return { ok: true, path: `/app/projects/${projectId}?sent=${lane}` };
}

// Used by the brief form's buttons.
export async function sendBriefForm(_prev: ActionState, form: FormData): Promise<ActionState> {
  const id = String(form.get("id") ?? "");
  const lane = form.get("lane") === "instant" ? "instant" : "designer";
  const r = await sendBrief(id, lane);
  if (!r.ok) return { ok: false, error: r.error, at: Date.now() };
  redirect(r.path!);
}

// Hands an Instant option to a designer, sent and sized in one click.
export async function finishWithDesigner(_prev: ActionState, form: FormData): Promise<ActionState> {
  const { supabase } = await requireProfile();
  const { data, error } = await supabase.rpc("finish_with_designer", {
    p_deliverable: String(form.get("deliverable") ?? ""),
    p_note: String(form.get("note") ?? "").slice(0, 1000),
  });
  if (error) return fail(error);
  const r = await sendBrief(String(data), "designer");
  if (!r.ok) redirect(`/app/projects/${data}/edit`);
  redirect(r.path!);
}

// Fills the brand book from the client's website.
export async function scanMyWebsite(_prev: ActionState, form: FormData): Promise<ActionState> {
  const { supabase, userId } = await requireProfile();
  const m = await getCurrentMembership();
  if (!m) return { ok: false, error: "No organisation selected." };
  const url = String(form.get("website") ?? "").trim();
  if (!url) return { ok: false, error: "Add your website address." };
  const scan = await scanWebsite(url);
  if (!scan) return { ok: false, error: "Couldn't read that website. Check the address, or fill the brand book in by hand." };
  await applyBrandScan(supabase, m.org.id, userId, scan);
  revalidatePath("/app", "layout");
  const found = [scan.palette.length && `${scan.palette.length} colours`, scan.fonts.length && `${scan.fonts.length} typefaces`, scan.logoUrl && "your logo"]
    .filter(Boolean)
    .join(", ");
  return done(found ? `Done. Found ${found}, and wrote up what you do. Check it below.` : "Done. Check what we found below.");
}
