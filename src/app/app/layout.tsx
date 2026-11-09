import type { Metadata } from "next";
import { AppShell } from "@/components/AppShell";
import { getCurrentMembership, getMemberships, requireProfile } from "@/lib/session";

export const metadata: Metadata = { title: "Workspace", robots: { index: false } };

export default async function WorkspaceLayout({ children }: { children: React.ReactNode }) {
  const { profile } = await requireProfile();
  const [memberships, current] = await Promise.all([getMemberships(), getCurrentMembership()]);
  return (
    <AppShell profile={profile} memberships={memberships} current={current}>
      {children}
    </AppShell>
  );
}
