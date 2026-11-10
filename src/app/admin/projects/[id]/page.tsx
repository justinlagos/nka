import { ProjectScreen } from "@/components/project/ProjectScreen";

export const maxDuration = 300;

// The admin's view of any project: everything the client sees, plus studio controls
// (price, assign, stage) and the client's plan.
export default async function AdminProjectPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ sent?: string }>;
}) {
  const { id } = await params;
  const { sent } = await searchParams;
  return <ProjectScreen id={id} sent={sent} mode="admin" />;
}
