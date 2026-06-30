import { Link, useRouterState } from "@tanstack/react-router";
import {
  Bell,
  Check,
  Menu,
  Moon,
  Search,
  Sun,
  Monitor,
  Palette,
  LogOut,
  ChevronRight,
} from "lucide-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { TopNav, TopNavHeading } from "@astryxdesign/core/TopNav";
import { Button } from "@astryxdesign/core/Button";
import { IconButton } from "@astryxdesign/core/IconButton";
import { DropdownMenu, DropdownMenuItem } from "@astryxdesign/core/DropdownMenu";
import { Popover } from "@astryxdesign/core/Popover";
import { Avatar } from "@astryxdesign/core/Avatar";
import { EmptyState } from "@astryxdesign/core/EmptyState";
import { SideNavCollapseButton } from "@astryxdesign/core/SideNav";
import { useAppShellMobile } from "@astryxdesign/core/AppShell";
import type { SideNavImperativeCollapseHandle } from "@astryxdesign/core/SideNav";
import { useUI } from "@/hooks/useUI";
import { ACCENTS } from "@/hooks/accents";
import { useAuth } from "@/hooks/useAuth";
import { useT } from "@/hooks/useT";
import { api, callMarkNotificationsRead } from "@/lib/api/client";
import type { DashNotification } from "@/lib/api/client";
import { csrfHeaders } from "@/lib/csrf";
import { NAV } from "./NavConfig";
import { relativeTime } from "@/lib/format";
import brandMark from "@/assets/cortexos-mark.svg";

function ThemeIcon({ theme }: { theme: string }) {
  if (theme === "dark") return <Moon className="size-4" />;
  if (theme === "light") return <Sun className="size-4" />;
  return <Monitor className="size-4" />;
}

function severityColor(severity: string): string {
  if (severity === "error") return "var(--color-error)";
  if (severity === "warn") return "var(--color-warning)";
  return "var(--color-accent)";
}

interface Props {
  collapsed: boolean;
  onToggleCollapse: () => void;
  onOpenMobile: () => void;
  onOpenPalette: () => void;
  onOpenHelp?: () => void;
  collapseHandleRef?: React.RefObject<SideNavImperativeCollapseHandle | null>;
}

function breadcrumbs(path: string, t: ReturnType<typeof useT>): { label: string; to?: string }[] {
  const parts = path.split("/").filter(Boolean);
  if (parts.length === 0) return [{ label: t.nav.overview }];
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

function NotificationsPanel({
  notifs,
  unread,
  onMarkAllRead,
}: {
  notifs: DashNotification[];
  unread: number;
  onMarkAllRead: () => Promise<void>;
}) {
  return (
    <div className="w-full">
      <div
        className="px-3 py-2 border-b flex items-center justify-between"
        style={{ borderColor: "var(--color-border)" }}
      >
        <span className="text-sm font-medium text-[var(--color-text-primary)]">Notifications</span>
        {unread > 0 ? (
          <button
            type="button"
            onClick={() => onMarkAllRead().catch(() => {})}
            className="text-xs inline-flex items-center gap-1 text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]"
          >
            <Check className="size-3" />
            Mark all read
          </button>
        ) : (
          <span className="text-xs text-[var(--color-text-secondary)]">{unread} unread</span>
        )}
      </div>
      {notifs.length === 0 ? (
        <EmptyState
          icon={<Bell className="size-5" />}
          title="No notifications"
          description="You're all caught up."
          isCompact
        />
      ) : (
        <ul
          className="max-h-80 overflow-y-auto divide-y"
          style={{ borderColor: "var(--color-border)" }}
        >
          {notifs.map((n) => (
            <li key={n.id} className="px-3 py-2.5 hover:bg-[var(--color-overlay-hover)]">
              <div className="flex items-start gap-2">
                <span
                  className="size-1.5 rounded-full mt-1.5 shrink-0"
                  style={{ backgroundColor: severityColor(n.severity) }}
                />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium truncate text-[var(--color-text-primary)]">
                    {n.title}
                  </p>
                  <p className="text-xs truncate text-[var(--color-text-secondary)]">{n.body}</p>
                  <p className="text-[10px] text-[var(--color-text-secondary)] mt-0.5">
                    {relativeTime(n.timestamp)}
                  </p>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function TopBar({
  collapsed,
  onToggleCollapse,
  onOpenMobile,
  onOpenPalette,
  onOpenHelp,
  collapseHandleRef,
}: Props) {
  const { theme, setTheme, accent, setAccent } = useUI();
  const { user, logout } = useAuth();
  const t = useT();
  const path = useRouterState({ select: (s) => s.location.pathname });
  const { isMobile } = useAppShellMobile();

  const crumbs = breadcrumbs(path, t);

  const qc = useQueryClient();
  const { data: notifs = [] } = useQuery<DashNotification[]>({
    queryKey: ["notifications"],
    queryFn: api.notifications,
  });
  const unread = notifs.filter((n) => !n.read).length;

  const markAllRead = async (): Promise<void> => {
    try {
      const res = await callMarkNotificationsRead({ data: {}, headers: csrfHeaders() });
      if (res.acknowledged > 0) {
        toast.success(
          `Marked ${res.acknowledged} notification${res.acknowledged === 1 ? "" : "s"} read`,
        );
      }
      qc.invalidateQueries({ queryKey: ["notifications"] }).catch(() => {});
    } catch {
      toast.error("Failed to mark notifications read");
    }
  };

  return (
    <TopNav
      label="Main navigation"
      heading={
        isMobile ? (
          <TopNavHeading
            logo={<img src={brandMark} alt="" className="size-7" />}
            heading={t.app.name}
            headingHref="/overview"
          />
        ) : undefined
      }
      startContent={
        isMobile ? undefined : (
          <nav className="hidden md:flex items-center text-sm min-w-0 text-[var(--color-text-secondary)]">
            {crumbs.map((c, i) => (
              <span key={i} className="flex items-center min-w-0">
                {i > 0 && <ChevronRight className="size-3 mx-1 opacity-50" />}
                {c.to ? (
                  <Link to={c.to} className="hover:text-[var(--color-text-primary)] truncate">
                    {c.label}
                  </Link>
                ) : (
                  <span className="font-medium truncate text-[var(--color-text-primary)]">
                    {c.label}
                  </span>
                )}
              </span>
            ))}
          </nav>
        )
      }
      endContent={
        <div className="flex items-center gap-1">
          <div className="md:hidden">
            <IconButton
              label="Menu"
              icon={<Menu className="size-4" />}
              variant="ghost"
              onClick={onOpenMobile}
            />
          </div>

          <div className="hidden sm:flex">
            <Button
              label="Search"
              icon={<Search className="size-4" />}
              variant="ghost"
              className="h-8 min-w-[200px] lg:min-w-[280px]"
              style={{
                justifyContent: "flex-start",
                border: "1px solid var(--color-border)",
                backgroundColor: "var(--color-background-muted)",
              }}
              onClick={onOpenPalette}
            >
              <span className="flex-1 text-left">{t.common.search}</span>
              <kbd
                className="hidden lg:inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-mono"
                style={{
                  border: "1px solid var(--color-border)",
                  backgroundColor: "var(--color-background-surface)",
                }}
              >
                ⌘K
              </kbd>
            </Button>
          </div>
          <div className="sm:hidden">
            <IconButton
              label="Search"
              icon={<Search className="size-4" />}
              variant="ghost"
              onClick={onOpenPalette}
            />
          </div>

          {onOpenHelp && (
            <div className="hidden md:flex">
              <IconButton
                label="Keyboard shortcuts"
                icon={<kbd className="text-[11px] font-mono">?</kbd>}
                variant="ghost"
                onClick={onOpenHelp}
              />
            </div>
          )}

          <DropdownMenu
            button={{
              label: "Theme",
              icon: <ThemeIcon theme={theme} />,
              variant: "ghost",
              isIconOnly: true,
            }}
          >
            <DropdownMenuItem
              label="Light"
              icon={<Sun className="size-4" />}
              endContent={theme === "light" ? <Check className="size-3.5" /> : undefined}
              onClick={() => setTheme("light")}
            />
            <DropdownMenuItem
              label="Dark"
              icon={<Moon className="size-4" />}
              endContent={theme === "dark" ? <Check className="size-3.5" /> : undefined}
              onClick={() => setTheme("dark")}
            />
            <DropdownMenuItem
              label="System"
              icon={<Monitor className="size-4" />}
              endContent={theme === "system" ? <Check className="size-3.5" /> : undefined}
              onClick={() => setTheme("system")}
            />
          </DropdownMenu>

          <DropdownMenu
            button={{
              label: "Accent",
              icon: <Palette className="size-4" />,
              variant: "ghost",
              isIconOnly: true,
            }}
          >
            {ACCENTS.map((a) => (
              <DropdownMenuItem
                key={a.id}
                label={a.label}
                icon={<span className="size-3 rounded-full" style={{ background: a.color }} />}
                endContent={accent === a.id ? <Check className="size-3.5" /> : undefined}
                onClick={() => setAccent(a.id)}
              />
            ))}
          </DropdownMenu>

          <Popover
            content={
              <NotificationsPanel notifs={notifs} unread={unread} onMarkAllRead={markAllRead} />
            }
            placement="below"
            alignment="end"
            width={320}
            label="Notifications"
            hasAutoFocus={false}
          >
            <div className="relative">
              <IconButton
                label="Notifications"
                icon={<Bell className="size-4" />}
                variant="ghost"
              />
              {unread > 0 && (
                <span
                  className="absolute top-1.5 right-1.5 size-2 rounded-full"
                  style={{ backgroundColor: "var(--color-error)" }}
                />
              )}
            </div>
          </Popover>

          <Popover
            content={
              <div className="w-full p-2">
                <div className="flex items-center gap-2 px-2 py-1.5">
                  <Avatar name={user?.username ?? "?"} size={32} />
                  <div>
                    <p className="text-sm font-medium text-[var(--color-text-primary)]">
                      {user?.username}
                    </p>
                    <p className="text-xs text-[var(--color-text-secondary)]">
                      {user?.is_admin ? "Administrator" : "User"}
                    </p>
                  </div>
                </div>
                <div className="border-t my-1" style={{ borderColor: "var(--color-border)" }} />
                <Button
                  label={t.auth.logout}
                  icon={<LogOut className="size-4" />}
                  variant="ghost"
                  className="w-full justify-start"
                  style={{ color: "var(--color-error)" }}
                  onClick={() => {
                    logout()
                      .finally(() => {
                        window.location.href = "/login";
                      })
                      .catch(() => {});
                  }}
                />
              </div>
            }
            placement="below"
            alignment="end"
            width={224}
            label="Account"
            hasAutoFocus={false}
          >
            <button
              className="flex items-center rounded-md hover:bg-[var(--color-overlay-hover)] px-1.5 py-1 transition-colors"
              aria-label="Account"
            >
              <Avatar name={user?.username ?? "?"} size={32} />
            </button>
          </Popover>

          <div className="hidden md:flex">
            <SideNavCollapseButton handleRef={collapseHandleRef} />
          </div>
        </div>
      }
    />
  );
}
