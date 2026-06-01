"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Activity, ChevronDown, X } from "lucide-react";
import { useState } from "react";
import { NAV_GROUPS } from "@/components/layout/nav-config";
import { useAuth } from "@/hooks/useAuth";
import { cn } from "@/lib/utils";

interface Props { collapsed: boolean; mobileOpen: boolean; onClose: () => void }

export function Sidebar({ collapsed, mobileOpen, onClose }: Props) {
  const { user } = useAuth();
  const path = usePathname() ?? "/";
  const [adminOpen, setAdminOpen] = useState(true);

  return (
    <>
      {mobileOpen && (
        <div className="fixed inset-0 z-40 bg-black/50 md:hidden" onClick={onClose} aria-hidden />
      )}
      <aside
        className={cn(
          "z-50 bg-sidebar text-sidebar-foreground border-r border-sidebar-border shrink-0 flex flex-col",
          "fixed inset-y-0 left-0 transform transition-transform md:relative md:translate-x-0",
          mobileOpen ? "translate-x-0" : "-translate-x-full",
          collapsed ? "md:w-16" : "md:w-60",
          "w-64",
        )}
      >
        <div className="h-14 flex items-center justify-between border-b border-sidebar-border px-3">
          <Link href="/overview" className="flex items-center gap-2 min-w-0">
            <div className="grid size-7 place-items-center rounded-md bg-primary text-primary-foreground shrink-0">
              <Activity className="size-4" />
            </div>
            {!collapsed && <span className="font-semibold tracking-tight truncate">CortexOS</span>}
          </Link>
          <button type="button" onClick={onClose} className="md:hidden text-sidebar-foreground/60" aria-label="Close">
            <X className="size-4" />
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto py-3 px-2 space-y-4">
          {NAV_GROUPS.map((group) => {
            const isAdmin = group.label === "Admin";
            if (isAdmin && !user?.is_admin) return null;
            return (
              <div key={group.label}>
                {isAdmin ? (
                  <button
                    type="button"
                    onClick={() => setAdminOpen(!adminOpen)}
                    className={cn(
                      "w-full flex items-center justify-between px-2 mb-1 text-[10px] uppercase tracking-wider text-sidebar-foreground/50 hover:text-sidebar-foreground/80",
                      collapsed && "md:hidden",
                    )}
                  >
                    <span>{group.label}</span>
                    <ChevronDown className={cn("size-3 transition-transform", !adminOpen && "-rotate-90")} />
                  </button>
                ) : (
                  <p className={cn("px-2 mb-1 text-[10px] uppercase tracking-wider text-sidebar-foreground/50", collapsed && "md:hidden")}>
                    {group.label}
                  </p>
                )}
                {(adminOpen || !isAdmin || collapsed) && (
                  <ul className="space-y-0.5">
                    {group.items.map((it) => (
                      <NavLink
                        key={it.href}
                        href={it.href}
                        icon={<it.icon className="size-4" />}
                        label={it.label}
                        active={path === it.href || path.startsWith(`${it.href}/`)}
                        collapsed={collapsed}
                        onClick={onClose}
                      />
                    ))}
                  </ul>
                )}
              </div>
            );
          })}
        </nav>

        <div className={cn("border-t border-sidebar-border p-3 space-y-2", collapsed && "md:px-2")}>
          <div className={cn("flex items-center gap-2 text-xs", collapsed && "md:justify-center")}>
            <span className="size-2 rounded-full bg-[var(--success)] animate-pulse" />
            {!collapsed && <span className="text-sidebar-foreground/70">Live</span>}
          </div>
          {!collapsed && user && (
            <div className="flex items-center gap-2 rounded-md bg-sidebar-accent/40 px-2 py-1.5">
              <div className="size-7 grid place-items-center rounded-full bg-primary text-primary-foreground text-xs font-semibold">
                {user.username.slice(0, 2).toUpperCase()}
              </div>
              <div className="min-w-0">
                <p className="text-xs font-medium truncate">{user.username}</p>
                <p className="text-[10px] text-sidebar-foreground/60">{user.is_admin ? "Admin" : "Standard"}</p>
              </div>
            </div>
          )}
        </div>
      </aside>
    </>
  );
}

function NavLink({ href, icon, label, active, collapsed, onClick }: { href: string; icon: React.ReactNode; label: string; active: boolean; collapsed: boolean; onClick: () => void }) {
  return (
    <li>
      <Link
        href={href}
        onClick={onClick}
        className={cn(
          "flex items-center gap-2.5 rounded-md px-2 py-1.5 text-sm transition-colors",
          active ? "bg-sidebar-accent text-sidebar-accent-foreground" : "text-sidebar-foreground/80 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground",
          collapsed && "md:justify-center md:px-2",
        )}
        title={collapsed ? label : undefined}
      >
        <span className="shrink-0">{icon}</span>
        <span className={cn("truncate", collapsed && "md:hidden")}>{label}</span>
      </Link>
    </li>
  );
}
