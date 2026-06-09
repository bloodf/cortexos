import { useQuery } from "@tanstack/react-query";
import { Users } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { EmptyState } from "@/components/EmptyState";
import { Card } from "@/components/ui/card";
import { getMe } from "./rpc";

export function AdminUsersPage() {
  // There is no system-users listing endpoint yet (WP-20 only exposes the
  // current operator via `me`). Show the signed-in operator and a real
  // empty-state for the rest — never fabricate a user list.
  const { data } = useQuery({ queryKey: ["auth", "me"], queryFn: getMe, retry: false });
  const user = data?.user ?? null;

  return (
    <div className="space-y-5">
      <PageHeader
        title="Manage Users"
        description={user ? `Signed in as ${user.username}` : "User management"}
      />
      <Card className="p-2">
        <EmptyState
          icon={<Users className="size-8" />}
          title="User list requires a system users endpoint"
          description="The dashboard does not yet expose a PAM user directory (WP-20). Local UNIX accounts and group memberships are managed on the host."
        />
      </Card>
    </div>
  );
}
