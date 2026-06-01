"use client";

import { useState } from "react";
import { toast } from "sonner";
import { User, Shield, Bell, Globe, Palette } from "lucide-react";
import { PageHeader } from "@/components/sys-pilot/PageHeader";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useAuth } from "@/hooks/useAuth";
import { useTheme } from "next-themes";

export default function AdminAccountPage() {
  const { user } = useAuth();
  const { theme, setTheme } = useTheme();
  const [accent, setAccent] = useState("cortex");
  const [locale, setLocale] = useState("en");
  const [email, setEmail] = useState(`${user?.username ?? "admin"}@cortex.local`);
  const [notif, setNotif] = useState({ email: true, push: false, digest: true });

  const accents = ["cortex", "teal", "emerald", "amber"] as const;
  const locales = [
    { code: "en", label: "English" },
    { code: "es", label: "Español" },
    { code: "ptBR", label: "Português (BR)" },
  ] as const;

  return (
    <div className="space-y-5">
      <PageHeader title="Account Settings" description="Manage your profile, security, and preferences." />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card className="p-5 space-y-4">
          <h2 className="font-semibold flex items-center gap-2"><User className="size-4" />Profile</h2>
          <div className="space-y-2">
            <Label htmlFor="acc-username" className="text-xs">Username</Label>
            <Input id="acc-username" value={user?.username ?? "admin"} readOnly className="h-9" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="acc-email" className="text-xs">Email</Label>
            <Input id="acc-email" value={email} onChange={(e) => setEmail(e.target.value)} className="h-9" />
          </div>
          <Button size="sm" onClick={() => toast.success("Profile saved")}>Save</Button>
        </Card>

        <Card className="p-5 space-y-4">
          <h2 className="font-semibold flex items-center gap-2"><Shield className="size-4" />Security</h2>
          <div className="space-y-2">
            <Label htmlFor="acc-current-pw" className="text-xs">Current password</Label>
            <Input id="acc-current-pw" type="password" className="h-9" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="acc-new-pw" className="text-xs">New password</Label>
            <Input id="acc-new-pw" type="password" className="h-9" />
          </div>
          <Button size="sm" onClick={() => toast.success("Password updated")}>Update password</Button>
        </Card>

        <Card className="p-5 space-y-4">
          <h2 className="font-semibold flex items-center gap-2"><Bell className="size-4" />Notifications</h2>
          {(["email", "push", "digest"] as const).map((k) => (
            <div key={k} className="flex items-center justify-between">
              <span className="text-sm capitalize">{k} alerts</span>
              <Switch checked={notif[k]} onCheckedChange={(v) => { setNotif({ ...notif, [k]: v }); toast.success(`${k} ${v ? "on" : "off"}`); }} />
            </div>
          ))}
        </Card>

        <Card className="p-5 space-y-4">
          <h2 className="font-semibold flex items-center gap-2"><Palette className="size-4" />Appearance</h2>
          <div className="space-y-2">
            <Label className="text-xs">Theme</Label>
            <div className="flex gap-1">
              {(["dark", "light"] as const).map((t) => (
                <Button key={t} size="sm" variant={theme === t ? "default" : "outline"} onClick={() => setTheme(t)}>{t}</Button>
              ))}
            </div>
          </div>
          <div className="space-y-2">
            <Label className="text-xs">Accent</Label>
            <div className="flex gap-1">
              {accents.map((a) => (
                <Button key={a} size="sm" variant={accent === a ? "default" : "outline"} onClick={() => setAccent(a)}>{a}</Button>
              ))}
            </div>
          </div>
          <div className="space-y-2">
            <Label className="text-xs flex items-center gap-1"><Globe className="size-3" />Language</Label>
            <div className="flex gap-1">
              {locales.map((l) => (
                <Button key={l.code} size="sm" variant={locale === l.code ? "default" : "outline"} onClick={() => setLocale(l.code)}>{l.label}</Button>
              ))}
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}
