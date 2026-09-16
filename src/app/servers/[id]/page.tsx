import { Dashboard } from "@/components/dashboard/dashboard";

export default async function ServerPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <Dashboard key={id} serverId={id} />;
}
