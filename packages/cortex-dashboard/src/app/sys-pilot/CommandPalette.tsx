"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { CommandDialog, CommandInput, CommandList, CommandEmpty, CommandGroup, CommandItem } from "@/components/ui/command";
import { useAuth } from "@/hooks/useAuth";
import { useTheme } from "next-themes";
import { NAV_GROUPS } from "@/components/layout/nav-config";
import { Moon, Sun, Keyboard, LogOut } from "lucide-react";
import { toast } from "sonner";

interface Props { open: boolean; onOpenChange: (o: boolean) => void; onOpenHelp?: () => void }

const RECENT_KEY = "cortex.palette.recent";

export function CommandPalette({ open, onOpenChange, onOpenHelp }: Props) {
  const { user, logout } = useAuth();
  const { theme, setTheme } = useTheme();
  const router = useRouter();
  const [recent, setRecent] = useState<string[]>(() => {
    try { return JSON.parse(localStorage.getItem(RECENT_KEY) || "[]"); } catch { return []; }
  });
  const [q, setQ] = useState("");

  const navItems = useMemo(() => NAV_GROUPS.flatMap((g) => g.items), []);

  const close = () => onOpenChange(false);

  const runNav = (to: string) => {
    const next = [to, ...recent.filter((r) => r !== to)].slice(0, 5);
    setRecent(next);
    try { localStorage.setItem(RECENT_KEY, JSON.stringify(next)); } catch { /* noop */ }
    close();
    router.push(to);
  };

  const actions: { id: string; label: string; icon: React.ComponentType<{ className?: string }>; admin?: boolean; run: () => void }[] = [
    { id: "act-theme", label: `Switch theme to ${theme === "dark" ? "light" : "dark"}`, icon: theme === "dark" ? Sun : Moon, run: () => { setTheme(theme === "dark" ? "light" : "dark"); toast.success("Theme switched"); } },
    { id: "act-help", label: "Show keyboard shortcuts", icon: Keyboard, run: () => onOpenHelp?.() },
    { id: "act-logout", label: "Sign out", icon: LogOut, run: () => { logout(); window.location.href = "/login"; } },
  ];

  return (
    <CommandDialog open={open} onOpenChange={onOpenChange}>
      <CommandInput placeholder="Search pages, actions…" value={q} onValueChange={setQ} />
      <CommandList className="max-h-[60vh]">
        <CommandEmpty>No results.</CommandEmpty>

        {!q && recent.length > 0 && (
          <CommandGroup heading="Recent">
            {recent.map((r) => {
              const nav = navItems.find((n) => n.href === r);
              if (!nav) return null;
              return (
                <CommandItem key={r} onSelect={() => runNav(r)}>
                  <nav.icon className="size-4 mr-2" />{nav.label}
                </CommandItem>
              );
            })}
          </CommandGroup>
        )}

        <CommandGroup heading="Navigation">
          {navItems.map((it) => (
            <CommandItem key={it.href} onSelect={() => runNav(it.href)} value={`nav ${it.label} ${it.href}`}>
              <it.icon className="size-4 mr-2" />
              <span className="flex-1">{it.label}</span>
              <span className="text-xs text-muted-foreground">{it.href}</span>
            </CommandItem>
          ))}
        </CommandGroup>

        <CommandGroup heading="Actions">
          {actions.filter((a) => !a.admin || user?.is_admin).map((a) => (
            <CommandItem key={a.id} onSelect={() => { a.run(); close(); }} value={`action ${a.label}`}>
              <a.icon className="size-3.5 mr-2 text-muted-foreground" />
              <span>{a.label}</span>
              {a.admin && <span className="ml-auto text-[10px] text-muted-foreground">admin</span>}
            </CommandItem>
          ))}
        </CommandGroup>
      </CommandList>
      <div className="border-t px-3 py-1.5 flex justify-between text-[10px] text-muted-foreground">
        <span>↑↓ to move</span><span>↵ to select</span><span>esc to close</span>
      </div>
    </CommandDialog>
  );
}
