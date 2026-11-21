import Link from "next/link";
import type { Metadata } from "next";
import { ENDPOINTS, ON_REQUEST } from "@/lib/api/catalogue";
import { siteOrigin } from "@/lib/origin";

export const metadata: Metadata = {
  title: "API for agents and platforms",
  description: "Give your software or AI agent a design studio. Send a brand and a brief to the Nka API and get finished files back.",
};

const pre: React.CSSProperties = {
  background: "var(--ink)", color: "var(--on-ink)", padding: "16px 18px", borderRadius: 8, overflowX: "auto", fontSize: 14, lineHeight: 1.5,
  fontFamily: "ui-monospace, SFMono-Regular, Menlo, Consolas, monospace", maxWidth: "100%", whiteSpace: "pre",
};

const ERRORS: [string, string, string][] = [
  ["400", "invalid_json", "The body isn't JSON."],
  ["401", "invalid_key", "The key is missing, wrong or revoked."],
  ["402", "quota_exceeded", "This month's credits are used up."],
  ["403", "api_disabled", "The API is switched off for the workspace."],
  ["409", "idempotency_mismatch", "That Idempotency-Key was used for a different endpoint."],
  ["413", "too_large", "The body is over 1 MB."],
  ["422", "invalid_request", "A field is missing or wrong. details lists each one with its path."],
  ["429", "rate_limited", "Too many requests this minute. Retry-After says when."],
  ["503", "model_unavailable", "A step that needs the model couldn't run. Not charged."],
];

// The docs are written from the same endpoint definitions the API runs on, so they can't drift.
export default async function Developers() {
  const origin = await siteOrigin();
  const base = `${origin}/api/v1`;
  const first = ENDPOINTS[0];
  const groups = [...new Set(ON_REQUEST.map((s) => s.group))];
  return (
    <section className="page-head">
      <div className="wrap prose">
        <h1 className="h1">Nka API</h1>
        <p className="lede">
          Give your software or AI agent a design studio. Send a brand and a brief, get finished files back. Five services run end to end; the
          rest of the studio&apos;s work can be requested through the same API and is done by the team.
        </p>

        <h2>Start</h2>
        <ol>
          <li>Ask Nka to switch the API on for your workspace.</li>
          <li>
            In your workspace, open <Link href="/app/developers">API</Link> and make a key. It is shown once.
          </li>
          <li>Send it as a bearer token on every request.</li>
        </ol>
        <pre style={pre}>{`curl -X POST "${base}/${first.path}?wait=true" \\
  -H "Authorization: Bearer nka_live_..." \\
  -H "Content-Type: application/json" \\
  -d '${JSON.stringify(first.example)}'`}</pre>

        <h2>How a request runs</h2>
        <p>
          Every service is a job. By default a POST returns <code>202</code> with the job at once; fetch <code>GET {base}/jobs/&#123;id&#125;</code>{" "}
          until <code>status</code> is <code>succeeded</code> or <code>failed</code>. Add <code>?wait=true</code> to hold the connection and get the
          finished job back in one call.
        </p>
        <ul>
          <li>
            <b>Files.</b> A finished job lists its files with signed links that last 24 hours. Fetch the job again for fresh links.
          </li>
          <li>
            <b>Webhooks.</b> Send <code>Nka-Webhook-Url</code> (https) and the finished job is POSTed there. Check the <code>Nka-Signature</code>{" "}
            header: <code>t=&lt;unix seconds&gt;,v1=&lt;hex&gt;</code>, where v1 is HMAC-SHA256 of <code>&lt;t&gt;.&lt;raw body&gt;</code> with your
            key&apos;s webhook secret. Reject anything older than five minutes.
          </li>
          <li>
            <b>Retries.</b> Send an <code>Idempotency-Key</code> and a repeat of the same request returns the first job, not a second charge.
          </li>
          <li>
            <b>Credits.</b> Each service costs a fixed number of credits. Failed jobs cost nothing. Your monthly limit and use are on the API page
            of your workspace and in <code>GET {base}/jobs</code>.
          </li>
        </ul>

        <h2>The brand object</h2>
        <p>
          Every service takes a <code>brand</code>. Give a name, colours and typefaces, or just a <code>website</code> and the missing parts are
          read from it. Colours are used exactly as given; nothing is adjusted to look nicer.
        </p>
        <pre style={pre}>{JSON.stringify(
          { name: "Acme Bank", colours: [{ hex: "#0b3d91", name: "Harbour", role: "primary" }, { hex: "#f2a900", role: "accent" }], fonts: { heading: "Sora", body: "Inter" }, logo_url: "https://example.com/logo.png", about: "A retail bank for small businesses.", voice: "Plain and direct." },
          null,
          2,
        )}</pre>

        <h2>Live services</h2>
        {ENDPOINTS.map((e) => (
          <div key={e.id}>
            <h3 style={{ marginTop: "1.6em" }}>
              {e.title} <span className="muted small">({e.units} credit{e.units === 1 ? "" : "s"})</span>
            </h3>
            <p>
              <code>POST {base}/{e.path}</code>
            </p>
            <p>{e.summary}</p>
            <p>
              <b>You get:</b> {e.returns}
            </p>
            <details>
              <summary>Example request body</summary>
              <pre style={pre}>{JSON.stringify(e.example, null, 2)}</pre>
            </details>
          </div>
        ))}

        <h2>What we don&apos;t make up</h2>
        <ul>
          <li>Quote totals, contrast ratios, tints and type scales are calculated in code, not by a model.</li>
          <li>Where a model writes or organises text, any output containing a figure you didn&apos;t supply is discarded.</li>
          <li>Each result has a <code>notes</code> list that says what was skipped or needs checking, such as a logo that couldn&apos;t be fetched.</li>
          <li>We don&apos;t email your recipients. E-card links come back to you to send.</li>
        </ul>

        <h2>On request</h2>
        <p>
          Everything else the studio makes is done by the team. <code>POST {base}/requests</code> with a <code>service</code>, a{" "}
          <code>title</code> and a <code>summary</code> files a draft brief in your Nka workspace. A person on your team sends it, so software
          never commits plan hours or a price.
        </p>
        {groups.map((g) => (
          <p key={g}>
            <b>{g}:</b>{" "}
            {ON_REQUEST.filter((s) => s.group === g).map((s, i) => (
              <span key={s.id}>
                {i > 0 && ", "}
                {s.title} (<code>{s.id}</code>)
              </span>
            ))}
          </p>
        ))}

        <h2>For AI agents</h2>
        <p>
          The same services are available as tools over the Model Context Protocol at <code>{origin}/api/mcp</code> (HTTP POST, with the same
          bearer key). The machine-readable description is at{" "}
          <a href="/api/v1/openapi.json">
            <code>{base}/openapi.json</code>
          </a>{" "}
          and the catalogue at{" "}
          <a href="/api/v1">
            <code>{base}</code>
          </a>
          .
        </p>

        <h2>Errors</h2>
        <p>
          Errors share one shape: <code>{`{"error": {"code": "...", "message": "...", "details": [...]}}`}</code>
        </p>
        <div className="table-scroll">
          <table className="table">
            <thead>
              <tr>
                <th>Status</th>
                <th>Code</th>
                <th>Meaning</th>
              </tr>
            </thead>
            <tbody>
              {ERRORS.map(([s, c, m]) => (
                <tr key={c}>
                  <td>{s}</td>
                  <td>
                    <code>{c}</code>
                  </td>
                  <td>{m}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <h2>Limits</h2>
        <ul>
          <li>Request bodies up to 1 MB. Images to check up to 5 MB.</li>
          <li>Files we fetch for you (logos, assets, websites) must be on public addresses.</li>
          <li>Up to 500 recipients per card, 12 posts per social pack, 60 slides per deck.</li>
          <li>A job that runs past four minutes fails and isn&apos;t charged.</li>
        </ul>
      </div>
    </section>
  );
}
