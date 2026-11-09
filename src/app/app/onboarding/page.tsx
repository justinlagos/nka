import Link from "next/link";
import { redirect } from "next/navigation";
import { ActionForm } from "@/components/ActionForm";
import { acceptInvite, createOrg } from "../actions";
import { getCurrentMembership, requireProfile } from "@/lib/session";

export default async function Onboarding({ searchParams }: { searchParams: Promise<{ setup?: string }> }) {
  const { setup } = await searchParams;
  const { supabase, profile } = await requireProfile();
  if (await getCurrentMembership()) redirect("/app");
  // Signed in from a demo request on another device: finish building their workspace.
  const { data: pending } = await supabase.rpc("pending_demo");
  if (pending === true && setup !== "failed") redirect("/demo/ready");
  const { data } = await supabase.rpc("my_invites");
  const invites = (data ?? []) as { token: string; org_name: string; role: string }[];
  const first = profile.full_name.split(" ")[0];

  return (
    <div style={{ maxWidth: 560 }}>
      <div className="app-head">
        <div>
          <h1>{profile.is_staff ? "Try the client side" : "Set up your workspace"}</h1>
          <p className="muted">
            {profile.is_staff
              ? "You're studio staff. Create a test workspace to see exactly what clients see: briefs, estimates, review and the library. Your studio queue stays in the menu."
              : `Welcome${first ? `, ${first}` : ""}. Name your organisation; you can invite your team next.`}
          </p>
        </div>
      </div>

      {setup === "failed" && (
        <div className="callout callout-warn">
          <p>We couldn&apos;t finish setting up your workspace from your answers. Name it below and we&apos;ll take it from there.</p>
        </div>
      )}

      {invites.length > 0 && (
        <section className="panel">
          <h2>You&apos;ve been invited</h2>
          {invites.map((i) => (
            <div key={i.token} style={{ marginBottom: 12 }}>
              <p style={{ marginBottom: 6 }}>
                Join <b>{i.org_name}</b> as {i.role === "admin" ? "an admin" : `a ${i.role}`}.
              </p>
              <ActionForm action={acceptInvite} submit={`Join ${i.org_name}`} pending="Joining" buttonClass="btn btn-small">
                <input type="hidden" name="token" value={i.token} />
              </ActionForm>
            </div>
          ))}
          <p className="small muted">Or set up a separate workspace below.</p>
        </section>
      )}

      <div className="panel">
        <ActionForm action={createOrg} submit="Create workspace" pending="Creating">
          <label className="field">
            <span>Organisation name</span>
            <input
              type="text"
              name="name"
              required
              maxLength={120}
              autoComplete="organization"
              defaultValue={profile.is_staff ? "Test client" : ""}
            />
          </label>
          <label className="field">
            <span>Country</span>
            <select name="country" defaultValue="">
              <option value="">Choose</option>
              <option>United Kingdom</option>
              <option>Nigeria</option>
              <option>Ghana</option>
              <option>Kenya</option>
              <option>South Africa</option>
              <option>United States</option>
              <option>Other</option>
            </select>
          </label>
        </ActionForm>
      </div>
      {profile.is_staff && (
        <p className="small">
          <Link href="/admin">Back to the studio queue</Link>
        </p>
      )}
    </div>
  );
}
