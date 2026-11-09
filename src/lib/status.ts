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

export const STATUS: Record<ProjectStatus, { label: string; client: string; tone: Tone }> = {
  draft: { label: "Draft", client: "Only you can see this. Send it when it's ready.", tone: "quiet" },
  queued: {
    label: "Queued",
    client: "Your plan's active requests are full. This starts as soon as one finishes.",
    tone: "quiet",
  },
  submitted: { label: "Brief received", client: "The studio is reading your brief and planning the work.", tone: "ink" },
  awaiting_approval: {
    label: "Estimate to approve",
    client: "Check the estimate below. Work starts when an owner or admin approves it.",
    tone: "ochre",
  },
  in_progress: { label: "In production", client: "Your designer is working on it.", tone: "ink" },
  in_review: { label: "Ready for review", client: "New files are ready. Approve them or ask for changes.", tone: "ochre" },
  changes_requested: { label: "Changes requested", client: "The studio is working on your changes.", tone: "laterite" },
  completed: { label: "Completed", client: "Done. Approved files are in your library.", tone: "leaf" },
  cancelled: { label: "Cancelled", client: "This project was stopped.", tone: "quiet" },
};

// Stages shown as a line on each project. Queued and cancelled sit outside it.
export const STAGES: ProjectStatus[] = ["submitted", "awaiting_approval", "in_progress", "in_review", "completed"];

export function stageIndex(status: ProjectStatus): number {
  if (status === "changes_requested") return STAGES.indexOf("in_review");
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
