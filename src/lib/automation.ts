import "server-only";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { askClaude, jsonFrom } from "@/lib/ai";
import { generateImage, imagesEnabled, type ImageFailure, type ImageSize } from "@/lib/images";
import { notifyClient, notifyDesigner, notifyStudio } from "@/lib/notify";
import { addWorkingDays, ukDate } from "@/lib/ontime";
import { normaliseBrief, BRIEF_FIELDS } from "@/lib/brief";
import { date, projectRef } from "@/lib/format";

// Work Nka does by itself once a brief is sent. Everything runs as the system (service role)
// after the client's page has already moved on, and every step has a plain fallback.

type ProjectRow = {
  id: string;
  number: number;
  org_id: string;
  title: string;
  service: string;
  kind: string;
  status: string;
  brief: unknown;
  deadline: string | null;
};

async function load(projectId: string) {
  const db = supabaseAdmin();
  const { data: p } = await db
    .from("projects")
    .select("id, number, org_id, title, service, kind, status, brief, deadline")
    .eq("id", projectId)
    .maybeSingle();
  if (!p) return null;
  const [{ data: org }, { data: book }] = await Promise.all([
    db.from("orgs").select("name, plan, plan_status, currency").eq("id", p.org_id).single(),
    db.from("brand_books").select("about, audiences, voice, palette, fonts, rules").eq("org_id", p.org_id).maybeSingle(),
  ]);
  return { db, p: p as ProjectRow, org, book };
}

function briefText(p: ProjectRow) {
  const b = normaliseBrief(p.brief);
  return [`Title: ${p.title}`, p.service && `Type: ${p.service}`, p.deadline && `Needed by: ${p.deadline}`]
    .concat(BRIEF_FIELDS.filter((f) => b[f.key]).map((f) => `${f.label}: ${b[f.key]}`))
    .filter(Boolean)
    .join("\n");
}

// Typical first-draft times when Claude isn't available.
const DEFAULT_DAYS: Record<string, [number, number]> = {
  "brand-identity": [24, 8],
  "event-branding": [16, 5],
  "reports-documents": [14, 4],
  presentations: [8, 2],
  "social-ads": [6, 2],
  "motion-video": [16, 5],
  "web-product": [24, 7],
  "print-merch": [8, 3],
};

const SIZE_PROMPT = `You size a design brief for a small senior design studio.
Reply with one JSON object only: {"hours": number, "working_days": number, "notes": ""}
- hours: realistic designer hours to a first full draft plus one round of changes.
- working_days: working days until the first draft, assuming the studio starts today. Most single pieces are 2.
- notes: one or two plain sentences on what's included, for the estimate. British English.`;

export async function sizeAndStart(projectId: string, origin: string, note?: string) {
  const ctx = await load(projectId);
  if (!ctx) return;
  const { db, p, org } = ctx;
  const sized = jsonFrom<{ hours?: number; working_days?: number; notes?: string }>(
    await askClaude(SIZE_PROMPT, briefText(p), 300, 20_000),
  );
  const [defHours, defDays] = DEFAULT_DAYS[p.service] ?? [8, 2];
  const hours = Math.min(400, Math.max(1, Number(sized?.hours) || defHours));
  const days = Math.min(60, Math.max(1, Math.round(Number(sized?.working_days) || defDays)));
  const due = addWorkingDays(ukDate(new Date()), days);
  const rate = Number(process.env.STUDIO_HOURLY_RATE ?? 0);
  await db
    .from("projects")
    .update({
      suggested_hours: hours,
      suggested_days: days,
      suggested_due: due,
      suggested_amount: rate > 0 ? Math.round(hours * rate) : null,
      suggested_notes: (sized?.notes ?? "").slice(0, 2000),
      sized_at: new Date().toISOString(),
    })
    .eq("id", projectId);

  // Plan clients start straight away on plan hours, or wait until hours come in.
  const { data: outcome } = await db.rpc("system_start_brief", {
    p_project: projectId,
    p_hours: hours,
    p_due: due,
    p_notes: sized?.notes ?? "",
  });
  const started = outcome === "started";
  const waiting = outcome === "needs_hours";
  await notifyDesigner(p.id, {
    origin,
    subject: started ? `New brief, started: ${p.title}` : `New brief: ${p.title}`,
    heading: started ? "A new brief has started" : p.status === "queued" ? "A new brief is queued" : "A new brief is in",
    lines: [
      `${projectRef(p.number)} ${p.title}, for ${org?.name ?? "your client"}`,
      ...(note ? [note] : []),
      started
        ? `It's on their plan hours (${hours} hours), so it started straight away. First draft due ${date(due)}.`
        : waiting
          ? `It needs ${hours} team hours and they don't have enough left this month. It starts by itself when they add hours or on the 1st. Don't start it yet.`
          : p.status === "queued"
            ? "Their plan's active requests are full, so it starts by itself when one finishes."
            : `They're not on a plan yet. Nka suggests ${hours} hours and a first draft by ${date(due)}. Nka quotes it before work starts.`,
    ],
    path: `/app/projects/${p.id}`,
    button: "Open the brief",
  });
  if (started) {
    await notifyClient(p.org_id, {
      origin,
      subject: `Started: ${p.title}`,
      heading: "Your team has started",
      lines: [`${projectRef(p.number)} ${p.title}`, `It uses ${hours} of your team hours. First draft due ${date(due)}.`],
      path: `/app/projects/${p.id}`,
      button: "See the project",
    });
  } else if (waiting) {
    await notifyClient(p.org_id, {
      origin,
      subject: `Waiting for hours: ${p.title}`,
      heading: "This brief needs more team hours",
      lines: [
        `${projectRef(p.number)} ${p.title} needs ${hours} team hours, and your plan has fewer left this month.`,
        "Add 5 hours from Billing and it starts straight away, or it starts by itself when your hours renew on the 1st.",
      ],
      path: "/app/billing",
      button: "Add hours",
    });
  }
  return { due, started, waiting, plan: org?.plan };
}

// Briefs that were waiting for hours start once a top-up lands, a plan starts, or the month turns.
// The date is worked out from today with the size Nka gave the brief when it was sent.
export async function startWaitingBriefs(orgId: string | null, origin: string) {
  const db = supabaseAdmin();
  const { data: rows } = await db.rpc("system_waiting_briefs", { p_org: orgId });
  let count = 0;
  const blocked = new Set<string>();
  for (const r of (rows ?? []) as { id: string; org_id: string; hours: number }[]) {
    if (blocked.has(r.org_id)) continue;
    const { data: p } = await db
      .from("projects")
      .select("id, number, title, service, suggested_days, estimate_notes")
      .eq("id", r.id)
      .maybeSingle();
    if (!p) continue;
    const days = Math.max(1, Number(p.suggested_days) || (DEFAULT_DAYS[p.service] ?? [8, 2])[1]);
    const due = addWorkingDays(ukDate(new Date()), days);
    const { data: outcome } = await db.rpc("system_start_brief", {
      p_project: r.id,
      p_hours: r.hours,
      p_due: due,
      p_notes: p.estimate_notes ?? "",
    });
    if (outcome !== "started") {
      blocked.add(r.org_id); // oldest first: later briefs for this client wait behind it
      continue;
    }
    count += 1;
    const lines = [`${projectRef(p.number)} ${p.title}`, `It uses ${r.hours} team hours. First draft due ${date(due)}.`];
    await notifyClient(r.org_id, { origin, subject: `Started: ${p.title}`, heading: "Your team has started", lines, path: `/app/projects/${r.id}`, button: "See the project" });
    await notifyDesigner(r.id, { origin, subject: `Brief started: ${p.title}`, heading: "A waiting brief has started", lines, path: `/app/projects/${r.id}`, button: "Open the brief" });
  }
  return count;
}

type Option = { title: string; prompt: string; size: ImageSize };

const PROMPTS = {
  concepts: `You are an art director. From a client's design brief and brand, write three distinct visual directions for an image model.
Each is a moodboard-style image that shows a direction (colour, type feel, imagery, composition), not a finished layout.
Reply with JSON only: {"options":[{"title":"Direction A: two or three words","prompt":"...","size":"1024x1024"}]}
Use the brand colours given (hex) and describe typefaces by style. No real brands, logos or people's likenesses. Prompts under 900 characters.`,
  instant: `You are a senior designer. From a client's design brief and brand, write three distinct finished design options for an image model.
Each prompt describes one complete, final piece as it would be delivered (layout, hierarchy, imagery, exact headline and copy from the brief in quotes, colours, type style).
Pick size per piece: "1024x1024" square posts, "1536x1024" landscape slides/banners/web, "1024x1536" portrait posters/stories/flyers.
Reply with JSON only: {"options":[{"title":"Option A: two or three words","prompt":"...","size":"1024x1536"}]}
Use the brand colours given (hex) and describe typefaces by style. Keep on-image text short and spelled exactly. No real third-party brands, logos or people's likenesses. Prompts under 1500 characters.`,
};

async function planOptions(mode: "concepts" | "instant", ctx: NonNullable<Awaited<ReturnType<typeof load>>>): Promise<Option[]> {
  const { p, org, book } = ctx;
  const palette = ((book?.palette as string[] | null) ?? []).join(", ");
  const fonts = ((book?.fonts as string[] | null) ?? []).join(", ");
  const brand = [
    `Company: ${org?.name ?? ""}`,
    book?.about && `About: ${book.about}`,
    book?.audiences && `Audiences: ${book.audiences}`,
    book?.voice && `Tone: ${book.voice}`,
    palette && `Brand colours: ${palette}`,
    fonts && `Brand typefaces: ${fonts}`,
    book?.rules && `Do and don't: ${book.rules}`,
  ]
    .filter(Boolean)
    .join("\n");
  const out = jsonFrom<{ options?: Partial<Option>[] }>(await askClaude(PROMPTS[mode], `${brand}\n\nBrief:\n${briefText(p)}`, 1800, 30_000));
  const sizes: ImageSize[] = ["1024x1024", "1536x1024", "1024x1536"];
  const options = (out?.options ?? [])
    .filter((o) => o.prompt)
    .slice(0, 3)
    .map((o, i) => ({
      title: (o.title || `Option ${"ABC"[i]}`).slice(0, 120),
      prompt: String(o.prompt),
      size: sizes.includes(o.size as ImageSize) ? (o.size as ImageSize) : "1024x1024",
    }));
  if (options.length) return options;
  // Without Claude: three variations on the brief itself.
  const base = `${mode === "instant" ? "Finished, polished design" : "Moodboard showing a visual direction"} for: ${normaliseBrief(p.brief).summary}. ${palette ? `Colours: ${palette}.` : ""} ${fonts ? `Typefaces like ${fonts}.` : ""}`;
  return ["bold and graphic", "calm and minimal", "photographic and warm"].map((v, i) => ({
    title: `Option ${"ABC"[i]}: ${v}`,
    prompt: `${base} Style: ${v}.`,
    size: "1024x1024" as ImageSize,
  }));
}

export async function makeImages(projectId: string, mode: "concepts" | "instant", origin: string) {
  const ctx = await load(projectId);
  if (!ctx) return;
  const { db, p } = ctx;
  if (!imagesEnabled()) {
    await db.from("projects").update({ concepts_status: "none" }).eq("id", projectId);
    return;
  }
  await db.from("projects").update({ concepts_status: "pending" }).eq("id", projectId);
  const options = await planOptions(mode, ctx);
  let reason = "failed" as ImageFailure;
  const images = await Promise.all(options.map((o) => generateImage(o.prompt, o.size, (f) => (reason = f))));
  const saved: { title: string; path: string; size: number }[] = [];
  for (let i = 0; i < options.length; i++) {
    const bytes = images[i];
    if (!bytes) continue;
    const path = `${p.org_id}/${p.id}/${mode}-${Date.now()}-${i + 1}.png`;
    const { error } = await db.storage.from("files").upload(path, bytes, { contentType: "image/png" });
    if (!error) saved.push({ title: options[i].title, path, size: bytes.byteLength });
  }

  if (mode === "concepts") {
    if (saved.length) {
      await db.from("attachments").insert(
        saved.map((s) => ({
          org_id: p.org_id,
          project_id: p.id,
          kind: "concept",
          storage_path: s.path,
          file_name: s.title,
          mime: "image/png",
          size: s.size,
        })),
      );
    }
    await db.from("projects").update({ concepts_status: saved.length ? "ready" : "failed" }).eq("id", projectId);
    return;
  }

  // Instant: the options are the deliverables.
  if (!saved.length) {
    // Couldn't make anything: hand it to the studio instead of leaving the client waiting.
    // Clear the zero-cost Instant estimate so the studio prices it like any other brief.
    await db
      .from("projects")
      .update({
        kind: "brief",
        status: "submitted",
        concepts_status: "failed",
        estimate_amount: null,
        estimate_notes: "",
        estimate_sent_at: null,
        approved_at: null,
        approved_by: null,
      })
      .eq("id", projectId);
    await db.from("project_events").insert({ project_id: p.id, org_id: p.org_id, kind: "instant_failed", detail: { reason } });
    // A problem for the admin (the image service), and new work for the designer.
    await notifyStudio(`Instant failed, sent to the designer: ${projectRef(p.number)} ${p.title}`, [
      reason === "quota"
        ? "The image service account has run out of credit. Add credit at platform.openai.com/settings/organization/billing."
        : "The image service didn't return any options.",
      `${origin}/admin/projects/${p.id}`,
    ]);
    // Carry on exactly as if they had picked Designer: date it and start it if the plan allows.
    await sizeAndStart(projectId, origin, "The client asked for Instant, which couldn't make options this time, so this one is yours.");
    return;
  }
  await db.from("deliverables").insert(
    saved.map((s) => ({
      project_id: p.id,
      org_id: p.org_id,
      title: s.title,
      version: 1,
      storage_path: s.path,
      file_name: `${s.title.replace(/[^\w-]+/g, "-").toLowerCase()}.png`,
      mime: "image/png",
      size: s.size,
      note: "Made by AI from your brief and brand. Approve it, ask for changes, or have a designer finish it.",
    })),
  );
  await db.from("projects").update({ status: "in_review", concepts_status: "ready" }).eq("id", projectId);
  await db.from("project_events").insert({ project_id: p.id, org_id: p.org_id, kind: "instant_ready", detail: { count: saved.length } });
  await notifyClient(p.org_id, {
    origin,
    subject: `Ready: ${p.title}`,
    heading: `${saved.length} options are ready`,
    lines: [`${projectRef(p.number)} ${p.title}`, "Approve one, ask for changes, or have a designer finish it."],
    path: `/app/projects/${p.id}`,
    button: "See the options",
  });
}
