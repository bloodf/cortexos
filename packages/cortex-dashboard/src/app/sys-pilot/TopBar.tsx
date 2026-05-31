"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Bell, Check, Menu, Moon, PanelLeftClose, PanelLeftOpen, Search, Sun, Monitor, Palette, LogOut, ChevronRight, User as UserIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger, DropdownMenuRadioGroup, DropdownMenuRadioItem } from "@/components/ui/dropdown-menu";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useTheme } from "next-themes";
import { useAuth } from "@/hooks/useAuth";
import { NAV_GROUPS, ALL_NAV_ITEMS } from "@/components/layout/nav-config";
import { cn } from "@/lib/utils";
import { useState, useEffect } from "react";

interface Props { collapsed: boolean; onToggleCollapse: () => void; onOpenMobile: () => void; onOpenPalette: () => void; onOpenHelp?: () => void }

export function TopBar({ collapsed, onToggleCollapse, onOpenMobile, onOpenPalette, onOpenHelp }: Props) {
  const { theme, setTheme } = useTheme();
  const { user, logout } = useAuth();
  const path = usePathname() ?? "/";
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  const crumbs = breadcrumbs(path);

  return (
    <header className="sticky top-0 z-30 h-14 bg-background/80 backdrop-blur border-b flex items-center gap-2 px-3 sm:px-5">
      <Button variant="ghost" size="icon" className="md:hidden" onClick={onOpenMobile} aria-label="Menu"><Menu className="size-4" /></Button>
      <Button variant="ghost" size="icon" className="hidden md:inline-flex" onClick={onToggleCollapse} aria-label="Toggle sidebar">
        {collapsed ? <PanelLeftOpen className="size-4" /> : <PanelLeftClose className="size-4" />}
      </Button>

      <nav className="hidden md:flex items-center text-sm text-muted-foreground min-w-0">
        {crumbs.map((c, i) => (
          <span key={i} className="flex items-center min-w-0">
            {i > 0 && <ChevronRight className="size-3 mx-1 opacity-50" />}
            {c.to ? <Link href={c.to} className="hover:text-foreground truncate">{c.label}</Link> : <span className="text-foreground font-medium truncate">{c.label}</span>}
          </span>
        ))}
      </nav>

      <div className="flex-1" />

      <button
        onClick={onOpenPalette}
        className="hidden sm:flex items-center gap-2 rounded-md border bg-muted/40 px-3 h-9 text-sm text-muted-foreground hover:bg-muted/70 transition-colors min-w-[200px] lg:min-w-[280px]"
      >
        <Search className="size-4" />
        <span className="flex-1 text-left">Search</span>
        <kbd className="hidden lg:inline-flex items-center gap-1 rounded border bg-background px-1.5 py-0.5 text-[10px] font-mono">⌘K</kbd>
      </button>

      <Button variant="ghost" size="icon" className="sm:hidden" onClick={onOpenPalette} aria-label="Search"><Search className="size-4" /></Button>
      {onOpenHelp && (
        <Button variant="ghost" size="icon" onClick={onOpenHelp} aria-label="Keyboard shortcuts" className="hidden md:inline-flex">
          <kbd className="text-[11px] font-mono">?</kbd>
        </Button>
      )}

      <DropdownMenu>
        <DropdownMenuTrigger>
          <Button variant="ghost" size="icon" aria-label="Theme">
            {mounted && (theme === "dark" ? <Moon className="size-4" /> : theme === "light" ? <Sun className="size-4" /> : <Monitor className="size-4" />)}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-40">
          <DropdownMenuLabel>Theme</DropdownMenuLabel>
          <DropdownMenuRadioGroup value={theme ?? "system"} onValueChange={(v) => setTheme(v)}>
            <DropdownMenuRadioItem value="light"><Sun className="size-3.5 mr-2" />Light</DropdownMenuRadioItem>
            <DropdownMenuRadioItem value="dark"><Moon className="size-3.5 mr-2" />Dark</DropdownMenuRadioItem>
            <DropdownMenuRadioItem value="system"><Monitor className="size-3.5 mr-2" />System</DropdownMenuRadioItem>
          </DropdownMenuRadioGroup>
        </DropdownMenuContent>
      </DropdownMenu>

      <Popover>
        <PopoverTrigger>
          <Button variant="ghost" size="icon" className="relative" aria-label="Notifications">
            <Bell className="size-4" />
            <span className="absolute top-1.5 right-1.5 size-2 rounded-full bg-[var(--destructive)]" />
          </Button>
        </PopoverTrigger>
        <PopoverContent align="end" className="w-80 p-0">
          <div className="px-3 py-2 border-b flex items-center justify-between">
            <span className="text-sm font-medium">Notifications</span>
            <span className="text-xs text-muted-foreground">0 unread</span>
          </div>
          <div className="px-3 py-8 text-center text-sm text-muted-foreground">
            No notifications yet
          </div>
        </PopoverContent>
      </Popover>

      <DropdownMenu>
        <DropdownMenuTrigger>
          <button className="flex items-center gap-2 rounded-md hover:bg-muted px-1.5 py-1 transition-colors" aria-label="Account">
            <div className="size-7 grid place-items-center rounded-full bg-primary text-primary-foreground text-xs font-semibold">
              {user?.username?.slice(0, 2).toUpperCase() ?? "?"}
            </div>
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56">
          <DropdownMenuLabel className="flex items-center gap-2">
            <UserIcon className="size-4" />
            <div>
              <p className="text-sm font-medium">{user?.username ?? "User"}</p>
              <p className="text-xs font-normal text-muted-foreground">{user?.is_admin ? "Admin" : "Standard user"}</p>
            </div>
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={() => { logout(); window.location.href = "/login"; }} className="gap-2 text-destructive focus:text-destructive">
            <LogOut className="size-3.5" />Logout
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </header>
  );
}

function breadcrumbs(path: string): { label: string; to?: string }[] {
  const parts = path.split("/").filter(Boolean);
  if (parts.length === 0) return [{ label: "Overview" }];
  const out: { label: string; to?: string }[] = [];
  for (let i = 0; i < parts.length; i++) {
    const p = "/" + parts.slice(0, i + 1).join("/");
    const nav = ALL_NAV_ITEMS.find((n) => n.href === p);
    if (nav) out.push({ label: nav.label, to: i < parts.length - 1 ? p : undefined });
    else out.push({ label: parts[i].replace(/-/g, " ").replace(/^./, (c) => c.toUpperCase()) });
  }
  return out;
}
