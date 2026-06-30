import type { ReactNode } from "react";
import { useRef, useState } from "react";
import { useRouterState } from "@tanstack/react-router";
import { AppShell as AstryxAppShell } from "@astryxdesign/core/AppShell";
import type { SideNavImperativeCollapseHandle } from "@astryxdesign/core/SideNav";
import { Sidebar } from "./Sidebar";
import { TopBar } from "./TopBar";
import { MobileTabBar } from "./MobileTabBar";
import { CommandPalette } from "./CommandPalette";
import { KeyboardShortcuts } from "@/components/KeyboardShortcuts";
import { DemoTour } from "@/components/DemoTour";
import { IncidentToaster } from "@/components/IncidentToaster";
import { useKeyboardShortcuts } from "@/hooks/useKeyboardShortcuts";

export function AppShell({ children }: { children: ReactNode }) {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const sideNavHandleRef = useRef<SideNavImperativeCollapseHandle>(null);
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  useKeyboardShortcuts({
    onHelp: () => setHelpOpen(true),
    onToggleSidebar: () => setCollapsed((c) => !c),
    onPalette: () => setPaletteOpen(true),
  });

  return (
    <>
      <AstryxAppShell
        variant="section"
        height="fill"
        contentPadding={0}
        topNav={
          <TopBar
            collapsed={collapsed}
            onToggleCollapse={() => setCollapsed((c) => !c)}
            onOpenMobile={() => setMobileOpen(true)}
            onOpenPalette={() => setPaletteOpen(true)}
            onOpenHelp={() => setHelpOpen(true)}
            collapseHandleRef={sideNavHandleRef}
          />
        }
        sideNav={
          <Sidebar
            collapsed={collapsed}
            mobileOpen={mobileOpen}
            onClose={() => setMobileOpen(false)}
            onCollapsedChange={setCollapsed}
            collapseHandleRef={sideNavHandleRef}
          />
        }
        mobileNav={{
          isOpen: mobileOpen,
          onOpenChange: setMobileOpen,
          breakpoint: "md",
          hasToggle: false,
        }}
      >
        <div
          key={pathname}
          className="px-4 sm:px-6 lg:px-8 py-5 pb-20 md:pb-0 max-w-[1600px] mx-auto w-full animate-in fade-in slide-in-from-bottom-1 duration-200 motion-reduce:animate-none"
        >
          {children}
        </div>
      </AstryxAppShell>
      <CommandPalette
        open={paletteOpen}
        onOpenChange={setPaletteOpen}
        onOpenHelp={() => setHelpOpen(true)}
      />
      <KeyboardShortcuts open={helpOpen} onOpenChange={setHelpOpen} />
      <DemoTour />
      <IncidentToaster />
    </>
  );
}
