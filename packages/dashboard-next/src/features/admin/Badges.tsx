import { Tag } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { EmptyState } from "@/components/EmptyState";
import { Card } from "@/components/ui/card";

export function AdminBadgesPage() {
  // No `/api/badges` backend exists (badges are embedded in service entities).
  // Render a real empty-state rather than fabricated seed rows (WP-40).
  return (
    <div className="space-y-5">
      <PageHeader title="Manage Badges" description="Badge management" />
      <Card className="p-2">
        <EmptyState
          icon={<Tag className="size-8" />}
          title="No badges configured"
          description="Badge management is not yet implemented. Badges are currently defined per service."
        />
      </Card>
    </div>
  );
}
