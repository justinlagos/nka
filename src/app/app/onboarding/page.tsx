import { redirect } from "next/navigation";
import { ActionForm } from "@/components/ActionForm";
import { createOrg } from "../actions";
import { getCurrentMembership, requireProfile } from "@/lib/session";

export default async function Onboarding() {
  const { profile } = await requireProfile();
  if (await getCurrentMembership()) redirect("/app");
  return (
    <div style={{ maxWidth: 560 }}>
      <div className="app-head">
        <div>
          <h1>Set up your workspace</h1>
          <p className="muted">
            Welcome{profile.full_name ? `, ${profile.full_name.split(" ")[0]}` : ""}. Name your organisation; you can invite your
            team next. If a colleague already uses Nka, ask them for an invite link instead.
          </p>
        </div>
      </div>
      <div className="panel">
        <ActionForm action={createOrg} submit="Create workspace" pending="Creating">
          <label className="field">
            <span>Organisation name</span>
            <input type="text" name="name" required maxLength={120} autoComplete="organization" />
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
    </div>
  );
}
