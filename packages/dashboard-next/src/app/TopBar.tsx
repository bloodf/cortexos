import { Link, useRouterState } from "@tanstack/react-router";
import {
  Bell,
  Check,
  Menu,
  Moon,
  PanelLeftClose,
  PanelLeftOpen,
  Search,
  Sun,
  Monitor,
  Palette,
  LogOut,
  ChevronRight,
  User as UserIcon,
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
} from "@/components/ui/dropdown-menu";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useUI } from "@/hooks/useUI";
import { ACCENTS } from "@/hooks/accents";
import { useAuth } from "@/hooks/useAuth";
import { useT } from "@/hooks/useT";
import { api } from "@/mocks/api";
import { NAV } from "./NavConfig";
import { LOCALES, LOCALE_LABEL } from "@/i18n";
import { relativeTime } from "@/lib/format";
import { cn } from "@/lib/utils";

interface Props {
  collapsed: boolean;
  onToggleCollapse: () => void;
  onOpenMobile: () => void;
  onOpenPalette: () => void;
  onOpenHelp?: () => void;
}

function breadcrumbs(path: string, t: ReturnType<typeof useT>): { label: string; to?: string }[] {
  const parts = path.split("/").filter(Boolean);
  if (parts.length === 0) return [{ label: t.nav.overview }];
  // try to find matching nav label
  const all = NAV.flatMap((g) => g.items);
  const out: { label: string; to?: string }[] = [];
  for (let i = 0; i < parts.length; i++) {
    const p = `/${parts.slice(0, i + 1).join("/")}`;
    const nav = all.find((n) => n.to === p);
    if (nav) out.push({ label: t.nav[nav.key], to: i < parts.length - 1 ? p : undefined });
    else out.push({ label: parts[i].replace(/-/g, " ").replace(/^./, (c) => c.toUpperCase()) });
  }
  return out;
}

export function TopBar({
  collapsed,
  onToggleCollapse,
  onOpenMobile,
  onOpenPalette,
  onOpenHelp,
}: Props) {
  const { theme, setTheme, accent, setAccent, locale, setLocale } = useUI();
  const { user, logout } = useAuth();
  const t = useT();
  const path = useRouterState({ select: (s) => s.location.pathname });

  const crumbs = breadcrumbs(path, t);

  const { data: notifs = [] } = useQuery({
    queryKey: ["notifications"],
    queryFn: api.notifications,
  });
  const unread = notifs.filter((n) => !n.read).length;

  return (
    <header className="sticky top-0 z-30 h-14 bg-background/80 backdrop-blur border-b flex items-center gap-2 px-3 sm:px-5">
      <Button
        variant="ghost"
        size="icon"
        className="md:hidden"
        onClick={onOpenMobile}
        aria-label="Menu"
      >
        <Menu className="size-4" />
      </Button>
      <Button
        variant="ghost"
        size="icon"
        className="hidden md:inline-flex"
        onClick={onToggleCollapse}
        aria-label="Toggle sidebar"
      >
        {collapsed ? <PanelLeftOpen className="size-4" /> : <PanelLeftClose className="size-4" />}
      </Button>

      <nav className="hidden md:flex items-center text-sm text-muted-foreground min-w-0">
        {crumbs.map((c, i) => (
          <span key={i} className="flex items-center min-w-0">
            {i > 0 && <ChevronRight className="size-3 mx-1 opacity-50" />}
            {c.to ? (
              <Link to={c.to} className="hover:text-foreground truncate">
                {c.label}
              </Link>
            ) : (
              <span className="text-foreground font-medium truncate">{c.label}</span>
            )}
          </span>
        ))}
      </nav>

      <div className="flex-1" />

      <button
        onClick={onOpenPalette}
        className="hidden sm:flex items-center gap-2 rounded-md border bg-muted/40 px-3 h-9 text-sm text-muted-foreground hover:bg-muted/70 transition-colors min-w-[200px] lg:min-w-[280px]"
      >
        <Search className="size-4" />
        <span className="flex-1 text-left">{t.common.search}</span>
        <kbd className="hidden lg:inline-flex items-center gap-1 rounded border bg-background px-1.5 py-0.5 text-[10px] font-mono">
          ⌘K
        </kbd>
      </button>

      <Button
        variant="ghost"
        size="icon"
        className="sm:hidden"
        onClick={onOpenPalette}
        aria-label="Search"
      >
        <Search className="size-4" />
      </Button>
      {onOpenHelp && (
        <Button
          variant="ghost"
          size="icon"
          onClick={onOpenHelp}
          aria-label="Keyboard shortcuts"
          className="hidden md:inline-flex"
        >
          <kbd className="text-[11px] font-mono">?</kbd>
        </Button>
      )}

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" aria-label="Theme">
            {theme === "dark" ? (
              <Moon className="size-4" />
            ) : theme === "light" ? (
              <Sun className="size-4" />
            ) : (
              <Monitor className="size-4" />
            )}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-40">
          <DropdownMenuLabel>Theme</DropdownMenuLabel>
          <DropdownMenuRadioGroup
            value={theme}
            onValueChange={(v) => setTheme(v as Parameters<typeof setTheme>[0])}
          >
            <DropdownMenuRadioItem value="light">
              <Sun className="size-3.5 mr-2" />
              Light
            </DropdownMenuRadioItem>
            <DropdownMenuRadioItem value="dark">
              <Moon className="size-3.5 mr-2" />
              Dark
            </DropdownMenuRadioItem>
            <DropdownMenuRadioItem value="system">
              <Monitor className="size-3.5 mr-2" />
              System
            </DropdownMenuRadioItem>
          </DropdownMenuRadioGroup>
        </DropdownMenuContent>
      </DropdownMenu>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" aria-label="Accent">
            <Palette className="size-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-40">
          <DropdownMenuLabel>Accent</DropdownMenuLabel>
          {ACCENTS.map((a) => (
            <DropdownMenuItem key={a.id} onClick={() => setAccent(a.id)} className="gap-2">
              <span className="size-3 rounded-full" style={{ background: a.color }} />
              <span className="flex-1">{a.label}</span>
              {accent === a.id && <Check className="size-3.5" />}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>

      <Popover>
        <PopoverTrigger asChild>
          <Button variant="ghost" size="icon" className="relative" aria-label="Notifications">
            <Bell className="size-4" />
            {unread > 0 && (
              <span className="absolute top-1.5 right-1.5 size-2 rounded-full bg-[var(--destructive)]" />
            )}
          </Button>
        </PopoverTrigger>
        <PopoverContent align="end" className="w-80 p-0">
          <div className="px-3 py-2 border-b flex items-center justify-between">
            <span className="text-sm font-medium">Notifications</span>
            <span className="text-xs text-muted-foreground">{unread} unread</span>
          </div>
          <ul className="max-h-80 overflow-y-auto divide-y">
            {notifs.map((n) => (
              <li key={n.id} className="px-3 py-2.5 hover:bg-muted/40">
                <div className="flex items-start gap-2">
                  <span
                    className={cn(
                      "size-1.5 rounded-full mt-1.5 shrink-0",
                      n.severity === "error"
                        ? "bg-[var(--destructive)]"
                        : n.severity === "warn"
                          ? "bg-[var(--warning)]"
                          : "bg-[var(--primary)]",
                    )}
                  />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium truncate">{n.title}</p>
                    <p className="text-xs text-muted-foreground truncate">{n.body}</p>
                    <p className="text-[10px] text-muted-foreground mt-0.5">
                      {relativeTime(n.timestamp)}
                    </p>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </PopoverContent>
      </Popover>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            className="flex items-center gap-2 rounded-md hover:bg-muted px-1.5 py-1 transition-colors"
            aria-label="Account"
          >
            <div className="size-7 grid place-items-center rounded-full bg-primary text-primary-foreground text-xs font-semibold">
              {user?.username.slice(0, 2).toUpperCase() ?? "?"}
            </div>
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56">
          <DropdownMenuLabel className="flex items-center gap-2">
            <UserIcon className="size-4" />
            <div>
              <p className="text-sm font-medium">{user?.username}</p>
              <p className="text-xs font-normal text-muted-foreground">
                {user?.is_admin ? "Administrator" : "User"}
              </p>
            </div>
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuLabel className="text-xs font-normal text-muted-foreground">
            Language
          </DropdownMenuLabel>
          {LOCALES.map((l) => (
            <DropdownMenuItem key={l} onClick={() => setLocale(l)} className="gap-2">
              {locale === l ? <Check className="size-3.5" /> : <span className="size-3.5" />}
              {LOCALE_LABEL[l]}
            </DropdownMenuItem>
          ))}
          <DropdownMenuSeparator />
          <DropdownMenuItem
            onClick={() => {
              void logout().finally(() => {
                window.location.href = "/login";
              });
            }}
            className="gap-2 text-destructive focus:text-destructive"
          >
            <LogOut className="size-3.5" />
            {t.auth.logout}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </header>
  );
}
