import { redirect } from "next/navigation";
import { ProjectScreen } from "@/components/project/ProjectScreen";
import { areaOf, getMemberships, requireProfile } from "@/lib/session";
import { supabaseServer } from "@/lib/supabase/server";

export const maxDuration = 300;

// The client's view of a project. Designers and the admin have their own screens; links from
// emails land here and are sent on to the right one.
export default async function ClientProjectPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ sent?: string }>;
}) {
  const { id } = await params;
  const { sent } = await searchParams;
  const { profile } = await requireProfile();
  const area = areaOf(profile);
  if (area === "designer") redirect(`/studio/projects/${id}`);
  if (area === "admin") {
    const supabase = await supabaseServer();
    const { data } = await supabase.from("projects").select("org_id").eq("id", id).maybeSingle();
    const mine = (await getMemberships()).some((m) => m.org.id === data?.org_id);
    if (!mine) redirect(`/admin/projects/${id}`);
  }
  return <ProjectScreen id={id} sent={sent} mode="client" />;
}
