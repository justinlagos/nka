import Link from "next/link";
import { NewKeyForm } from "@/components/NewKeyForm";
import { revokeKey } from "./actions";
import { canAdmin, requireMembership } from "@/lib/session";
import { ENDPOINTS } from "@/lib/api/catalogue";
import { siteOrigin } from "@/lib/origin";
import { date, dateTime } from "@/lib/format";

const STATUS: Record<string, string> = { queued: "Queued", running: "Running", succeeded: "Done", failed: "Failed" };

export default async function Developers() {
  const { supabase, org, role } = await requireMembership();
  const admin = canAdmin(role);
  const [{ data: account }, { data: keys }, { data: jobs }, { data: used }] = await Promise.all([
    supabase.from("api_accounts").select("enabled, monthly_credits, per_minute").eq("org_id", org.id).maybeSingle(),
    admin
      ? supabase.from("api_keys").select("id, name, prefix, created_at, last_used_at, revoked_at").eq("org_id", org.id).order("created_at", { ascending: false })
      : Promise.resolve({ data: [] as { id: string; name: string; prefix: string; created_at: string; last_used_at: string | null; revoked_at: string | null }[] }),
    supabase.from("api_jobs").select("id, endpoint, status, units, error, created_at").eq("org_id", org.id).order("created_at", { ascending: false }).limit(25),
    supabase.rpc("my_api_credits_used", { p_org: org.id }),
  ]);
  const origin = await siteOrigin();
  const on = Boolean(account?.enabled);
  const title = (id: string) => ENDPOINTS.find((e) => e.id === id)?.title ?? (id === "request" ? "Studio request" : id);

  return (
    <>
      <div className="app-head">
        <div>
          <h1>API</h1>
          <p className="muted">
            Let your own software or AI agents ask Nka for work. <Link href="/developers">Read the docs</Link>.
          </p>
        </div>
      </div>
      {!on && (
        <div className="callout">
          <p>The API isn&apos;t switched on for {org.name} yet. Ask Nka to turn it on and set your monthly credits.</p>
        </div>
      )}
      <div className="grid-main">
        <div>
          {admin && (
            <section className="panel">
              <h2>Keys</h2>
              {(keys ?? []).length === 0 ? (
                <p className="muted">No keys yet.</p>
              ) : (
                <div className="table-scroll">
                  <table className="table">
                    <thead>
                      <tr>
                        <th>Name</th>
                        <th>Key</th>
                        <th>Made</th>
                        <th>Last used</th>
                        <th></th>
                      </tr>
                    </thead>
                    <tbody>
                      {(keys ?? []).map((k) => (
                        <tr key={k.id}>
                          <td>{k.name}</td>
                          <td>
                            <code>{k.prefix}…</code>
                          </td>
                          <td>{date(k.created_at)}</td>
                          <td>{k.revoked_at ? "Revoked" : k.last_used_at ? dateTime(k.last_used_at) : "Never"}</td>
                          <td>
                            {!k.revoked_at && (
                              <form action={revokeKey}>
                                <input type="hidden" name="id" value={k.id} />
                                <button className="btn btn-small btn-danger" type="submit">
                                  Revoke
                                </button>
                              </form>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          )}
          <section className="panel">
            <h2>Recent requests</h2>
            {(jobs ?? []).length === 0 ? (
              <p className="muted">Nothing yet. Requests made with your keys appear here.</p>
            ) : (
              <div className="table-scroll">
                <table className="table">
                  <thead>
                    <tr>
                      <th>When</th>
                      <th>Service</th>
                      <th>Status</th>
                      <th>Credits</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(jobs ?? []).map((j) => (
                      <tr key={j.id}>
                        <td>{dateTime(j.created_at)}</td>
                        <td>{title(j.endpoint)}</td>
                        <td>
                          {STATUS[j.status] ?? j.status}
                          {j.status === "failed" && (j.error as { message?: string } | null)?.message ? (
                            <>
                              <br />
                              <span className="small muted">{(j.error as { message: string }).message}</span>
                            </>
                          ) : null}
                        </td>
                        <td>{j.status === "failed" ? 0 : j.units}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </div>
        <aside>
          <section className="panel">
            <h2>This month</h2>
            <dl className="kv">
              <dt>Credits used</dt>
              <dd>
                {Number(used ?? 0)} of {account?.monthly_credits ?? 0}
              </dd>
              <dt>Requests a minute</dt>
              <dd>{account?.per_minute ?? 0} per key</dd>
            </dl>
            <p className="hint">Failed requests cost nothing. Credits reset on the 1st (UTC).</p>
          </section>
          {admin && on && (
            <section className="panel">
              <h2>New key</h2>
              <NewKeyForm />
            </section>
          )}
          <section className="panel">
            <h2>Credits per request</h2>
            <dl className="kv">
              {ENDPOINTS.map((e) => (
                <div key={e.id} style={{ display: "contents" }}>
                  <dt>{e.title}</dt>
                  <dd>{e.units}</dd>
                </div>
              ))}
            </dl>
            <p className="hint">
              Base address: <code>{origin}/api/v1</code>
            </p>
          </section>
        </aside>
      </div>
    </>
  );
}
