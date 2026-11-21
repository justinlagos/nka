import { test } from "node:test";
import assert from "node:assert/strict";
import { validate, toJsonSchema, type Schema } from "../src/lib/api/schema.ts";
import { cmyk, contrast, normaliseBrand, normaliseHex, roles, textOn, esc, slug, cleanFont } from "../src/lib/api/brand.ts";
import { generateKey, hashKey, keyHashFrom, signWebhook, verifyWebhook } from "../src/lib/api/keys.ts";
import { isPrivateAddress, publicUrl } from "../src/lib/api/net.ts";
import { ApiError, GROUPS, resolveBrand, type Deps, type ModelPart } from "../src/lib/api/types.ts";
import { ENDPOINTS, ON_REQUEST, catalogue } from "../src/lib/api/catalogue.ts";
import { openapi, requestSchema } from "../src/lib/api/openapi.ts";
import { handleMcp, toolList, type McpTools } from "../src/lib/api/mcp.ts";
import { coloursIn, fontsIn, ruleFindings, score, brandCheck } from "../src/lib/api/endpoints/brand-check.ts";
import { brandGuidelines, pairings, swatches, tokensCss, typeScale } from "../src/lib/api/endpoints/brand-guidelines.ts";
import { documents, layoutSections, money, numbersTraceable, quoteTotals, slidesFrom } from "../src/lib/api/endpoints/documents.ts";
import { csvCell, ecards, merge, fieldsFor } from "../src/lib/api/endpoints/ecards.ts";
import { FORMATS, fit, renderPost, socialTemplates, textWidth, wrap, type Format } from "../src/lib/api/endpoints/social-templates.ts";
import { SERVICE_OPTIONS } from "../src/lib/brief.ts";

const BRAND = { name: "Acme Bank", colours: [{ hex: "#0B3D91", name: "Harbour", role: "primary" }, { hex: "#f2a900", role: "accent" }, { hex: "#12151c", role: "neutral" }], fonts: { heading: "Sora", body: "Inter" }, about: "A bank for small businesses.", voice: "Plain and direct." };

type Saved = { spec: Record<string, unknown>; recipients: { token: string; name: string; ref: string; fields: Record<string, string> }[]; expiresAt: string | null };
function deps(over: Partial<Deps> = {}, saved: Saved[] = []): Deps {
  return {
    origin: "https://nka.test",
    model: null,
    fetchFile: async () => null,
    scanSite: async () => null,
    hasDns: async () => null,
    saveCard: async (spec, recipients, expiresAt) => {
      saved.push({ spec, recipients, expiresAt });
      return "11111111-1111-4111-8111-111111111111";
    },
    ...over,
  };
}
const run = (e: (typeof ENDPOINTS)[number], input: unknown, d: Deps) => {
  const checked = validate(e.input, input);
  assert.ok(checked.ok, `input should be valid: ${JSON.stringify(!checked.ok && checked.issues)}`);
  return e.run(checked.value as never, d);
};
const text = (d: string | Uint8Array) => (typeof d === "string" ? d : new TextDecoder().decode(d));

// ---------- schema ----------

test("schema: reports every problem with its path, and rejects unknown fields", () => {
  const s: Schema = { type: "object", properties: { a: { type: "string", minLength: 1 }, n: { type: "integer", minimum: 1, maximum: 3 }, list: { type: "array", maxItems: 2, items: { type: "object", properties: { hex: { type: "string", format: "hex-colour" } }, required: ["hex"] } } }, required: ["a"] };
  const bad = validate(s, { n: 9, list: [{ hex: "red" }, {}], extra: 1 });
  assert.equal(bad.ok, false);
  const paths = !bad.ok ? bad.issues.map((i) => i.path) : [];
  assert.deepEqual(paths.sort(), ["a", "extra", "list[0].hex", "list[1].hex", "n"].sort());
  const good = validate<{ a: string }>(s, { a: "  x  ", n: 2 });
  assert.ok(good.ok && good.value.a === "x", "strings are trimmed");
  assert.equal(validate(s, "nope").ok, false);
  assert.equal(validate(s, { a: "x", list: [1, 2, 3] }).ok, false);
});

test("schema: defaults are filled and uri/date formats are checked", () => {
  const s: Schema = { type: "object", properties: { c: { type: "string", enum: ["GBP", "USD"], default: "GBP" }, u: { type: "string", format: "uri" }, d: { type: "string", format: "date" } } };
  const ok = validate<{ c: string }>(s, {});
  assert.ok(ok.ok && ok.value.c === "GBP");
  assert.equal(validate(s, { u: "javascript:alert(1)" }).ok, false);
  assert.equal(validate(s, { u: "https://example.com/a" }).ok, true);
  assert.equal(validate(s, { d: "21/11/2026" }).ok, false);
});

test("schema: every endpoint's own example passes its schema, and converts to JSON Schema", () => {
  for (const e of ENDPOINTS) {
    const r = validate(e.input, e.example);
    assert.ok(r.ok, `${e.id} example: ${JSON.stringify(!r.ok && r.issues)}`);
    const js = toJsonSchema(e.input) as { type: string; properties: Record<string, unknown>; additionalProperties: boolean };
    assert.equal(js.type, "object");
    assert.equal(js.additionalProperties, false);
    assert.ok(!JSON.stringify(js).includes("hex-colour"), "non-standard format is converted to a pattern");
  }
});

// ---------- brand ----------

test("brand: hex is normalised, duplicates dropped, roles assigned, text colour readable", () => {
  assert.equal(normaliseHex("FFF"), "#ffffff");
  assert.equal(normaliseHex("#12345"), null);
  const b = normaliseBrand({ ...BRAND, colours: [...BRAND.colours, { hex: "#0b3d91" }, { hex: "nope" }] });
  assert.equal(b.colours.length, 3);
  const r = roles(b);
  assert.equal(r.primary, "#0b3d91");
  assert.equal(r.accent, "#f2a900");
  assert.equal(r.onPrimary, "#ffffff");
  assert.equal(textOn("#f2a900"), "#111111");
  assert.ok(contrast(r.ink, "#ffffff") >= 7, "ink is always readable on white");
  const pale = roles(normaliseBrand({ name: "Pale", colours: [{ hex: "#ffe9a8" }] }));
  assert.ok(contrast(pale.ink, "#ffffff") >= 7, "a pale-only palette still gets a dark ink");
});

test("brand: contrast and cmyk match known values", () => {
  assert.equal(Math.round(contrast("#000000", "#ffffff")), 21);
  assert.equal(contrast("#777777", "#777777"), 1);
  assert.deepEqual(cmyk("#000000"), [0, 0, 0, 100]);
  assert.deepEqual(cmyk("#ff0000"), [0, 100, 100, 0]);
});

test("brand: font names and text can't break out of HTML, CSS or SVG", () => {
  assert.equal(cleanFont('Inter"; } body { display:none } /*'), "Inter body displaynone");
  assert.equal(esc(`<img src=x onerror="a('b')">`), "&lt;img src=x onerror=&quot;a(&#39;b&#39;)&quot;&gt;");
  assert.equal(slug("Açme Bank / Q4 Report!"), "acme-bank-q4-report");
  assert.equal(slug("../../etc"), "etc");
  assert.equal(slug("日本"), "file");
});

test("brand: a website fills the gaps but never overrides what the caller gave", async () => {
  const d = deps({ scanSite: async () => ({ company: "Scanned Ltd", about: "From the site.", voice: "", palette: ["#ff0000", "#00ff00"], fonts: ["Lato"], logoUrl: "https://x.test/logo.png" }) });
  const b = await resolveBrand({ website: "https://x.test", colours: [{ hex: "#123456" }] }, d);
  assert.equal(b.name, "Scanned Ltd");
  assert.deepEqual(b.colours.map((c) => c.hex), ["#123456"]);
  assert.equal(b.fonts.body, "Lato");
  await assert.rejects(() => resolveBrand({ colours: [{ hex: "#123456" }] }, deps()), (e: ApiError) => e.status === 422 && e.code === "invalid_request");
});

// ---------- keys, webhooks, addresses ----------

test("keys: random, hashed, and read only from a well-formed header", () => {
  const a = generateKey();
  const b = generateKey();
  assert.notEqual(a.key, b.key);
  assert.match(a.key, /^nka_live_[A-Za-z0-9_-]{43}$/);
  assert.equal(a.hash, hashKey(a.key));
  assert.ok(!a.prefix.includes(a.key.slice(20)), "the stored prefix doesn't reveal the key");
  assert.equal(keyHashFrom(`Bearer ${a.key}`), a.hash);
  assert.equal(keyHashFrom(null, a.key), a.hash);
  assert.equal(keyHashFrom("Bearer sk_test_123"), null);
  assert.equal(keyHashFrom(`Basic ${a.key}`), null);
  assert.equal(keyHashFrom("Bearer nka_live_short"), null);
});

test("webhooks: signature verifies, and fails on a changed body, wrong secret or old timestamp", () => {
  const body = JSON.stringify({ type: "job.finished" });
  const sig = signWebhook("whsec_a", body, 1000);
  assert.equal(verifyWebhook("whsec_a", body, sig, 1010), true);
  assert.equal(verifyWebhook("whsec_a", body + " ", sig, 1010), false);
  assert.equal(verifyWebhook("whsec_b", body, sig, 1010), false);
  assert.equal(verifyWebhook("whsec_a", body, sig, 2000), false);
  assert.equal(verifyWebhook("whsec_a", body, "garbage", 1010), false);
});

test("addresses: private, loopback and metadata addresses are never fetched", () => {
  for (const ip of ["127.0.0.1", "10.1.2.3", "172.16.0.1", "172.31.255.255", "192.168.1.1", "169.254.169.254", "100.64.0.1", "0.0.0.0", "::1", "fe80::1", "fd00::1", "::ffff:127.0.0.1", "::ffff:7f00:1", "224.0.0.1"]) {
    assert.equal(isPrivateAddress(ip), true, ip);
  }
  for (const ip of ["8.8.8.8", "172.32.0.1", "1.1.1.1", "2606:4700:4700::1111"]) assert.equal(isPrivateAddress(ip), false, ip);
  for (const u of ["http://localhost/x", "http://127.0.0.1/", "http://2130706433/", "http://0x7f.1/", "http://[::1]/", "http://169.254.169.254/latest/meta-data", "ftp://example.com", "file:///etc/passwd", "http://user:pw@example.com", "http://example.com:22/", "http://intranet/", "http://db.internal/", "javascript:alert(1)"]) {
    assert.equal(publicUrl(u), null, u);
  }
  assert.equal(publicUrl("https://example.com/logo.png#x")?.toString(), "https://example.com/logo.png");
});

// ---------- brand check ----------

test("brand check: finds off-palette colours and fonts in code, ignores greys and id selectors", () => {
  const b = normaliseBrand(BRAND);
  const css = `#add { color: #0b3d91 } #bed:hover{} .a{background:#0b3e95;color:#fff;border:1px solid #333} .b{fill:rgb(255, 0, 80);font-family:"Roboto",sans-serif} .c{font-family: Inter, sans-serif}`;
  assert.deepEqual([...coloursIn(css).keys()].sort(), ["#0b3d91", "#0b3e95", "#333333", "#ff0050", "#ffffff"].sort());
  assert.deepEqual(fontsIn(css), ["Roboto", "Inter"]);
  const f = ruleFindings(css, b);
  assert.deepEqual(f.map((x) => [x.rule, x.evidence, x.severity]).sort(), [["colour", "#0b3e95", "medium"], ["colour", "#ff0050", "medium"], ["typography", "Roboto", "high"]].sort());
  assert.deepEqual(score([]), { score: 100, verdict: "pass" });
  assert.deepEqual(score(f), { score: 55, verdict: "fail" });
  assert.deepEqual(score(f.filter((x) => x.rule === "colour")), { score: 80, verdict: "review" });
  assert.deepEqual(score([{ ...f[0], severity: "low" }]), { score: 96, verdict: "pass" });
  assert.equal(score([...f, ...f, ...f]).score, 0);
});

test("brand check: runs on code without a model and says what it couldn't check", async () => {
  const out = await run(brandCheck, brandCheck.example, deps());
  const r = out.result as { score: number; verdict: string; findings: unknown[]; checked_by: string[]; not_checked: string[] };
  assert.equal(r.findings.length, 2);
  assert.equal(r.score, 65);
  assert.deepEqual(r.checked_by, ["rules"]);
  assert.ok(r.not_checked.includes("logo"));
});

test("brand check: images need the model; model findings are cleaned and the score is ours", async () => {
  await assert.rejects(() => run(brandCheck, { brand: BRAND, asset: { type: "image", url: "https://x.test/a.png" } }, deps({ fetchFile: async () => ({ body: new Uint8Array([1]), type: "image/png", url: "" }) })), (e: ApiError) => e.code === "model_unavailable");
  await assert.rejects(() => run(brandCheck, { brand: BRAND, asset: { type: "image", url: "https://x.test/a.png" } }, deps({ model: async () => "{}" })), (e: ApiError) => e.code === "asset_unreadable");
  let seen: ModelPart[] = [];
  const d = deps({
    fetchFile: async () => ({ body: new Uint8Array([1, 2, 3]), type: "image/png; charset=binary", url: "" }),
    model: async (_s, parts) => {
      seen = parts;
      return 'Sure: {"score": 100, "findings":[{"rule":"logo","severity":"high","detail":"Logo is stretched.","evidence":"top left"},{"rule":"made-up","severity":"critical","detail":"x"},{"rule":"voice","severity":"low","detail":""}],"summary":"One problem."}';
    },
  });
  const out = await run(brandCheck, { brand: BRAND, asset: { type: "image", url: "https://x.test/a.png" } }, d);
  const r = out.result as { score: number; verdict: string; findings: { rule: string; severity: string }[] };
  assert.equal(seen[1].type, "image");
  assert.deepEqual(r.findings.map((f) => [f.rule, f.severity]), [["logo", "high"], ["layout", "low"]]);
  assert.equal(r.score, 71, "score comes from the findings, not from the model's own number");
  assert.equal(r.verdict, "review");
});

// ---------- brand guidelines ----------

test("guidelines: colour data, pairings and type scale are computed", () => {
  const b = normaliseBrand(BRAND);
  const sw = swatches(b);
  assert.equal(sw[0].name, "Harbour");
  assert.equal(sw[0].text_on, "#ffffff");
  assert.equal(sw[0].tints.length, 6);
  assert.equal(sw[0].tints[3], "#0b3d91");
  const p = pairings(b);
  assert.ok(p.every((x) => x.text !== x.background));
  const whiteOnPrimary = p.find((x) => x.text === "#ffffff" && x.background === "#0b3d91");
  assert.ok(whiteOnPrimary && whiteOnPrimary.aa_body && whiteOnPrimary.ratio > 9);
  const accentOnWhite = p.find((x) => x.text === "#f2a900" && x.background === "#ffffff");
  assert.ok(accentOnWhite && !accentOnWhite.aa_large, "a yellow on white is correctly failed");
  assert.deepEqual(typeScale().map((s) => s.px), [49, 39, 31, 25, 20, 16, 13]);
  assert.match(tokensCss(b), /--color-primary: #0b3d91;/);
});

test("guidelines: returns HTML, tokens JSON and CSS, with hostile input escaped", async () => {
  const hostile = { ...BRAND, name: `Acme</title><script>alert(1)</script>`, about: `<img src=x onerror=alert(1)>`, fonts: { heading: `Sora"}</style><script>x</script>`, body: "Inter" } };
  const out = await run(brandGuidelines, { brand: hostile }, deps());
  assert.deepEqual(out.files.map((f) => f.mime.split(";")[0]), ["text/html", "application/json", "text/css"]);
  const html = text(out.files[0].data);
  assert.ok(!/<script/i.test(html), "no script tag survives");
  assert.ok(!html.includes("<img src=x"), "about text is escaped");
  assert.equal((html.match(/<\/style>/g) ?? []).length, 1, "the style block can't be closed early");
  assert.ok(out.files.every((f) => /^[a-z0-9][a-z0-9._-]*$/.test(f.name)), "file names are safe for storage paths");
  const tokens = JSON.parse(text(out.files[1].data));
  assert.equal(tokens.color.primary, "#0b3d91");
  const r = out.result as { voice: { principles: unknown[] }; notes: string[] };
  assert.equal(r.voice.principles.length, 0);
  assert.ok(r.notes.some((n) => /Voice principles need the model/.test(n)));
});

test("guidelines: voice principles come from the model only when there is a description, and need colours", async () => {
  let calls = 0;
  const model = async () => {
    calls++;
    return '{"principles":[{"name":"Plain","means":"We use short words.","do":"Fees are on page one.","dont":"Leverage our fee transparency."},{"name":"","means":"dropped"}]}';
  };
  const out = await run(brandGuidelines, { brand: BRAND }, deps({ model }));
  assert.equal(((out.result as { voice: { principles: unknown[] } }).voice.principles).length, 1);
  await run(brandGuidelines, { brand: { name: "Bare", colours: [{ hex: "#123456" }] } }, deps({ model }));
  assert.equal(calls, 1, "no description, no model call");
  await assert.rejects(() => run(brandGuidelines, { brand: { name: "No colours" } }, deps()), (e: ApiError) => e.status === 422);
});

// ---------- documents ----------

test("documents: quote maths in whole pence, tax after discount", () => {
  const t = quoteTotals({ currency: "GBP", items: [{ description: "A", quantity: 3, unit_price: 0.1 }, { description: "B", quantity: 1.5, unit_price: 19.99 }, { description: "C", quantity: 1, unit_price: 3250.5 }], discount: 30.29, tax_rate: 20 });
  assert.deepEqual(t.lines.map((l) => l.amount), [30, 2999, 325050]);
  assert.equal(t.subtotal, 328079);
  assert.equal(t.discount, 3029);
  assert.equal(t.tax, 65010);
  assert.equal(t.total, 390060);
  assert.equal(money(t.total, "GBP"), "£3,900.60");
  assert.equal(money(-500, "NGN"), "-₦5.00");
  assert.equal(quoteTotals({ items: [{ description: "A", quantity: 1, unit_price: 10 }], discount: 50 }).total, 0, "a discount can't take the total below zero");
});

test("documents: raw text is laid out into sections without a model", () => {
  const s = layoutSections("# Scope\nNew fascia sign.\nTwo window vinyls.\n\n## Timing\n- Design: 5 days\n- Print: 10 days\n\nNext steps\nSign the quote. Pay the deposit.\n");
  assert.deepEqual(s.map((x) => x.heading), ["Scope", "Timing", "Next steps"]);
  assert.equal(s[0].body, "New fascia sign. Two window vinyls.");
  assert.deepEqual(s[1].bullets, ["Design: 5 days", "Print: 10 days"]);
  assert.equal(layoutSections("Just one paragraph of text.").length, 1);
  assert.equal(layoutSections("").length, 0);
});

test("documents: a model draft with a figure the caller didn't give is thrown away", async () => {
  const src = "We will redesign 12 branches by March. Budget is 40,000.";
  assert.equal(numbersTraceable([{ heading: "Plan", body: "12 branches, budget 40000.", bullets: [] }], src), true);
  assert.equal(numbersTraceable([{ heading: "Plan", body: "12 branches in 6 weeks.", bullets: [] }], src), false);
  const input = { type: "proposal", brand: BRAND, title: "Branch refresh", content: src };
  const honest = await run(documents, input, deps({ model: async () => '{"sections":[{"heading":"Plan","body":"We will redesign 12 branches by March.","bullets":["Budget: 40,000"]}]}' }));
  assert.equal((honest.result as { structured_by: string }).structured_by, "model");
  const invented = await run(documents, input, deps({ model: async () => '{"sections":[{"heading":"Plan","body":"We will redesign 12 branches and lift sales by 35%.","bullets":[]}]}' }));
  const r = invented.result as { structured_by: string; notes: string[] };
  assert.equal(r.structured_by, "layout");
  assert.ok(r.notes.some((n) => /figure that wasn't in your content/.test(n)));
  assert.ok(!text(invented.files[0].data).includes("35%"));
});

test("documents: the quote example renders with calculated totals and escaped text", async () => {
  const out = await run(documents, { ...documents.example, title: `Signage <b>refresh</b>` }, deps());
  const html = text(out.files[0].data);
  assert.ok(html.includes("£6,060.60"), "total = (1800 + 3250.50) * 1.2");
  assert.ok(html.includes("Signage &lt;b&gt;refresh&lt;/b&gt;"));
  assert.ok(html.includes("21 December 2026"));
  assert.deepEqual((out.result as { quote: unknown }).quote, { currency: "GBP", subtotal: 5050.5, discount: 0, tax: 1010.1, total: 6060.6 });
  assert.equal(out.files[0].name, "signage-b-refresh-b.html");
});

test("documents: validation of type-specific needs and price precision", async () => {
  await assert.rejects(() => run(documents, { type: "quote", brand: BRAND, title: "Q" }, deps()), (e: ApiError) => e.status === 422);
  await assert.rejects(() => run(documents, { type: "report", brand: BRAND, title: "R" }, deps()), (e: ApiError) => e.status === 422);
  await assert.rejects(() => run(documents, { type: "quote", brand: BRAND, title: "Q", quote: { items: [{ description: "A", quantity: 1, unit_price: 1.005 }] } }, deps()), (e: ApiError) => /two decimal/.test(e.message));
  assert.equal(validate(documents.input, { type: "memo", brand: BRAND, title: "x" }).ok, false);
});

test("documents: a deck becomes a real PowerPoint file plus HTML, long lists split across slides", async () => {
  const bullets = Array.from({ length: 14 }, (_, i) => `Point ${i + 1}`);
  assert.deepEqual(slidesFrom([{ heading: "Plan", body: "", bullets }]).map((s) => [s.heading, s.bullets.length]), [["Plan", 6], ["Plan (continued)", 6], ["Plan (continued)", 2]]);
  const out = await run(documents, { type: "deck", brand: BRAND, title: "Q4 review", sections: [{ heading: "Plan", bullets }, { heading: "Risks", body: "Two things could slip." }], quote: { items: [{ description: "Design", quantity: 2, unit_price: 500 }] } }, deps());
  const pptx = out.files[0].data as Uint8Array;
  assert.equal(out.files[0].name, "q4-review.pptx");
  assert.equal(String.fromCharCode(pptx[0], pptx[1]), "PK", "a pptx is a zip file");
  assert.ok(pptx.byteLength > 20_000);
  assert.equal((out.result as { slides: number }).slides, 6);
  assert.equal((text(out.files[1].data).match(/<section class="slide/g) ?? []).length, 6);
});

// ---------- e-cards ----------

test("e-cards: merge fields fill per recipient and never leak a raw placeholder", () => {
  const f = fieldsFor({ name: "Chidi Okeke", fields: { Branch: "Ikeja" } });
  assert.equal(merge("Merry Christmas, {{first_name}}", f), "Merry Christmas, Chidi");
  assert.equal(merge("Hi {{ name }} at {{BRANCH}}, {{missing}}.", f), "Hi Chidi Okeke at Ikeja.");
  assert.equal(merge("{{constructor}}{{__proto__}}", f), "");
  assert.equal(csvCell('=HYPERLINK("x")'), `"'=HYPERLINK(""x"")"`);
  assert.equal(csvCell("Ade, Bola"), `"Ade, Bola"`);
});

test("e-cards: one unguessable link per recipient, spec saved, no emails needed", async () => {
  const saved: Saved[] = [];
  const out = await run(ecards, ecards.example, deps({}, saved));
  const r = out.result as { card_id: string; template: string; preview_url: string; stats_url: string; recipients: { name: string; ref: string; url: string }[] };
  assert.equal(r.template, "snow");
  assert.equal(r.recipients.length, 2);
  assert.match(r.recipients[0].url, /^https:\/\/nka\.test\/c\/[A-Za-z0-9_-]{22}$/);
  assert.notEqual(r.recipients[0].url, r.recipients[1].url);
  assert.equal(r.preview_url, `${r.recipients[0].url}?preview=1`);
  assert.equal(r.stats_url, `https://nka.test/api/v1/ecards/${r.card_id}`);
  assert.equal(saved[0].recipients[1].fields.branch, "Marina");
  assert.equal((saved[0].spec as { colours: { primary: string } }).colours.primary, "#0b3d91");
  const csv = text(out.files[0].data).trim().split("\r\n");
  assert.equal(csv.length, 3);
  assert.ok(csv[1].includes(`"cust_001"`));
});

test("e-cards: rejects non-https buttons, past expiry dates and oversized lists", async () => {
  const base = ecards.example as Record<string, unknown>;
  await assert.rejects(() => run(ecards, { ...base, cta: { label: "Go", url: "http://x.test" } }, deps()), (e: ApiError) => /https/.test(e.message));
  await assert.rejects(() => run(ecards, { ...base, expires_on: "2020-01-01" }, deps()), (e: ApiError) => /future/.test(e.message));
  assert.equal(validate(ecards.input, { ...base, cta: { label: "Go", url: "javascript:alert(1)" } }).ok, false);
  assert.equal(validate(ecards.input, { ...base, recipients: [] }).ok, false);
  assert.equal(validate(ecards.input, { ...base, recipients: Array.from({ length: 501 }, () => ({ name: "A" })) }).ok, false);
});

// ---------- social templates ----------

test("social: text is wrapped and sized to stay inside its box", () => {
  const long = "Business accounts for traders, makers and market sellers now open in ten minutes flat";
  for (const w of [400, 700, 930]) {
    const f = fit(long, { w, h: 420 }, 100, 40);
    assert.ok(f.lines.every((l) => textWidth(l, f.size) <= w), `width ${w}`);
    assert.ok(f.lines.length * f.size * 1.12 <= 420);
  }
  const tiny = fit(long + " " + long + " " + long, { w: 300, h: 100 }, 60, 30);
  assert.ok(tiny.lines.at(-1)?.endsWith("…"), "text that can't fit is cut with an ellipsis, not allowed to overflow");
  assert.deepEqual(wrap("", 100, 20), []);
});

test("social: every layout in every format is well-formed SVG with nothing outside the canvas", () => {
  const b = normaliseBrand(BRAND);
  const posts = [
    { headline: "Business accounts open in ten minutes", body: "Bring your CAC number. We do the rest.", cta: "Open yours", kind: "announcement" as const, stat: "" },
    { headline: "Ask before you sign anything", body: "", cta: "", kind: "tip" as const, stat: "" },
    { headline: `Fees <explained> & "plain"`, body: "No small print.", cta: "", kind: "announcement" as const, stat: "" },
    { headline: "of new accounts are opened on a phone", body: "", cta: "See how", kind: "stat" as const, stat: "68%" },
    { headline: "They told us the fee before we asked", body: "A customer in Ikeja", cta: "", kind: "quote" as const, stat: "" },
  ];
  const layouts = new Set<string>();
  for (const format of Object.keys(FORMATS) as Format[]) {
    const { w, h } = FORMATS[format];
    posts.forEach((p, i) => {
      const { svg, layout } = renderPost(b, null, p, format, i);
      layouts.add(layout);
      assert.ok(svg.startsWith(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}"`));
      assert.ok(!/<(?!\/?(svg|title|rect|text|tspan|circle|image)\b)/.test(svg), `${format}/${layout}: only expected elements`);
      assert.ok(!svg.includes("<explained>"), "copy is escaped");
      assert.ok(!/NaN|undefined|Infinity/.test(svg), `${format}/${layout}: no broken numbers`);
      for (const m of svg.matchAll(/<tspan x="(-?[\d.]+)" y="(-?[\d.]+)">/g)) {
        assert.ok(+m[1] >= 0 && +m[1] <= w && +m[2] >= 0 && +m[2] <= h, `${format}/${layout}: text at ${m[1]},${m[2]} is on the canvas`);
      }
      for (const m of svg.matchAll(/<rect x="(-?[\d.]+)" y="(-?[\d.]+)" width="(-?[\d.]+)" height="(-?[\d.]+)"/g)) {
        assert.ok(+m[1] >= 0 && +m[2] >= 0 && +m[1] + +m[3] <= w + 1 && +m[2] + +m[4] <= h + 1 && +m[3] > 0 && +m[4] > 0, `${format}/${layout}: box inside canvas`);
      }
    });
  }
  assert.deepEqual([...layouts].sort(), ["block", "frame", "quote", "split", "stat"]);
});

test("social: caller's copy is used as written; a pack has one SVG per post per format plus a preview", async () => {
  const out = await run(socialTemplates, socialTemplates.example, deps());
  assert.equal(out.files.length, 2 * 2 + 1);
  assert.equal(out.files[0].name, "acme-bank-post-01-square.svg");
  assert.equal((out.result as { written_by: string }).written_by, "caller");
  await assert.rejects(() => run(socialTemplates, { brand: BRAND }, deps()), (e: ApiError) => e.status === 422);
  await assert.rejects(() => run(socialTemplates, { brand: BRAND, topic: "New branch in Enugu" }, deps()), (e: ApiError) => e.code === "model_unavailable");
});

test("social: model-written posts with invented figures are dropped", async () => {
  const model = async () => '{"posts":[{"headline":"Our Enugu branch opens 3 March","body":"","cta":"Visit us","kind":"announcement"},{"headline":"Trusted by 50,000 customers","body":"","cta":"","kind":"stat"},{"headline":"We explain every fee","body":"","cta":"","kind":"tip"}]}';
  const out = await run(socialTemplates, { brand: BRAND, topic: "Our Enugu branch opens on 3 March.", count: 3, formats: ["square"] }, deps({ model }));
  const r = out.result as { written_by: string; posts: { headline: string }[]; notes: string[] };
  assert.deepEqual(r.posts.map((p) => p.headline), ["Our Enugu branch opens 3 March", "We explain every fee"]);
  assert.equal(r.written_by, "model");
  assert.ok(r.notes.some((n) => /Read it before it goes out/.test(n)));
});

// ---------- catalogue, OpenAPI, MCP ----------

test("catalogue: live and on-request services cover the five groups, with no overlap", () => {
  assert.equal(ENDPOINTS.length, 10);
  assert.equal(new Set(ENDPOINTS.map((e) => e.id)).size, ENDPOINTS.length);
  assert.equal(new Set(ENDPOINTS.map((e) => e.path)).size, ENDPOINTS.length);
  const known = new Set(SERVICE_OPTIONS.map((s) => s.value));
  for (const s of ON_REQUEST) assert.ok(known.has(s.service), `${s.id} maps to a service Nka has`);
  assert.equal(new Set(ON_REQUEST.map((s) => s.id)).size, ON_REQUEST.length);
  assert.ok(!ON_REQUEST.some((s) => ENDPOINTS.some((e) => e.id === s.id)));
  for (const g of GROUPS) assert.ok([...ENDPOINTS, ...ON_REQUEST].some((x) => x.group === g), `${g} has services`);
  assert.ok([...ENDPOINTS, ...ON_REQUEST].every((x) => (GROUPS as readonly string[]).includes(x.group)));
  // 23 services in the plan: documents covers two of them (documents and decks), brand check is a 24th.
  assert.equal(ENDPOINTS.length + 1 + ON_REQUEST.length, 24);
  const c = catalogue("https://nka.test");
  assert.equal(c.live.find((l) => l.id === "brand_check")?.url, "https://nka.test/api/v1/brand-checks");
  assert.equal(c.on_request.services.length, ON_REQUEST.length);
});

test("openapi: a path for every endpoint, with its schema and example", () => {
  const doc = openapi("https://nka.test") as { openapi: string; paths: Record<string, { post?: { requestBody: { content: { "application/json": { schema: { type: string }; example: unknown } } } } }> };
  assert.equal(doc.openapi, "3.1.0");
  for (const e of ENDPOINTS) {
    const body = doc.paths[`/${e.path}`].post?.requestBody.content["application/json"];
    assert.equal(body?.schema.type, "object");
    assert.deepEqual(body?.example, e.example);
  }
  assert.ok(doc.paths["/jobs/{id}"] && doc.paths["/requests"] && doc.paths["/ecards/{id}"]);
  assert.doesNotThrow(() => JSON.stringify(doc));
  assert.equal(validate(requestSchema, { service: "booth_design", title: "Expo stand", summary: "We need a 3 by 3 stand." }).ok, true);
  assert.equal(validate(requestSchema, { service: "brand_check", title: "x", summary: "y" }).ok, false);
});

test("mcp: handshake, tool list, tool calls, and errors a model can read", async () => {
  const calls: unknown[] = [];
  const tools: McpTools = {
    run: async (id, args) => {
      calls.push([id, args]);
      if ((args as { boom?: boolean }).boom) throw new ApiError(422, "invalid_request", "brand is required.", [{ path: "brand", message: "is required" }]);
      if ((args as { crash?: boolean }).crash) throw new Error("db password is hunter2");
      return { id: "job_1", status: "succeeded", result: { score: 90 } };
    },
    getJob: async (id) => ({ id, status: "failed", error: { code: "timed_out", message: "x" } }),
    listServices: () => ({ live: [] }),
    requestService: async () => ({ status: "draft" }),
  };
  const init = (await handleMcp({ jsonrpc: "2.0", id: 1, method: "initialize", params: { protocolVersion: "2025-03-26" } }, tools)) as { result: { protocolVersion: string; capabilities: { tools: unknown } } };
  assert.equal(init.result.protocolVersion, "2025-03-26");
  assert.ok(init.result.capabilities.tools);
  const unknownVersion = (await handleMcp({ jsonrpc: "2.0", id: 1, method: "initialize", params: { protocolVersion: "1999-01-01" } }, tools)) as { result: { protocolVersion: string } };
  assert.equal(unknownVersion.result.protocolVersion, "2025-06-18");
  assert.equal(await handleMcp({ jsonrpc: "2.0", method: "notifications/initialized" }, tools), null);

  const list = (await handleMcp({ jsonrpc: "2.0", id: 2, method: "tools/list" }, tools)) as { result: { tools: { name: string; inputSchema: { type: string } }[] } };
  assert.deepEqual(list.result.tools.map((t) => t.name), [...ENDPOINTS.map((e) => e.id), "get_job", "list_services", "request_service"]);
  assert.ok(list.result.tools.every((t) => t.inputSchema.type === "object" && /^[a-z_]+$/.test(t.name)));
  assert.equal(toolList().length, ENDPOINTS.length + 3);

  const ok = (await handleMcp({ jsonrpc: "2.0", id: 3, method: "tools/call", params: { name: "brand_check", arguments: { a: 1 } } }, tools)) as { result: { isError: boolean; structuredContent: { status: string }; content: { type: string; text: string }[] } };
  assert.equal(ok.result.isError, false);
  assert.equal(ok.result.structuredContent.status, "succeeded");
  assert.deepEqual(JSON.parse(ok.result.content[0].text), ok.result.structuredContent);
  assert.deepEqual(calls[0], ["brand_check", { a: 1 }]);

  const bad = (await handleMcp({ jsonrpc: "2.0", id: 4, method: "tools/call", params: { name: "document", arguments: { boom: true } } }, tools)) as { result: { isError: boolean; structuredContent: { error: { code: string; details: unknown[] } } } };
  assert.equal(bad.result.isError, true);
  assert.equal(bad.result.structuredContent.error.code, "invalid_request");
  const crash = (await handleMcp({ jsonrpc: "2.0", id: 5, method: "tools/call", params: { name: "document", arguments: { crash: true } } }, tools)) as { result: { content: { text: string }[] } };
  assert.ok(!crash.result.content[0].text.includes("hunter2"), "internal error text never reaches the caller");
  const failedJob = (await handleMcp({ jsonrpc: "2.0", id: 6, method: "tools/call", params: { name: "get_job", arguments: { id: "j" } } }, tools)) as { result: { isError: boolean } };
  assert.equal(failedJob.result.isError, true);

  const noTool = (await handleMcp({ jsonrpc: "2.0", id: 7, method: "tools/call", params: { name: "rm_rf" } }, tools)) as { error: { code: number } };
  assert.equal(noTool.error.code, -32602);
  const noMethod = (await handleMcp({ jsonrpc: "2.0", id: 8, method: "resources/list" }, tools)) as { error: { code: number } };
  assert.equal(noMethod.error.code, -32601);
  const junk = (await handleMcp({ id: 9 } as never, tools)) as { error: { code: number } };
  assert.equal(junk.error.code, -32600);
});

// ---------- SVG safety ----------

import { parseColour, recolourSvg, sanitiseSvg, svgColours, svgSize, tonalSvg } from "../src/lib/api/svg.ts";
import { fromHsl, toHsl, withContrast } from "../src/lib/api/brand.ts";
import { buildSystem, colourTypeSystem, harmony, neutrals, scale, status, PAIRINGS } from "../src/lib/api/endpoints/colour-type-system.ts";
import { clearSpace, logoPack, place, tile } from "../src/lib/api/endpoints/logo-pack.ts";
import { cleanNames, cleanTaglines, domainLabel, naming } from "../src/lib/api/endpoints/naming.ts";
import { cleanShapes, drawShapes, initials, lockups, logoDesign, monograms, seedFromName } from "../src/lib/api/endpoints/logo-design.ts";
import { auditPages, auditScore, brandAudit, clusters, type Page } from "../src/lib/api/endpoints/brand-audit.ts";

const HOSTILE_SVG = `<?xml version="1.0"?><!DOCTYPE svg><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 50" onload="alert(1)">
<style>.cls-1{fill:#0B3D91;} .a,.b{stroke:#f2a900;stroke-width:2}</style><script>alert(1)</script>
<foreignObject><div><svg><path d="M0 0"/></svg></div></foreignObject>
<g class="cls-1"><path class="a" d="M10 10 L 90 10 Z" onclick="x()" style="fill:url(https://evil.test/x);opacity:.5"/></g>
<image href="https://evil.test/p.png"/><use href="https://evil.test/a.svg#x"/><use xlink:href="#ok"/>
<a href="javascript:alert(1)"><circle cx="5" cy="5" r="2" fill="red"/></a>
<rect width="5" height="5" fill="url(#g)"/><linearGradient id="g"><stop offset="0" stop-color="#fff"/></linearGradient>
<text font-family="Sora">A &amp; B <b onmouseover="x">bold</b></text><path d="M0 0 javascript:1"/><set attributeName="href" to="javascript:alert(1)"/><animate attributeName="d"/>`;

test("svg: scripts, handlers, outside links and unknown elements are removed; colours from styles survive", () => {
  const clean = sanitiseSvg(HOSTILE_SVG);
  assert.ok(clean);
  for (const bad of ["script", "onload", "onclick", "onmouseover", "foreignObject", "evil.test", "javascript", "<image", "<a ", "<b", "<style", "<set", "<animate", "DOCTYPE", "<?xml", "class="]) {
    assert.ok(!clean.includes(bad), `"${bad}" must not survive`);
  }
  assert.ok(clean.includes('<g fill="#0B3D91">'), "class rule became an attribute");
  assert.ok(clean.includes('stroke="#f2a900"') && clean.includes('opacity=".5"'), "class and inline styles are kept as attributes");
  assert.ok(clean.includes('<circle cx="5" cy="5" r="2" fill="red"/>'), "content of a link wrapper is kept, the link is not");
  assert.ok(clean.includes('<use href="#ok"/>'), "internal references stay");
  assert.ok(clean.includes("<linearGradient") && clean.endsWith("</svg>"), "names keep their capitals and everything is closed");
  assert.ok(clean.includes("A &amp; B"), "text is kept, escaped");
  assert.equal((clean.match(/<svg/g) ?? []).length, 1);
  assert.deepEqual(svgSize(clean), { w: 100, h: 50 });
  assert.deepEqual(svgColours(clean), ["#0b3d91", "#f2a900", "#ff0000", "#ffffff"]);
});

test("svg: things that aren't a usable drawing are refused", () => {
  assert.equal(sanitiseSvg("<html><svg><path d='M0 0'/></svg></html>"), null, "root must be svg");
  assert.equal(sanitiseSvg(`<svg><!ENTITY x "y"><path d="M0 0"/></svg>`), null, "entity definitions are refused");
  assert.equal(sanitiseSvg("<svg></svg>"), null, "nothing drawn");
  assert.equal(sanitiseSvg("<svg><script>x</script></svg>"), null);
  assert.equal(sanitiseSvg("x".repeat(500_000)), null, "too big");
  assert.equal(sanitiseSvg("not svg at all"), null);
  const odd = sanitiseSvg(`<svg viewBox="0 0 10 10"><g><path d="M0 0 L5 5"></svg>`);
  assert.equal(odd, `<svg viewBox="0 0 10 10" xmlns="http://www.w3.org/2000/svg"><g><path d="M0 0 L5 5"></path></g></svg>`, "unclosed tags are closed in order");
  const quoted = sanitiseSvg(`<svg viewBox="0 0 1 1"><path d="M0 0" fill="&quot; onload=&quot;alert(1)"/></svg>`);
  assert.ok(quoted && !/ onload="/.test(quoted), "an attribute value can't close its own quotes");
});

test("svg: colours are read from hex, rgb and names; one-colour logos go solid, others keep detail in greys", () => {
  assert.equal(parseColour("RED"), "#ff0000");
  assert.equal(parseColour("rgb(11, 61, 145)"), "#0b3d91");
  assert.equal(parseColour("#FFF"), "#ffffff");
  assert.equal(parseColour("url(#g)"), null);
  const one = sanitiseSvg(`<svg viewBox="0 0 10 10"><path d="M0 0 L5 5Z" fill="#0b3d91"/><rect width="2" height="2" fill="none" stroke="#0b3d91"/></svg>`)!;
  const flat = tonalSvg(one, "white");
  assert.equal(flat.flat, true);
  assert.deepEqual(svgColours(flat.svg), ["#ffffff"]);
  assert.ok(flat.svg.includes('fill="none"'), "none stays none");
  const two = sanitiseSvg(`<svg viewBox="0 0 10 10"><rect width="10" height="10" fill="#0b3d91"/><circle cx="5" cy="5" r="2" fill="#f2a900"/></svg>`)!;
  const black = tonalSvg(two, "black");
  assert.equal(black.flat, false);
  assert.deepEqual(svgColours(black.svg), ["#000000", "#9e9e9e"], "darkest becomes black, the lighter shape stays visible");
  assert.deepEqual(svgColours(tonalSvg(two, "white").svg), ["#ffffff", "#616161"], "reversed: darkest becomes white");
  assert.deepEqual(svgColours(recolourSvg(two, "#ff0000")), ["#ff0000"]);
});

// ---------- colour and type system ----------

test("colour system: hsl round-trips, scales run light to dark, contrast is enforced", () => {
  for (const hex of ["#0b3d91", "#f2a900", "#e4572e", "#808080", "#000000", "#ffffff"]) {
    const [h, s, l] = toHsl(hex);
    assert.ok(Math.max(...[1, 3, 5].map((i) => Math.abs(parseInt(fromHsl(h, s, l).slice(i, i + 2), 16) - parseInt(hex.slice(i, i + 2), 16)))) <= 1, hex);
  }
  const sc = Object.values(scale("#0b3d91"));
  assert.equal(sc.length, 10);
  for (let i = 1; i < sc.length; i++) assert.ok(contrast(sc[i], "#ffffff") > contrast(sc[i - 1], "#ffffff"), "each step is darker than the last");
  assert.ok(contrast(withContrast("#f2a900", "#ffffff", 4.5), "#ffffff") >= 4.5);
  assert.equal(withContrast("#0b3d91", "#ffffff", 4.5), "#0b3d91", "a colour that passes is left alone");
  assert.ok(contrast(withContrast("#333333", "#000000", 4.5), "#000000") >= 4.5, "lightens against dark");
  for (const c of Object.values(status())) assert.ok(contrast(c, "#ffffff") >= 4.5, `status ${c} carries white text`);
  for (const n of Object.values(neutrals("#0b3d91"))) assert.ok(toHsl(n)[1] < 0.2, "neutrals are near-grey");
});

test("colour system: every scheme gives distinct colours, overrides are respected, output is complete", async () => {
  for (const scheme of ["analogous", "complementary", "split-complementary", "triadic", "monochrome"] as const) {
    for (const seed of ["#0b3d91", "#f2a900", "#e4572e", "#111111", "#fafafa", "#7f7f7f"]) {
      const h = harmony(seed, scheme);
      assert.match(h.secondary, /^#[0-9a-f]{6}$/);
      assert.match(h.accent, /^#[0-9a-f]{6}$/);
    }
  }
  assert.ok(Math.abs(toHsl(harmony("#0b3d91", "complementary").accent)[0] - ((toHsl("#0b3d91")[0] + 180) % 360)) < 3, "complement is opposite on the wheel");
  const sys = buildSystem({ seed: "0B3D91", accent: "#ff0066", fonts: { heading: `Sora"; } * { x` } });
  assert.equal(sys.colours.primary, "#0b3d91");
  assert.equal(sys.colours.accent, "#ff0066");
  assert.equal(sys.fonts.heading, "Sora x", "caller's font name is cleaned before it reaches CSS");
  for (const [k, v] of Object.entries(sys.text_safe)) assert.ok(contrast(v, "#ffffff") >= 4.5, `${k} text-safe shade`);
  for (const pairs of Object.values(PAIRINGS)) assert.equal(pairs.length, 2);
  const out = await run(colourTypeSystem, colourTypeSystem.example, deps());
  assert.deepEqual(out.files.map((f) => f.mime.split(";")[0]), ["text/html", "application/json", "text/css"]);
  const css = text(out.files[2].data);
  assert.match(css, /--primary-500: #[0-9a-f]{6};/);
  assert.match(css, /--color-danger: #[0-9a-f]{6};/);
  assert.equal((css.match(/\{/g) ?? []).length, 1, "one rule block, nothing injected");
  assert.equal(validate(colourTypeSystem.input, { seed: "blue" }).ok, false);
});

// ---------- logo file pack ----------

test("logo pack: a zip with vector, PNG, icon and avatar files, all from the caller's own artwork", async () => {
  const out = await run(logoPack, logoPack.example, deps());
  const r = out.result as { files_in_zip: string[]; png_count: number; colours_found: string[]; notes: string[]; proportions: { width: number; height: number } };
  assert.deepEqual(r.proportions, { width: 240, height: 80 });
  assert.deepEqual(r.colours_found, ["#0b3d91", "#f2a900"]);
  assert.equal(r.png_count, 13);
  for (const f of ["svg/acme-bank.svg", "svg/acme-bank-black.svg", "svg/acme-bank-white.svg", "svg/clear-space.svg", "png/acme-bank-2048.png", "icons/favicon-32.png", "icons/apple-touch-icon.png", "social/acme-bank-avatar-colour-800.png", "README.txt"]) {
    assert.ok(r.files_in_zip.includes(f), f);
  }
  const z = out.files[0].data as Uint8Array;
  assert.equal(out.files[0].name, "acme-bank-logo-pack.zip");
  assert.equal(String.fromCharCode(z[0], z[1]), "PK");
  assert.ok(r.notes.some((n) => /tones of grey/.test(n)), "says the black and white versions are tonal");
  assert.ok(r.notes.some((n) => /isn't close to square/.test(n)));
  const JSZip = (await import("jszip")).default;
  const zipped = await JSZip.loadAsync(z);
  const png = await zipped.file("icons/icon-512.png")!.async("uint8array");
  assert.deepEqual([...png.slice(0, 4)], [0x89, 0x50, 0x4e, 0x47], "a real PNG");
  assert.equal(new DataView(png.buffer, png.byteOffset).getUint32(16), 512, "512 pixels wide");
  assert.equal(new DataView(png.buffer, png.byteOffset).getUint32(20), 512, "and square");
  const wide = await zipped.file("png/acme-bank-1024.png")!.async("uint8array");
  assert.equal(new DataView(wide.buffer, wide.byteOffset).getUint32(16), 1024);
  assert.equal(new DataView(wide.buffer, wide.byteOffset).getUint32(20), 341, "proportions are kept");
});

test("logo pack: hostile SVG is cleaned before anything is made; unusable logos are refused with a reason", async () => {
  const out = await run(logoPack, { name: "Evil", logo: { svg: HOSTILE_SVG } }, deps());
  const JSZip = (await import("jszip")).default;
  const zipped = await JSZip.loadAsync(out.files[0].data as Uint8Array);
  for (const name of Object.keys(zipped.files).filter((n) => n.endsWith(".svg"))) {
    const svg = await zipped.file(name)!.async("string");
    assert.ok(!/script|onload|evil\.test|javascript/i.test(svg), `${name} is clean`);
  }
  assert.ok(!/script|onload|evil\.test|javascript:/i.test(text(out.files[1].data)), "the preview page is clean too");
  const r = out.result as { png_count: number; notes: string[] };
  assert.equal(r.png_count, 0, "live text: no PNGs rather than wrong ones");
  assert.ok(r.notes.some((n) => /live text/.test(n)));
  await assert.rejects(() => run(logoPack, { name: "X", logo: { svg: "<svg><script/></svg>" } }, deps()), (e: ApiError) => e.code === "asset_unreadable");
  await assert.rejects(() => run(logoPack, { name: "X", logo: { svg: `<svg><path d="M0 0L1 1"/></svg>` } }, deps()), (e: ApiError) => /viewBox/.test(e.message));
  await assert.rejects(() => run(logoPack, { name: "X", logo: {} }, deps()), (e: ApiError) => e.status === 422);
  await assert.rejects(() => run(logoPack, { name: "X", logo: { url: "https://x.test/logo.png" } }, deps({ fetchFile: async () => ({ body: new Uint8Array([0x89, 0x50]), type: "image/png", url: "" }) })), (e: ApiError) => /SVG/.test(e.message));
  const size = { w: 240, h: 80 };
  const clean = sanitiseSvg((logoPack.example as { logo: { svg: string } }).logo.svg)!;
  assert.match(place(clean, size, 10, 20, 100, 50), /^<svg x="10" y="20" width="100" height="50" viewBox="0 0 240 80" preserveAspectRatio="xMidYMid meet">/);
  assert.match(tile(clean, size, "#ffffff"), /<rect width="1000" height="1000" fill="#ffffff"\/><svg x="180" y="180" width="640" height="640"/);
  assert.match(clearSpace(clean, size), /one quarter of the logo's height/);
});

// ---------- naming ----------

test("naming: unusable, banned and repeated names are dropped; taglines with claims are dropped", () => {
  const names = cleanNames(
    [
      { name: "Ajo", language: "Yoruba", meaning: "a savings circle", why: "Named for how traders already save." },
      { name: "ajo", language: "Yoruba" }, { name: "PayStack2" }, { name: "Pocket Bank" }, { name: "A" }, { name: "Three Word Name" },
      { name: "Supercalifragilistic" }, { name: "<b>Bold</b>" }, { name: "Kobo Tree", language: "coined", meaning: "", why: "Small coins growing." }, { name: 42 },
    ],
    ["bank", "pay"],
    10,
  );
  assert.deepEqual(names.map((n) => n.name), ["Ajo", "Kobo Tree"]);
  assert.deepEqual(cleanTaglines(["Save a little every day", "save a little every day", "The best savings app in Lagos", "Trusted by 50,000 traders", "Number one for traders", "Small coins, big days ahead for you and all your family", 7]), ["Save a little every day"]);
  assert.equal(domainLabel("Kobo Tree"), "kobotree");
  assert.equal(domainLabel("Àjọ"), "ajo");
});

test("naming: needs the model, checks domains only when asked, and says what it hasn't checked", async () => {
  await assert.rejects(() => run(naming, naming.example, deps()), (e: ApiError) => e.code === "model_unavailable");
  const looked: string[] = [];
  const d = deps({
    model: async () => '{"names":[{"name":"Ajo","language":"Yoruba","meaning":"savings circle","why":"x"},{"name":"Kobo Tree","language":"coined","meaning":"","why":"y"},{"name":"Bankly"}],"taglines":["Save a little every day","Guaranteed returns"]}',
    hasDns: async (domain) => {
      looked.push(domain);
      return domain === "ajo.com" ? true : domain === "ajo.ng" ? false : null;
    },
  });
  const out = await run(naming, naming.example, d);
  const r = out.result as { names: { name: string; letters: number; domains: Record<string, string> }[]; taglines: string[]; notes: string[] };
  assert.deepEqual(r.names.map((n) => n.name), ["Ajo", "Kobo Tree"]);
  assert.deepEqual(r.names[0].domains, { "ajo.com": "has_dns", "ajo.ng": "no_dns" });
  assert.deepEqual(r.names[1].domains, { "kobotree.com": "unknown", "kobotree.ng": "unknown" });
  assert.equal(r.names[1].letters, 8);
  assert.deepEqual(looked.sort(), ["ajo.com", "ajo.ng", "kobotree.com", "kobotree.ng"]);
  assert.deepEqual(r.taglines, ["Save a little every day"]);
  assert.ok(r.notes.some((n) => /No trademark/.test(n)) && r.notes.some((n) => /native speaker/.test(n)) && r.notes.some((n) => /may still be registered/.test(n)));
  await assert.rejects(() => run(naming, naming.example, deps({ model: async () => '{"names":[{"name":"Bank Pay"}]}' })), (e: ApiError) => e.status === 503);
  assert.equal(validate(naming.input, { about: "too short" }).ok, false);
  assert.equal(validate(naming.input, { ...(naming.example as object), domains: ["com/../x"] }).ok, false);
});

// ---------- logo design ----------

test("logo design: model shapes are reduced to checked numbers and colour tokens", () => {
  const shapes = cleanShapes([
    { type: "circle", cx: 50, cy: 50, r: 30, fill: "primary" },
    { type: "circle", cx: 50, cy: 50, r: 30, fill: "#ff0000\"/><script>" },
    { type: "circle", cx: "50", cy: 50, r: 30 },
    { type: "circle", cx: 5000, cy: 50, r: 30 },
    { type: "rect", x: 10, y: 10, w: 20, h: 20, rx: 4, rotate: 45, fill: "accent", stroke: "ink", width: 6 },
    { type: "polygon", points: [[50, 10], [90, 90], [10, 90]], fill: "secondary" },
    { type: "polygon", points: [[50, 10], ["x", 90]] },
    { type: "path", d: "M20 70 Q50 20 80 70", fill: "none", stroke: "primary", width: 8 },
    { type: "path", d: 'M0 0"/><script>alert(1)</script>', fill: "primary" },
    { type: "path", d: "M0 0 L9999 9999", fill: "primary" },
    { type: "path", d: "L0 0 10 10", fill: "primary" },
    { type: "circle", cx: 1, cy: 1, r: 1, fill: "none" },
    { type: "image", href: "https://evil.test" },
    null,
  ]);
  assert.deepEqual(shapes.map((s) => s.type), ["circle", "circle", "rect", "polygon", "path"]);
  assert.equal(shapes[1].fill, "primary", "a colour value is replaced by a token");
  const svg = drawShapes(shapes, roles(normaliseBrand(BRAND)));
  assert.ok(!/script|evil|href/.test(svg));
  assert.ok(svg.includes('fill="#0b3d91"') && svg.includes('stroke="#12151c" stroke-width="6"') && svg.includes('transform="rotate(45 20 20)"'));
  assert.equal(cleanShapes(Array.from({ length: 40 }, () => ({ type: "circle", cx: 5, cy: 5, r: 2 }))).length, 14);
});

test("logo design: monograms always work; lockups size to the name; hostile names are escaped", async () => {
  assert.equal(initials("Acme Bank"), "AB");
  assert.equal(initials("nka"), "N");
  assert.equal(initials("  "), "N");
  assert.equal(initials("Übung & Söhne"), "ÜS");
  assert.equal(seedFromName("Acme"), seedFromName("ACME"), "the same name always gives the same placeholder colour");
  const b = normaliseBrand({ ...BRAND, name: `A<script>"B` });
  const r = roles(b);
  const m = monograms(b, r);
  assert.equal(m.length, 4);
  const l = lockups(b, r, m[0].mark);
  for (const svg of Object.values(l)) {
    assert.ok(!svg.includes("<script"), "name is escaped");
    assert.ok(sanitiseSvg(svg), "every lockup is itself a clean, parseable SVG");
  }
  const short = lockups(normaliseBrand({ ...BRAND, name: "Nka" }), r, m[0].mark).horizontal;
  const long = lockups(normaliseBrand({ ...BRAND, name: "The JaneMichael Ekanem Foundation" }), r, m[0].mark).horizontal;
  assert.ok(svgSize(sanitiseSvg(long)!)!.w > svgSize(sanitiseSvg(short)!)!.w * 3, "the canvas grows with the name");

  const none = await run(logoDesign, { brand: { name: "Kobo Tree" } }, deps());
  const rn = out0(none);
  assert.deepEqual(rn.concepts.map((c) => c.source), ["monogram", "monogram", "monogram", "monogram"]);
  assert.ok(rn.notes.some((n) => /placeholder palette/.test(n)) && rn.notes.some((n) => /monograms only/.test(n)) && rn.notes.some((n) => /No trademark/.test(n)));
  assert.equal(none.files.length, 4 * 3 + 1);

  const model = async () => JSON.stringify({ concepts: [{ name: "Open door", idea: "A doorway.", shapes: [{ type: "rect", x: 22, y: 14, w: 56, h: 76, rx: 28, fill: "primary" }, { type: "circle", cx: 50, cy: 46, r: 14, fill: "accent" }] }, { name: "Empty", shapes: [{ type: "nope" }] }] });
  const some = await run(logoDesign, { ...(logoDesign.example as object), count: 3 }, deps({ model }));
  assert.deepEqual(out0(some).concepts.map((c) => [c.name, c.source]), [["Open door", "model"], ["Roundel", "monogram"], ["Tile", "monogram"]]);
  assert.equal(some.files[0].name, "acme-bank-concept-1-open-door-mark.svg");
});
const out0 = (o: { result: Record<string, unknown> }) => o.result as { concepts: { name: string; source: string }[]; notes: string[] };

// ---------- brand audit ----------

const page = (over: Partial<Page>): Page => ({ url: "https://acme.test/", title: "Acme", description: "A bank", hasShareImage: true, hasIcon: true, logo: "https://acme.test/logo.svg", css: "", fontLinks: [], ...over });

test("audit: near-duplicate shades, stray typefaces and missing basics are found; a tidy site scores well", () => {
  const c = clusters(new Map([["#0b3d91", 5], ["#0b3e95", 2], ["#0a3c8f", 1], ["#f2a900", 3]]));
  assert.deepEqual(c.map((g) => [g.colour, g.uses, g.variants.length]), [["#0b3d91", 8, 3], ["#f2a900", 3, 1]]);

  const tidyCss = `body{font-family:Inter,sans-serif;color:#12151c;background:#fff}h1{font-family:Sora;color:#0b3d91}.cta{background:#f2a900}.x{border:1px solid #ddd}`;
  const tidy = auditPages([page({ css: tidyCss }), page({ url: "https://acme.test/about", css: tidyCss })], null);
  assert.deepEqual(tidy.findings, []);
  assert.deepEqual(tidy.palette, ["#0b3d91", "#f2a900"], "greys, near-black and white aren't counted as brand colours");
  assert.deepEqual(tidy.fonts, ["Inter", "Sora"]);
  assert.deepEqual(auditScore(tidy.findings), { score: 100, verdict: "consistent" });

  const messy = auditPages(
    [
      page({ css: tidyCss + `.b{background:#0b3e95}.c{color:#0a3c8f}.d{fill:#0c3d93}` }),
      page({ url: "https://acme.test/about", title: "", description: "", hasShareImage: false, logo: null, css: `body{font-family:Roboto;color:#333}.x{background:#7a1fa2}.y{color:#e91e63}.z{border-color:#00897b}` }),
    ],
    null,
  );
  const got = messy.findings.map((f) => `${f.severity}/${f.rule}`).sort();
  assert.deepEqual(got, ["low/basics", "low/basics", "low/colour", "low/logo", "medium/basics", "medium/colour", "medium/typography"].sort());
  assert.ok(messy.findings.some((f) => /4 near-identical shades of #0b3d91/.test(f.detail)));
  assert.ok(messy.findings.some((f) => /\/about uses Roboto, which the home page doesn't/.test(f.detail)));
  const s = auditScore(messy.findings);
  assert.ok(s.score < 80 && s.score >= 40 && s.verdict !== "consistent", `score ${s.score}`);
  const flood = Array.from({ length: 30 }, () => messy.findings[0]);
  assert.equal(auditScore(flood).score, 70, "one repeated problem can cost 30 points at most");

  const withRef = auditPages([page({ css: tidyCss + `.q{color:#7a1fa2}` })], normaliseBrand(BRAND));
  assert.ok(withRef.findings.some((f) => f.evidence === "#7a1fa2" && /not in the brand palette/.test(f.detail)));
});

test("audit: reads pages through the safe fetcher, skips what it can't read, and reports honestly", async () => {
  const enc = (s: string, type: string) => ({ body: new TextEncoder().encode(s), type, url: "" });
  const site: Record<string, [string, string]> = {
    "https://acme.test/": [`<html><head><title>Acme Bank | Home</title><meta name="description" content="A bank"><meta property="og:image" content="/s.png"><link rel="icon" href="/f.png"><link rel="stylesheet" href="/a.css"></head><body><img src="/logo.svg" alt="Acme logo"></body></html>`, "text/html"],
    "https://acme.test/a.css": [`body{font-family:Inter}h1{color:#0b3d91}.cta{background:#f2a900}`, "text/css"],
    "https://acme.test/pdf": ["%PDF", "application/pdf"],
  };
  const asked: string[] = [];
  const d = deps({ fetchFile: async (u) => (asked.push(u), site[u] ? enc(...site[u]) : null) });
  const out = await run(brandAudit, { website: "https://acme.test/", pages: ["https://acme.test/pdf", "https://acme.test/gone"], images: ["https://acme.test/post.png"] }, d);
  const r = out.result as { score: number; pages: number; palette_in_use: string[]; images_checked: number; notes: string[]; site: string };
  assert.equal(r.pages, 1);
  assert.deepEqual(r.palette_in_use, ["#0b3d91", "#f2a900"]);
  assert.ok(asked.includes("https://acme.test/a.css"), "linked stylesheet was read");
  assert.equal(r.images_checked, 0);
  assert.ok(r.notes.some((n) => /couldn't be read and were left out: https:\/\/acme\.test\/pdf, https:\/\/acme\.test\/gone/.test(n)));
  assert.ok(r.notes.some((n) => /Images weren't checked/.test(n)));
  assert.equal(out.files[0].name, "acme-test-brand-audit.html");
  assert.ok(!text(out.files[0].data).includes("<script"));
  await assert.rejects(() => run(brandAudit, { website: "https://nowhere.test/" }, deps()), (e: ApiError) => e.code === "asset_unreadable");
  assert.equal(validate(brandAudit.input, { website: "ftp://x" }).ok, false);
});
