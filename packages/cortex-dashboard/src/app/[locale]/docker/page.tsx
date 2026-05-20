import { DockerTable } from "@/components/docker/docker-table";

export default function DockerPage() {
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Docker</h1>
        <p className="text-sm text-muted-foreground">Containers, images, and volumes on this host.</p>
      </div>
      <DockerTable />
    </div>
  );
}
