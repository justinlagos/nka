import { test } from "node:test";
import assert from "node:assert/strict";
import { summariseBudget, addMonths } from "../src/lib/budget.ts";
import { structureBrief, parseDraft, normaliseBrief, titleFrom } from "../src/lib/brief.ts";
import { planByLookupKey, planStatusFromStripe, PLANS } from "../src/lib/plans.ts";
import { safeFileName, money } from "../src/lib/format.ts";

test("budget: spend draws the oldest credit first and balance adds up", () => {
  const s = summariseBudget(
    [
      { kind: "allocation", amount: 5000, effective_on: "2026-09-01" },
      { kind: "allocation", amount: 5000, effective_on: "2026-10-01" },
      { kind: "spend", amount: -6000, effective_on: "2026-10-05" },
    ],
    2,
    "2026-11-09",
  );
  assert.equal(s.balance, 4000);
  assert.equal(s.lots[0].remaining, 0);
  assert.equal(s.lots[1].remaining, 4000);
  assert.equal(s.expirable, 0);
});

test("budget: an allocation expires 1 + rollover months after it starts", () => {
  const s = summariseBudget([{ kind: "allocation", amount: 5000, effective_on: "2026-08-01" }], 2, "2026-11-09");
  assert.equal(s.lots[0].expires_on, "2026-11-01");
  assert.equal(s.expirable, 5000);
  const after = summariseBudget(
    [
      { kind: "allocation", amount: 5000, effective_on: "2026-08-01" },
      { kind: "expiry", amount: -5000, effective_on: "2026-11-09" },
    ],
    2,
    "2026-11-09",
  );
  assert.equal(after.balance, 0);
  assert.equal(after.expirable, 0);
  assert.equal(after.expired, 5000);
});

test("budget: top-ups never expire, and soon-to-expire money is flagged", () => {
  const s = summariseBudget(
    [
      { kind: "top_up", amount: 1000, effective_on: "2025-01-01" },
      { kind: "allocation", amount: 2000, effective_on: "2026-08-20" },
    ],
    2,
    "2026-11-09",
  );
  assert.equal(s.expirable, 0);
  assert.equal(s.expiringSoon, 2000);
  assert.equal(s.nextExpiry, "2026-11-20");
});

test("budget: spend before any credit is applied when credit arrives", () => {
  const s = summariseBudget(
    [
      { kind: "spend", amount: -300, effective_on: "2026-10-01" },
      { kind: "allocation", amount: 1000, effective_on: "2026-10-02" },
    ],
    2,
    "2026-10-10",
  );
  assert.equal(s.balance, 700);
  assert.equal(s.lots[0].remaining, 700);
});

test("addMonths clamps to month end", () => {
  assert.equal(addMonths("2026-01-31", 1), "2026-02-28");
  assert.equal(addMonths("2026-11-30", 3), "2027-02-28");
});

test("structureBrief keeps the client's words and asks instead of guessing", () => {
  const { title, brief } = structureBrief("We need an Instagram carousel for our scholarship launch.");
  assert.equal(title, "Instagram carousel for our scholarship launch");
  assert.match(brief.summary, /scholarship launch/);
  assert.match(brief.deliverables, /1080 x 1350/);
  assert.match(brief.questions, /When do you need/);
  assert.equal(brief.objective, "");
});

test("parseDraft reads fenced JSON and rejects junk", () => {
  const good = parseDraft('Here you go:\n```json\n{"title":"Booth","service":"event-branding","summary":"A booth","deliverables":["Back wall","Counter"]}\n```');
  assert.ok(good);
  assert.equal(good.title, "Booth");
  assert.equal(good.service, "event-branding");
  assert.equal(good.brief.deliverables, "Back wall\nCounter");
  assert.equal(parseDraft("no json here"), null);
  assert.equal(parseDraft('{"title":"x"}'), null, "a draft without a summary is not usable");
  const unknownService = parseDraft('{"summary":"x","service":"rocketry"}');
  assert.equal(unknownService?.service, "");
});

test("normaliseBrief drops unknown fields and caps length", () => {
  const b = normaliseBrief({ summary: "x".repeat(5000), evil: "<script>", tone: 5 });
  assert.equal(b.summary.length, 4000);
  assert.equal(b.tone, "");
  assert.equal("evil" in b, false);
});

test("titleFrom trims greetings and long text", () => {
  assert.equal(titleFrom("Hi, we need a pitch deck."), "Pitch deck");
  assert.ok(titleFrom("a ".repeat(100)).length <= 60);
});

test("plans map from Stripe", () => {
  for (const p of PLANS) assert.equal(planByLookupKey(p.lookupKey)?.id, p.id);
  assert.equal(planByLookupKey("unknown"), undefined);
  assert.equal(planStatusFromStripe("unpaid"), "past_due");
  assert.equal(planStatusFromStripe("incomplete_expired"), "canceled");
  assert.equal(planStatusFromStripe("incomplete"), "inactive");
});

test("format helpers", () => {
  assert.equal(safeFileName("../../My Logo (final).PNG"), "My-Logo-final.PNG");
  assert.equal(safeFileName("..."), "file");
  assert.equal(money(1500), "£1,500");
  assert.equal(money(-12.5, "ngn", 2), "-₦12.50");
});

import { deliveryTiming, timingText, onTimeRecord, ukDate } from "../src/lib/ontime.ts";

test("budget: a payout returns unused budget and leaves nothing to spend", () => {
  const s = summariseBudget(
    [
      { kind: "allocation", amount: 5000, effective_on: "2026-09-01" },
      { kind: "spend", amount: -1800, effective_on: "2026-09-10" },
      { kind: "payout", amount: -3200, effective_on: "2026-10-01" },
    ],
    12,
    "2026-11-09",
  );
  assert.equal(s.balance, 0);
  assert.equal(s.spent, 1800);
  assert.equal(s.paidOut, 3200);
  assert.equal(s.expirable, 0);
});

test("ontime: delivery against the agreed date", () => {
  assert.deepEqual(deliveryTiming(null, null, "2026-11-09"), { state: "none" });
  assert.deepEqual(deliveryTiming("2026-11-12", "2026-11-12", "2026-11-20"), { state: "on_time", days: 0 });
  assert.deepEqual(deliveryTiming("2026-11-12", "2026-11-14", "2026-11-20"), { state: "late", days: 2 });
  assert.deepEqual(deliveryTiming("2026-11-12", null, "2026-11-09"), { state: "due", days: 3 });
  assert.deepEqual(deliveryTiming("2026-11-12", null, "2026-11-13"), { state: "overdue", days: 1 });
  assert.equal(timingText({ state: "late", days: 1 }), "First files delivered 1 day late");
  assert.equal(timingText({ state: "due", days: 0 }), "Due today");
  assert.deepEqual(
    onTimeRecord([
      { due: "2026-11-01", firstDelivered: "2026-10-31" },
      { due: "2026-11-01", firstDelivered: "2026-11-02" },
      { due: "2026-11-01", firstDelivered: null },
      { due: null, firstDelivered: "2026-11-02" },
    ]),
    { onTime: 1, total: 2 },
  );
  // 23:30 UTC on 9 Nov is still 9 Nov in London in winter, 10 Nov in summer time.
  assert.equal(ukDate("2026-11-09T23:30:00Z"), "2026-11-09");
  assert.equal(ukDate("2026-07-09T23:30:00Z"), "2026-07-10");
});

import { parseHtml, pickPalette, pickFonts, pickLogo, normaliseUrl } from "../src/lib/brand-scan.ts";
import { addWorkingDays } from "../src/lib/ontime.ts";

test("brand scan: reads title, logo, colours and fonts from a page", () => {
  const html = `<html><head><title>Acme Foods | Snacks for offices</title>
  <meta name="description" content="Office snack boxes in Lagos.">
  <meta name="theme-color" content="#E0A526">
  <link rel="apple-touch-icon" href="/apple.png">
  <link href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;700&display=swap" rel="stylesheet">
  <style>body{color:#111;background:#fff} .btn{background:#1A1B3A} .tag{color:#1a1b3a} h1{font-family:"Space Grotesk",sans-serif}</style>
  </head><body><img class="site-logo" src="/img/acme-logo.svg" alt="Acme"><h1>Snacks that keep teams going</h1><script>var x="#00ff00"</script></body></html>`;
  const f = parseHtml(html, "https://acme.example/");
  assert.equal(f.title, "Acme Foods | Snacks for offices");
  assert.equal(f.description, "Office snack boxes in Lagos.");
  assert.equal(pickLogo(f.logoCandidates), "https://acme.example/img/acme-logo.svg");
  const palette = pickPalette(f.css, f.themeColor);
  assert.equal(palette[0], "#e0a526");
  assert.ok(palette.includes("#1a1b3a"));
  assert.ok(!palette.includes("#111111") && !palette.includes("#ffffff"));
  assert.deepEqual(pickFonts(f.css, f.fontLinks), ["Space Grotesk"]);
  assert.deepEqual(f.headings, ["Snacks that keep teams going"]);
});

test("brand scan: refuses private and odd addresses", () => {
  assert.equal(normaliseUrl("acme.co.uk"), "https://acme.co.uk/");
  assert.equal(normaliseUrl("http://localhost:3000"), null);
  assert.equal(normaliseUrl("http://169.254.169.254/latest"), null);
  assert.equal(normaliseUrl("ftp://acme.com"), null);
  assert.equal(normaliseUrl("not a url"), null);
});

test("ontime: working days skip weekends", () => {
  assert.equal(addWorkingDays("2026-11-13", 1), "2026-11-16"); // Fri + 1 = Mon
  assert.equal(addWorkingDays("2026-11-09", 2), "2026-11-11"); // Mon + 2 = Wed
  assert.equal(addWorkingDays("2026-11-14", 0), "2026-11-16"); // Sat lands on Mon
});
