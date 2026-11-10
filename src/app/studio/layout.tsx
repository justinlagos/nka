import type { Metadata } from "next";
import { AppShell } from "@/components/AppShell";
import { getCurrentMembership, getMemberships, requireStudio } from "@/lib/session";

export const metadata: Metadata = { title: "Your work", robots: { index: false } };

// The designer's area. A designer only ever sees the clients Nka has assigned to them.
export default async function DesignerLayout({ children }: { children: React.ReactNode }) {
  const { profile } = await requireStudio();
  const [memberships, current] = await Promise.all([getMemberships(), getCurrentMembership()]);
  return (
    <AppShell profile={profile} memberships={memberships} current={current}>
      {children}
    </AppShell>
  );
}
