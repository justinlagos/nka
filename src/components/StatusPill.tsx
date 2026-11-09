import { STATUS, type ProjectStatus } from "@/lib/status";

export function StatusPill({ status }: { status: string }) {
  const s = STATUS[status as ProjectStatus] ?? { label: status, tone: "quiet" as const };
  return <span className={`pill tone-${s.tone}`}>{s.label}</span>;
}
