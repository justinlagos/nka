import type { Metadata } from "next";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { AppShell } from "@/components/AppShell";
import { areaOf, getCurrentMembership, getMemberships, requireProfile } from "@/lib/session";

export const metadata: Metadata = { title: "Workspace", robots: { index: false } };

// The client's workspace. Designers never come here (they have /studio); the admin can, to try a
// test client workspace.
export default async function WorkspaceLayout({ children }: { children: React.ReactNode }) {
  const { profile } = await requireProfile();
  if (areaOf(profile) === "designer") {
    // A client project link opens the same project in the designer area.
    const m = ((await headers()).get("x-nka-path") ?? "").match(/^\/app\/projects\/([0-9a-f-]{36})/);
    redirect(m ? `/studio/projects/${m[1]}` : "/studio");
  }
  const [memberships, current] = await Promise.all([getMemberships(), getCurrentMembership()]);
  return (
    <AppShell profile={profile} area="client" memberships={memberships} current={current}>
      {children}
    </AppShell>
  );
}
