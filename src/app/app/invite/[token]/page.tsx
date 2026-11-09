import { ActionForm } from "@/components/ActionForm";
import { acceptInvite } from "../../actions";
import { requireProfile } from "@/lib/session";

export default async function Invite({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const { profile } = await requireProfile();
  return (
    <div style={{ maxWidth: 520 }}>
      <div className="app-head">
        <div>
          <h1>Join your team on Nka</h1>
          <p className="muted">You&apos;re signed in as {profile.email}. The invite must have been sent to this address.</p>
        </div>
      </div>
      <section className="panel">
        <ActionForm action={acceptInvite} submit="Accept invite" pending="Joining">
          <input type="hidden" name="token" value={token} />
        </ActionForm>
      </section>
    </div>
  );
}
