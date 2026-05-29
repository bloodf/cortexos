"use client"

import * as React from "react"
import { cn } from "@/lib/utils"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"

// ─── Context ────────────────────────────────────────────────────────────────

interface SidebarContextValue {
  open: boolean
  setOpen: (open: boolean) => void
  isMobile: boolean
}

const SidebarContext = React.createContext<SidebarContextValue>({
  open: true,
  setOpen: () => {},
  isMobile: false,
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

  React.useEffect(() => {
    const mq = window.matchMedia("(max-width: 767px)")
    const handler = (e: MediaQueryListEvent) => setIsMobile(e.matches)
    mq.addEventListener("change", handler)
    return () => mq.removeEventListener("change", handler)
  }, [])

  const open = controlledOpen ?? internalOpen
  const setOpen = (value: boolean) => {
    setInternalOpen(value)
    onOpenChange?.(value)
  }

  return (
    <SidebarContext.Provider value={{ open, setOpen, isMobile }}>
      <div
        data-slot="sidebar-provider"
        data-state={open ? "expanded" : "collapsed"}
        className={cn("flex h-svh w-full overflow-hidden", className)}
      >
        {children}
      </div>
    </SidebarContext.Provider>
  )
}

// ─── Sidebar ─────────────────────────────────────────────────────────────────

interface SidebarProps extends React.ComponentProps<"aside"> {
  /** Mobile drawer title (accessibility) */
  mobileTitle?: string
  collapsible?: boolean
  width?: string
  collapsedWidth?: string
}

function Sidebar({
  className,
  children,
  mobileTitle = "Navigation",
  width = "240px",
  collapsedWidth = "0px",
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
        "relative flex h-svh flex-col overflow-hidden border-r border-border bg-sidebar transition-[width] duration-200 ease-in-out",
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
  return (
    <div
      data-slot="sidebar-header"
      className={cn("flex flex-col gap-2 p-3", className)}
      {...props}
    />
  )
}

function SidebarContent({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="sidebar-content"
      className={cn("flex flex-1 flex-col gap-1 overflow-y-auto p-2", className)}
      {...props}
    />
  )
}

function SidebarFooter({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="sidebar-footer"
      className={cn("flex flex-col gap-2 p-3", className)}
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
      aria-label={open ? "Collapse sidebar" : "Expand sidebar"}
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
      className={cn("flex flex-col gap-0.5", className)}
      {...props}
    />
  )
}

function SidebarGroupLabel({ className, ...props }: React.ComponentProps<"span">) {
  return (
    <span
      data-slot="sidebar-group-label"
      className={cn(
        "px-2 py-1 text-xs font-medium text-muted-foreground uppercase tracking-wider",
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
        "flex items-center gap-2 rounded-md px-2 py-1.5 text-sm text-foreground transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50",
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
