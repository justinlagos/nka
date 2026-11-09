// Delivery against the date the studio agreed. Dates are compared as UK calendar days.

export type Timing =
  | { state: "none" }
  | { state: "on_time"; days: number } // days early (0 = on the day)
  | { state: "late"; days: number }
  | { state: "due"; days: number } // days left (0 = today)
  | { state: "overdue"; days: number };

export function ukDate(ts: string | Date): string {
  return new Date(ts).toLocaleDateString("en-CA", { timeZone: "Europe/London" });
}

function dayDiff(a: string, b: string): number {
  return Math.round((Date.parse(`${a}T00:00:00Z`) - Date.parse(`${b}T00:00:00Z`)) / 86_400_000);
}

// `firstDelivered` is the UK date the first file went up for review, if any.
export function deliveryTiming(due: string | null, firstDelivered: string | null, today: string): Timing {
  if (!due) return { state: "none" };
  if (firstDelivered) {
    const late = dayDiff(firstDelivered, due);
    return late > 0 ? { state: "late", days: late } : { state: "on_time", days: Math.abs(late) };
  }
  const left = dayDiff(due, today);
  return left >= 0 ? { state: "due", days: left } : { state: "overdue", days: -left };
}

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;

export function timingText(t: Timing): string {
  switch (t.state) {
    case "none":
      return "";
    case "on_time":
      return "First files delivered on time";
    case "late":
      return `First files delivered ${plural(t.days, "day")} late`;
    case "due":
      return t.days === 0 ? "Due today" : `Due in ${plural(t.days, "day")}`;
    case "overdue":
      return `${plural(t.days, "day")} overdue`;
  }
}

// On-time record across projects that have both an agreed date and a first delivery.
export function onTimeRecord(rows: { due: string | null; firstDelivered: string | null }[]): { onTime: number; total: number } {
  let onTime = 0;
  let total = 0;
  for (const r of rows) {
    if (!r.due || !r.firstDelivered) continue;
    total += 1;
    if (r.firstDelivered <= r.due) onTime += 1;
  }
  return { onTime, total };
}

// The date `days` working days (Mon to Fri) after `from`. Bank holidays aren't counted.
export function addWorkingDays(from: string, days: number): string {
  const d = new Date(`${from}T00:00:00Z`);
  let left = Math.max(0, Math.round(days));
  while (left > 0) {
    d.setUTCDate(d.getUTCDate() + 1);
    const wd = d.getUTCDay();
    if (wd !== 0 && wd !== 6) left -= 1;
  }
  // A Saturday or Sunday start with 0 days lands on Monday.
  while (d.getUTCDay() === 0 || d.getUTCDay() === 6) d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
}
