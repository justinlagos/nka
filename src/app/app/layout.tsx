import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AppShell } from "@/components/AppShell";
import { areaOf, getCurrentMembership, getMemberships, requireProfile } from "@/lib/session";

export const metadata: Metadata = { title: "Workspace", robots: { index: false } };

// The client's workspace. Designers never come here (they have /studio); the admin can, to try a
// test client workspace.
export default async function WorkspaceLayout({ children }: { children: React.ReactNode }) {
  const { profile } = await requireProfile();
  if (areaOf(profile) === "designer") redirect("/studio");
  const [memberships, current] = await Promise.all([getMemberships(), getCurrentMembership()]);
  return (
    <AppShell profile={profile} area="client" memberships={memberships} current={current}>
      {children}
    </AppShell>
  );
}
