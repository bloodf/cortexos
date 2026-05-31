"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Activity, Container, Boxes, Server, Settings2 } from "lucide-react";
import { cn } from "@/lib/utils";

const MOBILE_TABS = [
  { href: "/overview", label: "Overview", icon: Activity },
  { href: "/docker", label: "Docker", icon: Container },
  { href: "/incus", label: "Incus", icon: Boxes },
  { href: "/systemd", label: "Systemd", icon: Server },
  { href: "/admin/services", label: "Admin", icon: Settings2 },
];

export function MobileTabBar() {
  const path = usePathname() ?? "/";
  return (
    <nav className="fixed bottom-0 inset-x-0 z-30 md:hidden bg-background/95 backdrop-blur border-t flex">
      {MOBILE_TABS.map((it) => {
        const active = path === it.href;
        return (
          <Link
            key={it.href}
            href={it.href}
            className={cn(
              "flex-1 flex flex-col items-center gap-0.5 py-2 text-[10px]",
              active ? "text-primary" : "text-muted-foreground hover:text-foreground",
            )}
          >
            <it.icon className="size-5" />
            <span>{it.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
