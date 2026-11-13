import { test } from "node:test";
import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import {
  signIdentity,
  readIdentity,
  bearerMatches,
  custardSignatureValid,
  projectNumber,
  periodRange,
} from "../src/lib/custard-sign.ts";
import { describeWorkspace, describeProject, monthlyAtListPrices, type Lookup } from "../src/lib/support-view.ts";

const USER = "11111111-1111-4111-8111-111111111111";
const ORG = "22222222-2222-4222-8222-222222222222";
const OTHER = "33333333-3333-4333-8333-333333333333";

test("a signed identity reads back, and nothing else does", () => {
  const token = signIdentity(USER, ORG, "s3cret");
  assert.match(token, /^nka1\./);
  assert.ok(token.length < 130, "fits Custard's user id");
  assert.deepEqual(readIdentity(token, "s3cret"), { userId: USER, orgId: ORG });
  assert.equal(signIdentity(USER, ORG, "s3cret"), token, "stable, so Custard recognises the same client");

  assert.equal(readIdentity(token, "other-secret"), null, "wrong secret");
  assert.equal(readIdentity(token.replace(ORG, OTHER), "s3cret"), null, "org swapped");
  assert.equal(readIdentity(token.replace(USER, OTHER), "s3cret"), null, "user swapped");
  assert.equal(readIdentity(USER, "s3cret"), null, "a bare user id from a browser");
  assert.equal(readIdentity(`nka1.${USER}.${ORG}.`, "s3cret"), null, "no signature");
  assert.equal(readIdentity(undefined, "s3cret"), null);
  assert.equal(readIdentity(token, ""), null, "no secret configured");
  assert.throws(() => signIdentity(USER, ORG, ""));
});

test("the lookup secret is checked from either header", () => {
  assert.ok(bearerMatches("Bearer abc123", null, "abc123"));
  assert.ok(bearerMatches("bearer abc123", null, "abc123"));
  assert.ok(bearerMatches(null, "abc123", "abc123"));
  assert.ok(!bearerMatches("Bearer abc124", null, "abc123"));
  assert.ok(!bearerMatches("Bearer ", "", "abc123"));
  assert.ok(!bearerMatches(null, null, "abc123"));
  assert.ok(!bearerMatches("Bearer abc123", null, ""), "no secret configured means no entry");
});

test("Custard webhook signatures: valid, tampered, stale, missing", () => {
  const secret = "whsec_test";
  const body = '{"event":"conversation.finished"}';
  const t = 1_800_000_000;
  const v1 = createHmac("sha256", secret).update(`${t}.${body}`).digest("hex");
  assert.ok(custardSignatureValid(body, `t=${t},v1=${v1}`, secret, t + 10));
  assert.ok(!custardSignatureValid(body + " ", `t=${t},v1=${v1}`, secret, t + 10), "body changed");
  assert.ok(!custardSignatureValid(body, `t=${t},v1=${v1}`, secret, t + 301), "older than 5 minutes");
  assert.ok(!custardSignatureValid(body, `t=${t}`, secret, t), "no signature");
  assert.ok(!custardSignatureValid(body, null, secret, t), "no header");
  assert.ok(!custardSignatureValid(body, `t=${t},v1=${v1}`, "", t), "no secret configured");
});

test("project references", () => {
  assert.equal(projectNumber("1042"), 1042);
  assert.equal(projectNumber("#1042"), 1042);
  assert.equal(projectNumber("NKA-1042"), 1042);
  assert.equal(projectNumber("project 1042"), 1042);
  assert.equal(projectNumber(1042), 1042);
  assert.equal(projectNumber("A-1042"), null);
  assert.equal(projectNumber("1042; drop table"), null);
  assert.equal(projectNumber(""), null);
});

test("owner periods use UK days", () => {
  // 14:30 UK on Wednesday 15 July 2026 (BST, UTC+1)
  const now = new Date("2026-07-15T13:30:00Z");
  assert.equal(periodRange("today", now)?.from.toISOString(), "2026-07-14T23:00:00.000Z");
  assert.equal(periodRange("yesterday", now)?.from.toISOString(), "2026-07-13T23:00:00.000Z");
  assert.equal(periodRange("yesterday", now)?.to.toISOString(), "2026-07-14T23:00:00.000Z");
  assert.equal(periodRange("this_week", now)?.from.toISOString(), "2026-07-12T23:00:00.000Z");
  assert.equal(periodRange("this_month", now)?.from.toISOString(), "2026-06-30T23:00:00.000Z");
  // Winter (GMT)
  const winter = new Date("2026-11-13T09:00:00Z");
  assert.equal(periodRange("today", winter)?.from.toISOString(), "2026-11-13T00:00:00.000Z");
  assert.equal(periodRange("this_week", winter)?.from.toISOString(), "2026-11-09T00:00:00.000Z");
  assert.equal(periodRange("forever", now), null);
});

const sample: Lookup = {
  role: "owner",
  organisation: "Support Co",
  plan: "growth",
  plan_status: "active",
  active_limit: 2,
  hours: { left: 12, used: 8, granted: 20, carried: 0, allowance: 20, top_ups: 0 },
  instant: { used: 3, limit: 30 },
  lead: "Kemi",
  library_files: 4,
  projects: [
    {
      id: "44444444-4444-4444-8444-444444444444",
      number: 1042,
      title: "Launch posts",
      kind: "brief",
      status: "in_review",
      asked_for: null,
      agreed_date: "2026-11-12",
      submitted_at: "2026-11-05T10:00:00Z",
      completed_at: null,
      first_files_at: "2026-11-11T16:00:00Z",
      files_to_review: 2,
      approved_files: 0,
    },
    {
      id: "55555555-5555-4555-8555-555555555555",
      number: 1043,
      title: "Deck",
      kind: "brief",
      status: "in_progress",
      asked_for: "2026-11-20",
      agreed_date: "2026-11-10",
      submitted_at: "2026-11-06T10:00:00Z",
      completed_at: null,
      first_files_at: null,
      files_to_review: 0,
      approved_files: 0,
    },
  ],
};

test("workspace answer uses the workspace's own words and links", () => {
  const now = new Date("2026-11-13T09:00:00Z");
  const v = describeWorkspace(sample, "https://nka.studio", now);
  assert.equal(v.found, true);
  assert.match(v.summary, /Support Co is on the Growth plan/);
  assert.match(v.summary, /12 team hours left/);
  assert.match(v.summary, /1 project waiting for their review/);
  const [a, b] = v.details.projects;
  assert.equal(a.status, "Ready for review");
  assert.equal(a.timing, "First files delivered on time");
  assert.equal(a.link, "https://nka.studio/app/projects/44444444-4444-4444-8444-444444444444");
  assert.equal(b.timing, "3 days overdue");
  assert.equal(v.details.lead_designer, "Kemi");
  assert.equal(v.details.library.link, "https://nka.studio/app/library");
});

test("a failed payment and no plan read plainly", () => {
  const v = describeWorkspace({ ...sample, plan: "none", plan_status: "past_due", hours: null, projects: [] }, "https://nka.studio");
  assert.match(v.summary, /is on no plan/);
  assert.match(v.summary, /last payment failed/);
  assert.equal(v.details.team_hours, null);
});

test("one project by number, and a number that isn't theirs", () => {
  const now = new Date("2026-11-13T09:00:00Z");
  const one = describeProject(sample, 1042, "https://nka.studio", now);
  assert.equal(one.found, true);
  assert.match(one.summary, /Project 1042, Launch posts: Ready for review/);
  const none = describeProject({ ...sample, projects: [] }, 9999, "https://nka.studio", now);
  assert.equal(none.found, false);
});

test("monthly plan income at list prices", () => {
  const m = monthlyAtListPrices([
    { plan: "growth", currency: "gbp", count: 2 },
    { plan: "starter", currency: "ngn", count: 1 },
    { plan: "bespoke", currency: "gbp", count: 1 },
  ]);
  assert.equal(m.customers, 3);
  assert.equal(m.by_currency.gbp, 598);
  assert.equal(m.by_currency.ngn, 200000);
});
