import type { Metadata } from "next";
import { AppShell } from "@/components/AppShell";
import { getCurrentMembership, getMemberships, requireStaff } from "@/lib/session";

export const metadata: Metadata = { title: "Studio", robots: { index: false } };

export default async function StudioLayout({ children }: { children: React.ReactNode }) {
  const { profile } = await requireStaff();
  const [memberships, current] = await Promise.all([getMemberships(), getCurrentMembership()]);
  return (
    <AppShell profile={profile} memberships={memberships} current={current}>
      {children}
    </AppShell>
  );
}
