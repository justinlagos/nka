import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AppShell } from "@/components/AppShell";
import { AREA_HOME, areaOf, requireProfile } from "@/lib/session";

export const metadata: Metadata = { title: "Designer studio", robots: { index: false } };

// The designer's area. A designer only ever sees the clients Nka has assigned to them.
// Clients and the admin are sent to their own areas.
export default async function DesignerLayout({ children }: { children: React.ReactNode }) {
  const { profile } = await requireProfile();
  const area = areaOf(profile);
  if (area !== "designer") redirect(AREA_HOME[area]);
  return (
    <AppShell profile={profile} area="designer">
      {children}
    </AppShell>
  );
}
