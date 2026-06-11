import { FolderGit2 } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { EmptyState } from "@/components/EmptyState";
import { Card } from "@/components/ui/card";

export function AdminProjectsPage() {
  // No `/api/projects` backend exists in the contract. Render a real
  // empty-state rather than fabricated seed rows (WP-40).
  return (
    <div className="space-y-5">
      <PageHeader title="Manage Projects" description="Project management" />
      <Card className="p-2">
        <EmptyState
          icon={<FolderGit2 className="size-8" />}
          title="No projects configured"
          description="Project management is not yet implemented."
        />
      </Card>
    </div>
  );
}
