import { useQuery } from "@tanstack/react-query";
import { User, Shield, Palette } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { useUI } from "@/hooks/useUI";
import { getMe } from "./rpc";

export function AdminAccountPage() {
  const { theme, setTheme, accent, setAccent } = useUI();
  const { data } = useQuery({ queryKey: ["auth", "me"], queryFn: getMe, retry: false });
  const user = data?.user ?? null;
  const groups = user?.groupMemberships?.map((g) => g.name) ?? [];

  const accents = ["cortex", "teal", "emerald", "amber"] as const;

  return (
    <div className="space-y-5">
      <PageHeader
        title="Account Settings"
        description="Manage your profile, security, and preferences."
      />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card className="p-5 space-y-4">
          <h2 className="font-semibold flex items-center gap-2">
            <User className="size-4" />
            Profile
          </h2>
          <div className="space-y-2">
            <Label className="text-xs">Username</Label>
            <Input value={user?.username ?? "—"} readOnly className="h-9" />
          </div>
          <div className="space-y-2">
            <Label className="text-xs">Role</Label>
            <div>
              <Badge variant={user?.isAdmin ? "default" : "outline"} className="text-[10px]">
                {user?.isAdmin ? "Admin" : "Standard"}
              </Badge>
            </div>
          </div>
          <div className="space-y-2">
            <Label className="text-xs">Groups</Label>
            <div className="flex flex-wrap gap-1">
              {groups.length > 0 ? (
                groups.map((g) => (
                  <Badge key={g} variant="secondary" className="text-[10px]">
                    {g}
                  </Badge>
                ))
              ) : (
                <span className="text-xs text-muted-foreground">No group memberships</span>
              )}
            </div>
          </div>
        </Card>

        <Card className="p-5 space-y-4">
          <h2 className="font-semibold flex items-center gap-2">
            <Shield className="size-4" />
            Security
          </h2>
          <p className="text-sm text-muted-foreground">
            Password and credential changes are managed by the host system (PAM). Self-service
            password change is not available from the dashboard.
          </p>
        </Card>

        <Card className="p-5 space-y-4">
          <h2 className="font-semibold flex items-center gap-2">
            <Palette className="size-4" />
            Appearance
          </h2>
          <div className="space-y-2">
            <Label className="text-xs">Theme</Label>
            <div className="flex gap-1">
              {(["dark", "light"] as const).map((t) => (
                <Button
                  key={t}
                  size="sm"
                  variant={theme === t ? "default" : "outline"}
                  onClick={() => setTheme(t)}
                >
                  {t}
                </Button>
              ))}
            </div>
          </div>
          <div className="space-y-2">
            <Label className="text-xs">Accent</Label>
            <div className="flex gap-1">
              {accents.map((a) => (
                <Button
                  key={a}
                  size="sm"
                  variant={accent === a ? "default" : "outline"}
                  onClick={() => setAccent(a)}
                >
                  {a}
                </Button>
              ))}
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}
