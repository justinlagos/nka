import Link from "next/link";
import { requireStaff } from "@/lib/session";
import { dateTime } from "@/lib/format";

type Event = {
  id: number;
  kind: "conversation" | "case_opened" | "case_resolved" | "other";
  org_id: string | null;
  summary: string;
  intent: string;
  needs_human: boolean;
  case_number: number | null;
  case_subject: string;
  case_status: string;
  case_priority: string;
  created_at: string;
};

const KIND: Record<Event["kind"], string> = {
  conversation: "Chat",
  case_opened: "Case opened",
  case_resolved: "Case solved",
  other: "Other",
};

// What Abigail (Custard AI) sends back: chat summaries and support cases. Replies to clients
// happen in Custard AI's Inbox; this page is the record in Nka, with each client linked.
export default async function Support() {
  const { supabase } = await requireStaff();
  const [{ data }, { data: orgRows }] = await Promise.all([
    supabase.from("support_events").select("*").order("created_at", { ascending: false }).limit(200),
    supabase.from("orgs").select("id, name"),
  ]);
  const events = (data ?? []) as Event[];
  const orgs = new Map((orgRows ?? []).map((o) => [o.id as string, o.name as string]));

  const solved = new Set(events.filter((e) => e.kind === "case_resolved" && e.case_number !== null).map((e) => e.case_number));
  const open = events.filter((e) => e.kind === "case_opened" && !solved.has(e.case_number));
  const followUps = events.filter((e) => e.kind === "conversation" && e.needs_human);

  const client = (e: Event) =>
    e.org_id ? <Link href={`/admin/clients/${e.org_id}`}>{orgs.get(e.org_id) ?? "Client"}</Link> : <span>Not signed in</span>;

  return (
    <>
      <div className="app-head">
        <div>
          <h1>Support</h1>
          <p className="muted">
            Chats with Abigail and the cases she opens. Reply to clients in Custard AI, under Inbox. Anything that needs a person is also emailed
            to the studio.
          </p>
        </div>
      </div>

      <section className="panel">
        <h2>Open cases</h2>
        {open.length === 0 ? (
          <p className="muted">None.</p>
        ) : (
          open.map((e) => (
            <div key={e.id} style={{ borderTop: "1px solid var(--rule)", paddingTop: 10, marginTop: 10 }}>
              <p style={{ margin: 0 }}>
                <b>
                  Case {e.case_number}: {e.case_subject || "No subject"}
                </b>
                {e.case_priority ? `, ${e.case_priority} priority` : ""}
              </p>
              <p className="small muted" style={{ margin: "2px 0 6px" }}>
                {client(e)}, {dateTime(e.created_at)}
              </p>
              {e.summary && <p style={{ whiteSpace: "pre-wrap", margin: 0 }}>{e.summary}</p>}
            </div>
          ))
        )}
      </section>

      {followUps.length > 0 && (
        <section className="panel">
          <h2>Chats that need a follow-up</h2>
          {followUps.map((e) => (
            <div key={e.id} style={{ borderTop: "1px solid var(--rule)", paddingTop: 10, marginTop: 10 }}>
              <p className="small muted" style={{ margin: "0 0 4px" }}>
                {client(e)}, {dateTime(e.created_at)}
                {e.intent ? `, ${e.intent}` : ""}
              </p>
              <p style={{ whiteSpace: "pre-wrap", margin: 0 }}>{e.summary || "No summary."}</p>
            </div>
          ))}
        </section>
      )}

      <section className="panel">
        <h2>Everything, newest first</h2>
        {events.length === 0 ? (
          <p className="muted">Nothing yet. Summaries arrive here once the Custard AI webhook is connected.</p>
        ) : (
          <dl className="kv">
            {events.map((e) => (
              <div key={e.id} style={{ display: "contents" }}>
                <dt>
                  {KIND[e.kind]}
                  {e.case_number ? ` ${e.case_number}` : ""}
                  <br />
                  <span className="small muted">{dateTime(e.created_at)}</span>
                </dt>
                <dd>
                  <span className="small">{client(e)}</span>
                  <br />
                  {e.summary || e.case_subject || "No summary."}
                </dd>
              </div>
            ))}
          </dl>
        )}
      </section>
    </>
  );
}
