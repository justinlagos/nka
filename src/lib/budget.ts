// Flex budget maths. Credits (allocations, top-ups, refunds) are used oldest first.
// A credit that is still unused after its rollover window has passed can be expired.

export type LedgerEntry = {
  kind: "allocation" | "top_up" | "spend" | "refund" | "expiry" | "adjustment";
  amount: number;
  effective_on: string; // YYYY-MM-DD
};

export type CreditLot = { effective_on: string; expires_on: string | null; original: number; remaining: number };

export type BudgetSummary = {
  balance: number;
  credited: number;
  spent: number;
  expired: number;
  lots: CreditLot[];
  expirable: number; // unused credit already past its window
  expiringSoon: number; // unused credit whose window ends within 30 days
  nextExpiry: string | null;
};

function addMonths(isoDate: string, months: number): string {
  const [y, m, d] = isoDate.split("-").map(Number);
  const target = new Date(Date.UTC(y, m - 1 + months, 1));
  const lastDay = new Date(Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0)).getUTCDate();
  target.setUTCDate(Math.min(d, lastDay));
  return target.toISOString().slice(0, 10);
}

function round(n: number) {
  return Math.round(n * 100) / 100;
}

// Allocations roll over: a credit given for one month can still be used for `rolloverMonths`
// more months, so it expires (1 + rolloverMonths) months after it starts. Top-ups and refunds don't expire.
export function summariseBudget(entries: LedgerEntry[], rolloverMonths: number, today: string): BudgetSummary {
  const sorted = [...entries].sort((a, b) => a.effective_on.localeCompare(b.effective_on));
  const lots: CreditLot[] = [];
  let credited = 0;
  let spent = 0;
  let expired = 0;
  let unappliedDebit = 0;

  const draw = (amount: number) => {
    let left = amount;
    for (const lot of lots) {
      if (left <= 0) break;
      const take = Math.min(lot.remaining, left);
      lot.remaining = round(lot.remaining - take);
      left = round(left - take);
    }
    return left;
  };

  for (const e of sorted) {
    const amount = Number(e.amount);
    if (amount > 0) {
      credited += amount;
      const expires = e.kind === "allocation" ? addMonths(e.effective_on, 1 + rolloverMonths) : null;
      const lot: CreditLot = { effective_on: e.effective_on, expires_on: expires, original: amount, remaining: amount };
      lots.push(lot);
      if (unappliedDebit > 0) unappliedDebit = draw(unappliedDebit);
    } else {
      const debit = -amount;
      if (e.kind === "expiry") expired += debit;
      else spent += debit;
      unappliedDebit = round(unappliedDebit + draw(debit));
    }
  }

  const soon = addDaysIso(today, 30);
  let expirable = 0;
  let expiringSoon = 0;
  let nextExpiry: string | null = null;
  for (const lot of lots) {
    if (!lot.expires_on || lot.remaining <= 0) continue;
    if (lot.expires_on <= today) expirable += lot.remaining;
    else {
      if (lot.expires_on <= soon) expiringSoon += lot.remaining;
      if (!nextExpiry || lot.expires_on < nextExpiry) nextExpiry = lot.expires_on;
    }
  }

  return {
    balance: round(credited - spent - expired),
    credited: round(credited),
    spent: round(spent),
    expired: round(expired),
    lots,
    expirable: round(expirable),
    expiringSoon: round(expiringSoon),
    nextExpiry,
  };
}

function addDaysIso(isoDate: string, days: number): string {
  const d = new Date(`${isoDate}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export { addMonths };
