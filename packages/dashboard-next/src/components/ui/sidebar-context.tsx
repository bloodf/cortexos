import * as React from "react";

interface SidebarContextProps {
  state: "expanded" | "collapsed";
  open: boolean;
  setOpen: (open: boolean) => void;
  openMobile: boolean;
  setOpenMobile: (open: boolean) => void;
  isMobile: boolean;
  toggleSidebar: () => void;
}

// Direct `const` export so the rule's `createContext` branch (which pushes to
// `reactContextExports` and returns early) recognizes this as a context rather
// than a component export. Combined with a lowercase hook export, the file
// has no component exports and the only-export-components rule does not fire.
export const SidebarContext = React.createContext<SidebarContextProps | null>(null);

export function useSidebar() {
  const context = React.useContext(SidebarContext);
  if (!context) {
    throw new Error("useSidebar must be used within a SidebarProvider.");
  }

  return context;
}

export type { SidebarContextProps };
