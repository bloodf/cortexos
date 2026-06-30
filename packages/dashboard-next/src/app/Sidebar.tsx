import { useRouterState } from "@tanstack/react-router";
import { LayoutGrid, Server, ScrollText, Settings2 } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useEffect, useState } from "react";
import brandMark from "@/assets/cortexos-mark.svg";
import {
  SideNav,
  SideNavItem,
  SideNavSection,
  SideNavHeading,
  type SideNavImperativeCollapseHandle,
} from "@astryxdesign/core/SideNav";
import { Avatar } from "@astryxdesign/core/Avatar";
import { NAV, PINNED, type GroupId } from "./NavConfig";
import { useT } from "@/hooks/useT";
import { useAuth } from "@/hooks/useAuth";

interface Props {
  collapsed: boolean;
  mobileOpen: boolean;
  onClose: () => void;
  onCollapsedChange?: (collapsed: boolean) => void;
  collapseHandleRef?: React.RefObject<SideNavImperativeCollapseHandle | null>;
}

const GROUP_ICONS: Record<GroupId, LucideIcon> = {
  platform: LayoutGrid,
  infra: Server,
  secOps: ScrollText,
  admin: Settings2,
};

const STORAGE_KEY = "cortex.nav.openGroups";

export function Sidebar({
  collapsed,
  mobileOpen,
  onClose,
  onCollapsedChange,
  collapseHandleRef,
}: Props) {
  const t = useT();
  const { user } = useAuth();
  const path = useRouterState({ select: (s) => s.location.pathname });

  // Exactly one nav item is active: the one whose `to` is the LONGEST prefix of
  // the current path. So /incus/$name lights only "Incus" (not a shorter prefix),
  // and /agents/$slug/chat lights "Agents".
  const activeTo =
    [PINNED.to, ...NAV.flatMap((g) => g.items.map((it) => it.to))]
      .filter((to) => path === to || path.startsWith(`${to}/`))
      .sort((a, b) => b.length - a.length)[0] ?? null;

  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({
    platform: true,
    infra: true,
    secOps: true,
    admin: false,
  });

  // Hydrate from localStorage after mount to avoid SSR mismatch
  useEffect(() => {
    try {
      const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) || "null");
      if (stored && typeof stored === "object") setOpenGroups((prev) => ({ ...prev, ...stored }));
    } catch {
      /* noop */
    }
  }, []);

  useEffect(() => {
    // Auto-expand the group containing the active route
    setOpenGroups((prev) => {
      const next = { ...prev };
      NAV.forEach((g) => {
        if (g.items.some((it) => path.startsWith(it.to))) next[g.id] = true;
      });
      return next;
    });
  }, [path]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(openGroups));
    } catch {
      /* noop */
    }
  }, [openGroups]);

  // Admin-only groups are hidden for non-admin users (role from real PAM groups).
  const visibleNav = NAV.filter((g) => !g.adminOnly || user?.is_admin);

  const groupTitle: Record<GroupId, string> = {
    platform: t.nav.platform,
    infra: t.nav.infra,
    secOps: t.nav.secOps,
    admin: t.nav.admin,
  };

  return (
    <SideNav
      collapsible={{
        isCollapsed: collapsed,
        onCollapsedChange,
      }}
      handleRef={collapseHandleRef}
      header={
        <SideNavHeading
          icon={<img src={brandMark} alt="" className="size-7" />}
          heading={t.app.name}
          headingHref="/overview"
        />
      }
      footer={
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-xs">
            <span
              className="size-2 rounded-full animate-pulse"
              style={{ backgroundColor: "var(--color-success)" }}
            />
            {!collapsed && (
              <span className="text-[var(--color-text-secondary)]">{t.live.connected}</span>
            )}
          </div>
          {!collapsed && user && (
            <div
              className="flex items-center gap-2 rounded-md px-2 py-1.5"
              style={{ backgroundColor: "var(--color-neutral)" }}
            >
              <Avatar name={user.username} size={32} />
              <div className="min-w-0">
                <p className="text-xs font-medium truncate text-[var(--color-text-primary)]">
                  {user.username}
                </p>
                <p className="text-[10px] text-[var(--color-text-secondary)]">
                  {user.is_admin ? "Admin" : "User"}
                </p>
              </div>
            </div>
          )}
        </div>
      }
    >
      <SideNavSection title={t.nav.overview} isHeaderHidden>
        <SideNavItem
          label={t.nav[PINNED.key]}
          icon={<PINNED.icon className="size-4" />}
          href={PINNED.to}
          isSelected={path === PINNED.to}
        />
      </SideNavSection>

      {visibleNav.map((group) => {
        const Icon = GROUP_ICONS[group.id];
        return (
          <SideNavItem
            key={group.id}
            label={groupTitle[group.id]}
            icon={<Icon className="size-4" />}
            collapsible={{
              isCollapsed: !openGroups[group.id],
              onCollapsedChange: (v) => setOpenGroups((prev) => ({ ...prev, [group.id]: !v })),
            }}
          >
            {group.items.map((it) => (
              <SideNavItem
                key={it.to}
                label={t.nav[it.key]}
                icon={<it.icon className="size-4" />}
                href={it.to}
                isSelected={it.to === activeTo}
              />
            ))}
          </SideNavItem>
        );
      })}
    </SideNav>
  );
}
