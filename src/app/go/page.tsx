import { redirect } from "next/navigation";
import { AREA_HOME, areaOf, getMemberships, getSession } from "@/lib/session";

export const dynamic = "force-dynamic";

// The one place sign-in sends people: the admin to /admin, a designer to /studio,
// a client to their workspace (or to set one up).
export default async function Go() {
  const { userId, profile } = await getSession();
  if (!userId || !profile) redirect("/signin");
  const area = areaOf(profile);
  if (area !== "client") redirect(AREA_HOME[area]);
  const memberships = await getMemberships();
  redirect(memberships.length ? "/app" : "/app/onboarding");
}
