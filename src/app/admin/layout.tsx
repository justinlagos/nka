import type { Metadata } from "next";
import { AppShell } from "@/components/AppShell";
import { getMemberships, requireStaff } from "@/lib/session";

export const metadata: Metadata = { title: "Nka admin", robots: { index: false } };

// Nka itself: every client, designer and partner. Anyone else is sent to their own area.
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const { profile } = await requireStaff();
  const memberships = await getMemberships();
  return (
    <AppShell profile={profile} area="admin" memberships={memberships}>
      {children}
    </AppShell>
  );
}
