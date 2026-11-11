export type ProjectStatus =
  | "draft"
  | "queued"
  | "submitted"
  | "awaiting_approval"
  | "in_progress"
  | "in_review"
  | "changes_requested"
  | "completed"
  | "cancelled";

export type Tone = "quiet" | "ink" | "ochre" | "laterite" | "leaf";

export const STATUS: Record<ProjectStatus, { label: string; client: string; admin: string; tone: Tone }> = {
  draft: { label: "Draft", client: "Only you can see this. Send it when it's ready.", admin: "The client hasn't sent this yet.", tone: "quiet" },
  queued: {
    label: "Queued",
    client: "Your plan's active requests are full. This starts as soon as one finishes.",
    admin: "Over the client's plan limit. It starts when one of their active projects finishes.",
    tone: "quiet",
  },
  submitted: {
    label: "Brief received",
    client: "Your team is reading your brief and planning the work.",
    admin: "Waiting for the designer to confirm the date and hours, or for team hours.",
    tone: "ink",
  },
  awaiting_approval: {
    label: "Quote to approve",
    client: "Check the quote below. Work starts when an owner or admin approves it.",
    admin: "Bespoke quote sent. Waiting for the client to approve it.",
    tone: "ochre",
  },
  in_progress: {
    label: "In production",
    client: "Your team is working on it. Nka checks every version before you see it.",
    admin: "With the team. Versions wait for Nka review before the client sees them.",
    tone: "ink",
  },
  in_review: {
    label: "Ready for review",
    client: "New files are ready. Approve them or ask for changes.",
    admin: "Files are with the client for review.",
    tone: "ochre",
  },
  changes_requested: {
    label: "Changes requested",
    client: "Your team is working on your changes.",
    admin: "The client asked for changes. The designer is on them.",
    tone: "laterite",
  },
  completed: { label: "Completed", client: "Done. Approved files are in your library.", admin: "Done.", tone: "leaf" },
  cancelled: { label: "Cancelled", client: "This project was stopped.", admin: "Cancelled.", tone: "quiet" },
};

// Stages shown as a line on each project. Queued and cancelled sit outside it. Plan work has no
// price step; a Bespoke quote waiting for approval sits on the first stage.
export const STAGES: ProjectStatus[] = ["submitted", "in_progress", "in_review", "completed"];

export function stageIndex(status: ProjectStatus): number {
  if (status === "changes_requested") return STAGES.indexOf("in_review");
  if (status === "awaiting_approval") return STAGES.indexOf("submitted");
  return STAGES.indexOf(status);
}

export const ACTIVE: ProjectStatus[] = ["submitted", "awaiting_approval", "in_progress", "in_review", "changes_requested"];

export function isActive(status: string): boolean {
  return (ACTIVE as string[]).includes(status);
}

// Statuses where the client is the one holding things up.
export function waitingOnClient(status: string): boolean {
  return status === "awaiting_approval" || status === "in_review";
}
