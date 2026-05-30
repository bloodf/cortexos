"use client"

import * as React from "react"
import { cn } from "@/lib/utils"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { TooltipProvider } from "@/components/ui/tooltip"

// ─── Persistence ──────────────────────────────────────────────────────────────

/** Cookie that persists the desktop expanded/rail state across reloads + SSR. */
export const SIDEBAR_COOKIE = "cortex-sidebar"
const SIDEBAR_COOKIE_MAX_AGE = 60 * 60 * 24 * 365 // 1 year

function writeSidebarCookie(open: boolean) {
  if (typeof document === "undefined") return
  document.cookie = `${SIDEBAR_COOKIE}=${open ? "expanded" : "collapsed"}; path=/; max-age=${SIDEBAR_COOKIE_MAX_AGE}; SameSite=Lax`
}

function readSidebarCookie(): boolean | undefined {
  if (typeof document === "undefined") return undefined
  const match = document.cookie
    .split("; ")
    .find((row) => row.startsWith(`${SIDEBAR_COOKIE}=`))
  if (!match) return undefined
  const value = match.split("=")[1]
  if (value === "expanded") return true
  if (value === "collapsed") return false
  return undefined
}

// ─── Context ────────────────────────────────────────────────────────────────

interface SidebarContextValue {
  /** Desktop: expanded vs icon-rail. Mobile: drawer open vs closed. */
  open: boolean
  setOpen: (open: boolean) => void
  isMobile: boolean
  /** True when the desktop sidebar is in its narrow icon-rail state. */
  isRail: boolean
}

const SidebarContext = React.createContext<SidebarContextValue>({
  open: true,
  setOpen: () => {},
  isMobile: false,
  isRail: false,
})

function useSidebar() {
  return React.useContext(SidebarContext)
}

// ─── Provider ────────────────────────────────────────────────────────────────

interface SidebarProviderProps {
  defaultOpen?: boolean
  open?: boolean
  onOpenChange?: (open: boolean) => void
  children: React.ReactNode
  className?: string
}

function SidebarProvider({
  defaultOpen = true,
  open: controlledOpen,
  onOpenChange,
  children,
  className,
}: SidebarProviderProps) {
  const [internalOpen, setInternalOpen] = React.useState(defaultOpen)
  const [isMobile, setIsMobile] = React.useState<boolean>(() => {
    if (typeof window === "undefined") return false
    return window.matchMedia("(max-width: 767px)").matches
  })

  // Reconcile from the persisted cookie on mount (no SSR flash on the common
  // default-open path; corrects to the stored value client-side).
  React.useEffect(() => {
    const stored = readSidebarCookie()
    if (stored !== undefined && controlledOpen === undefined) {
      setInternalOpen(stored)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  React.useEffect(() => {
    const mq = window.matchMedia("(max-width: 767px)")
    const handler = (e: MediaQueryListEvent) => setIsMobile(e.matches)
    mq.addEventListener("change", handler)
    return () => mq.removeEventListener("change", handler)
  }, [])

  const open = controlledOpen ?? internalOpen
  const setOpen = React.useCallback(
    (value: boolean) => {
      setInternalOpen(value)
      // Only the desktop state is meaningful to persist; mobile toggles the
      // Sheet and shares the same flag, so guard on viewport.
      if (typeof window !== "undefined" && !window.matchMedia("(max-width: 767px)").matches) {
        writeSidebarCookie(value)
      }
      onOpenChange?.(value)
    },
    [onOpenChange],
  )

  const isRail = !isMobile && !open

  return (
    <SidebarContext.Provider value={{ open, setOpen, isMobile, isRail }}>
      <TooltipProvider delay={150}>
        <div
          data-slot="sidebar-provider"
          data-state={open ? "expanded" : "collapsed"}
          className={cn("flex h-svh w-full overflow-hidden", className)}
        >
          {children}
        </div>
      </TooltipProvider>
    </SidebarContext.Provider>
  )
}

// ─── Sidebar ─────────────────────────────────────────────────────────────────

interface SidebarProps extends React.ComponentProps<"aside"> {
  /** Mobile drawer title (accessibility) */
  mobileTitle?: string
  collapsible?: boolean
  width?: string
  /** Width of the desktop icon rail when collapsed. */
  collapsedWidth?: string
}

function Sidebar({
  className,
  children,
  mobileTitle = "Navigation",
  width = "240px",
  collapsedWidth = "56px",
  ...props
}: SidebarProps) {
  const { open, setOpen, isMobile } = useSidebar()

  if (isMobile) {
    return (
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="left" className="w-[240px] p-0">
          <SheetHeader className="sr-only">
            <SheetTitle>{mobileTitle}</SheetTitle>
          </SheetHeader>
          <aside
            data-slot="sidebar"
            className={cn("flex h-full flex-col", className)}
            {...props}
          >
            {children}
          </aside>
        </SheetContent>
      </Sheet>
    )
  }

  return (
    <aside
      data-slot="sidebar"
      data-state={open ? "expanded" : "collapsed"}
      style={{
        "--sidebar-width": width,
        "--sidebar-collapsed-width": collapsedWidth,
      } as React.CSSProperties}
      className={cn(
        "relative flex h-svh flex-col overflow-hidden border-r border-sidebar-border bg-sidebar text-sidebar-foreground transition-[width] duration-200 ease-in-out",
        open ? "w-[var(--sidebar-width)]" : "w-[var(--sidebar-collapsed-width)]",
        className
      )}
      {...props}
    >
      {children}
    </aside>
  )
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function SidebarHeader({ className, ...props }: React.ComponentProps<"div">) {
  const { isRail } = useSidebar()
  return (
    <div
      data-slot="sidebar-header"
      className={cn(
        "flex flex-col gap-2 p-3 transition-all",
        isRail && "items-center px-0",
        className
      )}
      {...props}
    />
  )
}

function SidebarContent({ className, ...props }: React.ComponentProps<"div">) {
  const { isRail } = useSidebar()
  return (
    <div
      data-slot="sidebar-content"
      className={cn(
        "flex flex-1 flex-col gap-1 overflow-y-auto overflow-x-hidden p-2",
        isRail && "items-center",
        className
      )}
      {...props}
    />
  )
}

function SidebarFooter({ className, ...props }: React.ComponentProps<"div">) {
  const { isRail } = useSidebar()
  return (
    <div
      data-slot="sidebar-footer"
      className={cn(
        "flex flex-col gap-2 border-t border-sidebar-border p-3",
        isRail && "items-center px-0",
        className
      )}
      {...props}
    />
  )
}

function SidebarTrigger({
  className,
  onClick,
  children,
  ...props
}: React.ComponentProps<"button">) {
  const { open, setOpen } = useSidebar()
  return (
    <button
      data-slot="sidebar-trigger"
      aria-label={open ? "Collapse sidebar to icon rail" : "Expand sidebar"}
      aria-expanded={open}
      onClick={(e) => {
        setOpen(!open)
        onClick?.(e)
      }}
      className={cn(
        "inline-flex size-8 items-center justify-center rounded-lg border border-transparent text-sm transition-all hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50",
        className
      )}
      {...props}
    >
      {children ?? (
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <rect width="18" height="18" x="3" y="3" rx="2" />
          <path d="M9 3v18" />
        </svg>
      )}
    </button>
  )
}

function SidebarGroup({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="sidebar-group"
      className={cn("flex w-full flex-col gap-0.5", className)}
      {...props}
    />
  )
}

function SidebarGroupLabel({ className, ...props }: React.ComponentProps<"span">) {
  return (
    <span
      data-slot="sidebar-group-label"
      className={cn(
        "px-2 py-1 text-xs font-medium uppercase tracking-wider text-sidebar-foreground/60",
        className
      )}
      {...props}
    />
  )
}

function SidebarMenuItem({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="sidebar-menu-item"
      className={cn(
        "flex items-center gap-2 rounded-md px-2 py-1.5 text-sm text-sidebar-foreground transition-colors hover:bg-sidebar-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring",
        className
      )}
      {...props}
    />
  )
}

export {
  SidebarProvider,
  Sidebar,
  SidebarHeader,
  SidebarContent,
  SidebarFooter,
  SidebarTrigger,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarMenuItem,
  useSidebar,
}
