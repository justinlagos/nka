import { STATUS, isActive, waitingOnClient, type ProjectStatus } from "./status.ts";
import { deliveryTiming, timingText, ukDate } from "./ontime.ts";
import { PLANS, planLabel, type Currency } from "./plans.ts";

// Turns what support_lookup returns into the answer Abigail reads. Plain words, the same labels the
// workspace uses, and links to the page where the client can act. Pure, so tests can load it.

export type LookupProject = {
  id: string;
  number: number;
  title: string;
  kind: string;
  status: ProjectStatus;
  asked_for: string | null;
  agreed_date: string | null;
  submitted_at: string | null;
  completed_at: string | null;
  first_files_at: string | null;
  files_to_review: number;
  approved_files: number;
};

export type Lookup = {
  role: string;
  organisation: string;
  plan: string;
  plan_status: string;
  active_limit: number | null;
  hours: { left: number; used: number; granted: number; carried: number; allowance: number; top_ups: number } | null;
  instant: { used: number; limit: number };
  lead: string | null;
  projects: LookupProject[];
  library_files: number;
};

const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

function project(p: LookupProject, site: string, today: string) {
  const s = STATUS[p.status] ?? { label: p.status, client: "" };
  const timing = timingText(deliveryTiming(p.agreed_date, p.first_files_at ? ukDate(p.first_files_at) : null, today));
  return {
    number: p.number,
    title: p.title,
    type: p.kind === "instant" ? "Instant brief" : p.kind === "resize" ? "Resize" : "Designer brief",
    status: s.label,
    what_it_means: s.client,
    agreed_date: p.agreed_date,
    date_they_asked_for: p.asked_for,
    timing: timing || null,
    files_waiting_for_their_review: Number(p.files_to_review) || 0,
    approved_files: Number(p.approved_files) || 0,
    link: `${site}/app/projects/${p.id}`,
  };
}

export function describeWorkspace(data: Lookup, site: string, now = new Date()) {
  const today = ukDate(now);
  const projects = data.projects.map((p) => project(p, site, today));
  const active = data.projects.filter((p) => isActive(p.status));
  const toReview = data.projects.filter((p) => waitingOnClient(p.status));
  const queued = data.projects.filter((p) => p.status === "queued");
  const plan = planLabel(data.plan);

  const bits = [`${data.organisation} is on ${plan === "No plan" ? "no plan" : `the ${plan} plan`}`];
  if (data.plan_status === "past_due") bits.push("the last payment failed, so the card needs updating in Billing");
  if (data.plan_status === "paused") bits.push("the plan is paused, so new briefs wait until it restarts");
  if (data.hours) bits.push(`${plural(Number(data.hours.left), "team hour")} left this month`);
  if (active.length) bits.push(`${plural(active.length, "project")} in progress`);
  if (toReview.length) bits.push(`${plural(toReview.length, "project")} waiting for their review or approval`);
  if (queued.length) bits.push(`${plural(queued.length, "brief")} queued`);

  return {
    found: true,
    summary: `${bits.join(", ")}.`,
    details: {
      organisation: data.organisation,
      their_role: data.role,
      plan,
      plan_status: data.plan_status,
      team_hours: data.hours
        ? {
            left: Number(data.hours.left),
            used_this_month: Number(data.hours.used),
            this_month: Number(data.hours.allowance),
            carried_from_last_month: Number(data.hours.carried),
            extra_hours_bought: Number(data.hours.top_ups),
          }
        : null,
      requests_at_once: data.active_limit,
      instant_briefs_this_month: { used: data.instant.used, limit: data.instant.limit },
      lead_designer: data.lead,
      projects,
      library: { approved_files: data.library_files, link: `${site}/app/library` },
      pages: {
        new_brief: `${site}/app/projects/new`,
        projects: `${site}/app/projects`,
        billing: `${site}/app/billing`,
        brand_book: `${site}/app/brand`,
        team: `${site}/app/team`,
      },
    },
  };
}

export function describeProject(data: Lookup, number: number, site: string, now = new Date()) {
  const p = data.projects.find((x) => Number(x.number) === number);
  if (!p) return { found: false, summary: `No project ${number} in ${data.organisation}.` };
  const view = project(p, site, ukDate(now));
  const parts = [`Project ${p.number}, ${p.title}: ${view.status}`];
  if (view.timing) parts.push(view.timing.toLowerCase());
  if (view.files_waiting_for_their_review) parts.push(`${plural(view.files_waiting_for_their_review, "file")} ready for their review`);
  return { found: true, summary: `${parts.join(", ")}.`, details: view };
}

// Monthly income at list prices from the plans on the books. Yearly plans count at the monthly price.
export function monthlyAtListPrices(rows: { plan: string; currency: string; count: number }[]) {
  const totals: Partial<Record<Currency, number>> = {};
  let customers = 0;
  for (const r of rows) {
    const plan = PLANS.find((p) => p.id === r.plan);
    const cur = r.currency as Currency;
    if (!plan || !(cur in plan.price)) continue;
    totals[cur] = (totals[cur] ?? 0) + plan.price[cur] * Number(r.count);
    customers += Number(r.count);
  }
  return { customers, by_currency: totals };
}
