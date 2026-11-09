import { ActionForm } from "@/components/ActionForm";
import { CopyLink } from "@/components/CopyLink";
import { changeRole, inviteMember, removeMember, renameOrg, revokeInvite, updateMyName } from "../actions";
import { canAdmin, requireMembership } from "@/lib/session";
import { people, displayName } from "@/lib/data";
import { siteOrigin } from "@/lib/origin";
import { date } from "@/lib/format";

const ROLE_TEXT: Record<string, string> = {
  owner: "Owner",
  admin: "Admin: everything, including billing and approving estimates",
  member: "Member: sends briefs, comments and reviews files",
  viewer: "Viewer: sees everything, changes nothing",
};

export default async function Team() {
  const { supabase, org, role, profile, userId } = await requireMembership();
  const admin = canAdmin(role);
  const [{ data: members }, { data: invites }] = await Promise.all([
    supabase.from("org_members").select("user_id, role, created_at").eq("org_id", org.id).order("created_at"),
    admin
      ? supabase.from("invites").select("id, email, role, token, created_at").eq("org_id", org.id).is("accepted_at", null).order("created_at", { ascending: false })
      : Promise.resolve({ data: [] as { id: string; email: string; role: string; token: string; created_at: string }[] }),
  ]);
  const who = await people(supabase, (members ?? []).map((m) => m.user_id));
  const origin = await siteOrigin();

  return (
    <>
      <div className="app-head">
        <div>
          <h1>Team</h1>
          <p className="muted">Invite as many people as you like. There&apos;s no charge per seat.</p>
        </div>
      </div>
      <div className="grid-main">
        <div>
          <section className="panel">
            <h2>People in {org.name}</h2>
            <table className="table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Role</th>
                  <th>Joined</th>
                  {admin && <th></th>}
                </tr>
              </thead>
              <tbody>
                {(members ?? []).map((m) => {
                  const p = who.get(m.user_id);
                  const editable = admin && m.role !== "owner" && m.user_id !== userId;
                  return (
                    <tr key={m.user_id}>
                      <td>
                        {displayName(p)}
                        <br />
                        <span className="small muted">{p?.email}</span>
                      </td>
                      <td>
                        {editable ? (
                          <form action={changeRole} className="inline-actions">
                            <input type="hidden" name="user" value={m.user_id} />
                            <label className="skip" htmlFor={`r-${m.user_id}`}>
                              Role
                            </label>
                            <select id={`r-${m.user_id}`} name="role" defaultValue={m.role} style={{ width: "auto" }}>
                              <option value="admin">Admin</option>
                              <option value="member">Member</option>
                              <option value="viewer">Viewer</option>
                            </select>
                            <button className="btn btn-small btn-line" type="submit">
                              Save
                            </button>
                          </form>
                        ) : (
                          ROLE_TEXT[m.role]?.split(":")[0]
                        )}
                      </td>
                      <td>{date(m.created_at)}</td>
                      {admin && (
                        <td>
                          {editable && (
                            <form action={removeMember}>
                              <input type="hidden" name="user" value={m.user_id} />
                              <button className="btn btn-small btn-danger" type="submit">
                                Remove
                              </button>
                            </form>
                          )}
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </section>

          {admin && (invites ?? []).length > 0 && (
            <section className="panel">
              <h2>Invites waiting</h2>
              <p className="small muted">Send each person their link. It only works when they sign in with the invited email.</p>
              <ul className="list">
                {(invites ?? []).map((i) => (
                  <li key={i.id} style={{ padding: "10px 0", display: "grid", gap: 6 }}>
                    <div className="inline-actions" style={{ justifyContent: "space-between" }}>
                      <span>
                        <b>{i.email}</b> <span className="muted small">as {i.role}, {date(i.created_at)}</span>
                      </span>
                      <form action={revokeInvite}>
                        <input type="hidden" name="id" value={i.id} />
                        <button className="btn btn-small btn-line" type="submit">
                          Cancel invite
                        </button>
                      </form>
                    </div>
                    <CopyLink url={`${origin}/app/invite/${i.token}`} />
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>

        <aside>
          {admin && (
            <section className="panel">
              <h2>Invite someone</h2>
              <ActionForm action={inviteMember} submit="Create invite link" pending="Creating" resetOnSuccess>
                <label className="field">
                  <span>Their work email</span>
                  <input type="email" name="email" required maxLength={200} />
                </label>
                <label className="field">
                  <span>Role</span>
                  <select name="role" defaultValue="member">
                    <option value="admin">Admin</option>
                    <option value="member">Member</option>
                    <option value="viewer">Viewer</option>
                  </select>
                </label>
                <ul className="small muted" style={{ paddingLeft: 18, marginTop: 0 }}>
                  {["admin", "member", "viewer"].map((r) => (
                    <li key={r}>{ROLE_TEXT[r]}</li>
                  ))}
                </ul>
              </ActionForm>
            </section>
          )}
          <section className="panel">
            <h2>Your name</h2>
            <ActionForm action={updateMyName} submit="Save" pending="Saving" buttonClass="btn btn-small">
              <label className="field">
                <span className="skip">Your name</span>
                <input type="text" name="full_name" defaultValue={profile.full_name} maxLength={120} />
              </label>
            </ActionForm>
          </section>
          {admin && (
            <section className="panel">
              <h2>Organisation</h2>
              <ActionForm action={renameOrg} submit="Save" pending="Saving" buttonClass="btn btn-small">
                <label className="field">
                  <span>Name</span>
                  <input type="text" name="name" defaultValue={org.name} required maxLength={120} />
                </label>
                <label className="field">
                  <span>Country</span>
                  <input type="text" name="country" defaultValue={org.country} maxLength={80} />
                </label>
              </ActionForm>
            </section>
          )}
        </aside>
      </div>
    </>
  );
}
