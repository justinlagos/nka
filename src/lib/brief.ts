// The brief format every project uses, plus the parts of brief drafting that don't need a network.

export type Brief = {
  summary: string; // what's needed, in a sentence or two
  objective: string; // what it should achieve
  audience: string;
  deliverables: string; // one per line: item, format, size, quantity
  messages: string; // key messages and copy, verbatim if supplied
  mandatories: string; // logos, legal lines, partner marks, must-haves
  references: string; // links, past work, things they like
  tone: string;
  questions: string; // what the studio still needs to know
};

export const BRIEF_FIELDS: { key: keyof Brief; label: string; hint: string; rows: number }[] = [
  { key: "summary", label: "What you need", hint: "One or two sentences. This is what the studio reads first.", rows: 3 },
  { key: "objective", label: "What it should achieve", hint: "Sign-ups, attendance, approval from a board, a launch.", rows: 2 },
  { key: "audience", label: "Who it's for", hint: "Who will see it and what they care about.", rows: 2 },
  { key: "deliverables", label: "Deliverables", hint: "One per line: item, format, size, how many.", rows: 4 },
  { key: "messages", label: "Copy and key messages", hint: "Paste final copy here if you have it.", rows: 4 },
  { key: "mandatories", label: "Must include", hint: "Logos, partner marks, legal lines, dates, addresses.", rows: 2 },
  { key: "references", label: "References", hint: "Links or past work you like, and why.", rows: 2 },
  { key: "tone", label: "Look and tone", hint: "Leave blank to follow your brand book.", rows: 2 },
  { key: "questions", label: "Open questions", hint: "Anything the studio needs to confirm with you.", rows: 2 },
];

export const SERVICE_OPTIONS: { value: string; label: string }[] = [
  { value: "", label: "Not sure yet" },
  { value: "brand-identity", label: "Brand identity" },
  { value: "event-branding", label: "Event branding" },
  { value: "reports-documents", label: "Reports and documents" },
  { value: "presentations", label: "Presentations and pitch decks" },
  { value: "social-ads", label: "Social and ad creative" },
  { value: "motion-video", label: "Motion and video" },
  { value: "web-product", label: "Web and product design" },
  { value: "print-merch", label: "Print, packaging and merch" },
];

export function emptyBrief(): Brief {
  return {
    summary: "",
    objective: "",
    audience: "",
    deliverables: "",
    messages: "",
    mandatories: "",
    references: "",
    tone: "",
    questions: "",
  };
}

const LIMIT = 4000;

export function normaliseBrief(input: unknown): Brief {
  const out = emptyBrief();
  if (!input || typeof input !== "object") return out;
  const src = input as Record<string, unknown>;
  for (const key of Object.keys(out) as (keyof Brief)[]) {
    const v = src[key];
    if (typeof v === "string") out[key] = v.slice(0, LIMIT).trim();
    else if (Array.isArray(v)) out[key] = v.filter((x) => typeof x === "string").join("\n").slice(0, LIMIT).trim();
  }
  return out;
}

export function briefFromForm(form: FormData): Brief {
  const raw: Record<string, string> = {};
  for (const f of BRIEF_FIELDS) raw[f.key] = String(form.get(f.key) ?? "");
  return normaliseBrief(raw);
}

// A short title from the request, used when nothing better is available.
export function titleFrom(text: string): string {
  const first = text
    .replace(/\s+/g, " ")
    .trim()
    .split(/(?<=[.!?])\s/)[0]
    .replace(/^(hi|hello|hey)[,!.\s]+/i, "")
    .replace(/^(we|i)\s+(need|want|would like)\s+(?:(?:an|a|some|the)\s+)?/i, "")
    .replace(/[.!?]+$/, "");
  const t = first.charAt(0).toUpperCase() + first.slice(1);
  if (t.length <= 60) return t || "New project";
  const cut = t.slice(0, 60);
  return cut.slice(0, cut.lastIndexOf(" ") > 30 ? cut.lastIndexOf(" ") : 60).trim();
}

const SIZE_HINTS: [RegExp, string][] = [
  [/instagram|ig\b|carousel/i, "Instagram: 1080 x 1350 feed, 1080 x 1920 stories"],
  [/linkedin/i, "LinkedIn: 1200 x 1200 feed, 1200 x 627 link"],
  [/poster|a2\b|a3\b|a1\b/i, "Poster: confirm size and print or digital"],
  [/deck|presentation|slides|pitch/i, "Deck: 16:9, editable PowerPoint or Google Slides"],
  [/report|annual|booklet|brochure/i, "Report: A4 portrait, print PDF and accessible web PDF"],
  [/logo|identity|rebrand/i, "Identity: logo set, colour, type, usage guide"],
  [/video|reel|motion|animation/i, "Video: confirm length, aspect ratios and sound"],
  [/website|landing|web page|homepage/i, "Web: desktop and mobile layouts"],
  [/banner|roll-?up|backdrop|booth|stand/i, "Event print: confirm sizes from the venue or printer"],
];

// Lays out a brief from the client's own words when no AI drafting is available.
// It never invents facts: unknowns become questions.
export function structureBrief(request: string, deadline?: string): { title: string; brief: Brief } {
  const text = request.trim();
  const brief = emptyBrief();
  brief.summary = text.slice(0, LIMIT);
  const hints = SIZE_HINTS.filter(([re]) => re.test(text)).map(([, h]) => h);
  brief.deliverables = hints.join("\n");
  const questions = ["Who is the audience, and where will they see this?", "What should it achieve?"];
  if (!hints.length) questions.push("What exactly should we deliver: item, format, size, how many?");
  if (!deadline) questions.push("When do you need the final files?");
  if (!/copy|text|wording|headline/i.test(text)) questions.push("Do you have final copy, or should we write it?");
  brief.questions = questions.join("\n");
  return { title: titleFrom(text), brief };
}

export type BrandBook = {
  about?: string;
  audiences?: string;
  voice?: string;
  colours?: string;
  typefaces?: string;
  rules?: string;
};

export function brandBookText(b: BrandBook | null | undefined): string {
  if (!b) return "";
  const parts: string[] = [];
  if (b.about) parts.push(`About the company: ${b.about}`);
  if (b.audiences) parts.push(`Audiences: ${b.audiences}`);
  if (b.voice) parts.push(`Tone of voice: ${b.voice}`);
  if (b.colours) parts.push(`Colours: ${b.colours}`);
  if (b.typefaces) parts.push(`Typefaces: ${b.typefaces}`);
  if (b.rules) parts.push(`Do and don't: ${b.rules}`);
  return parts.join("\n");
}

export const DRAFT_SYSTEM_PROMPT = `You turn a client's rough request into a clear design brief for a design studio.
Rules:
- Use only facts the client gave you or that are in their brand book. Never invent names, numbers, dates, copy or claims.
- Where something needed is missing, add it to "questions" instead of guessing.
- Keep the client's own copy word for word in "messages".
- "deliverables" is one line per item: item, format, size, quantity. Suggest standard sizes for the channels they name.
- Plain English, short sentences. British spelling.
- Never ask for phone numbers, email addresses or social media handles. Nka doesn't allow them in messages between
  client and designer. If a call to action needs a destination, ask for the web address.
Reply with one JSON object and nothing else, with these string fields:
title (under 60 characters), service (one of: brand-identity, event-branding, reports-documents, presentations, social-ads, motion-video, web-product, print-merch, or ""), summary, objective, audience, deliverables, messages, mandatories, references, tone, questions.`;

export function draftUserMessage(request: string, brand: string, deadline?: string): string {
  return [
    brand ? `Brand book:\n${brand}` : "Brand book: not filled in yet.",
    deadline ? `Deadline the client gave: ${deadline}` : "",
    `Client's request:\n${request}`,
  ]
    .filter(Boolean)
    .join("\n\n");
}

// Pulls the JSON object out of a model reply, tolerating code fences or stray text.
export function parseDraft(text: string): { title: string; service: string; brief: Brief } | null {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start < 0 || end <= start) return null;
  try {
    const obj = JSON.parse(text.slice(start, end + 1)) as Record<string, unknown>;
    const brief = normaliseBrief(obj);
    if (!brief.summary) return null;
    const service = typeof obj.service === "string" && SERVICE_OPTIONS.some((s) => s.value === obj.service) ? obj.service : "";
    const title = typeof obj.title === "string" && obj.title.trim() ? obj.title.trim().slice(0, 200) : titleFrom(brief.summary);
    return { title, service, brief };
  } catch {
    return null;
  }
}
