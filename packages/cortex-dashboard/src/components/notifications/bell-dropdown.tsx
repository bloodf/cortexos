"use client"

import * as React from "react"
import useSWR, { mutate } from "swr"
import { BellIcon } from "lucide-react"
import Link from "next/link"
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
} from "@/components/ui/dropdown-menu"
import { IconButton } from "@/components/ui/icon-button"
import { EmptyState } from "@/components/ui/empty-state"
import { cn } from "@/lib/utils"

interface Alert {
  id: string
  title: string
  message: string
  severity: "info" | "warning" | "critical"
  created_at: string
  read_at: string | null
}

const ALERTS_URL = "/api/alerts/operational?unacknowledged=1&limit=10"

const fetcher = (url: string) =>
  fetch(url).then(async (r) => {
    if (!r.ok) throw new Error("Failed to fetch alerts")
    const data = await r.json()
    return Array.isArray(data?.alerts) ? data.alerts : []
  })

const severityClass: Record<Alert["severity"], string> = {
  info: "bg-blue-500/10 text-blue-600 dark:text-blue-400",
  warning: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
  critical: "bg-destructive/10 text-destructive",
}

async function acknowledgeAlert(id: string) {
  await fetch(`/api/alerts/operational?id=${encodeURIComponent(id)}`, { method: "PATCH" })
  await mutate(ALERTS_URL)
}

function BellDropdown({ className }: { className?: string }) {
  const { data: alerts = [] } = useSWR<Alert[]>(ALERTS_URL, fetcher, {
    refreshInterval: 30_000,
    revalidateOnFocus: true,
  })

  const safeAlerts = Array.isArray(alerts) ? alerts : []
  const unreadCount = safeAlerts.length
  const visible = safeAlerts.slice(0, 10)

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <span className={cn("relative inline-flex", className)}>
            <IconButton
              variant="ghost"
              tooltip="Notifications"
              aria-label={`Notifications${unreadCount > 0 ? `, ${unreadCount} unread` : ""}`}
            >
              <BellIcon />
            </IconButton>
            {unreadCount > 0 && (
              <span
                aria-hidden="true"
                className="absolute -top-0.5 -right-0.5 flex size-4 items-center justify-center rounded-full bg-destructive text-[10px] font-bold text-white"
              >
                {unreadCount > 9 ? "9+" : unreadCount}
              </span>
            )}
          </span>
        }
      />
      <DropdownMenuContent
        side="bottom"
        align="end"
        className="w-80 p-0"
      >
        <div className="flex items-center justify-between border-b border-border px-4 py-2">
          <span className="text-sm font-medium">Notifications</span>
          {unreadCount > 0 && (
            <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
              {unreadCount} unread
            </span>
          )}
        </div>

        <div className="max-h-80 overflow-y-auto">
          {visible.length === 0 ? (
            <EmptyState
              title="All caught up"
              description="No unread notifications."
              className="py-8"
            />
          ) : (
            <ul role="list">
              {visible.map((alert) => (
                <li
                  key={alert.id}
                  className="flex items-start gap-3 border-b border-border/60 px-4 py-3 last:border-0"
                >
                  <span
                    className={cn(
                      "mt-0.5 rounded-sm px-1.5 py-0.5 text-[10px] font-semibold uppercase",
                      severityClass[alert.severity]
                    )}
                  >
                    {alert.severity}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="truncate text-sm font-medium text-foreground">
                      {alert.title}
                    </p>
                    <p className="line-clamp-2 text-xs text-muted-foreground">
                      {alert.message}
                    </p>
                  </div>
                  <button
                    onClick={() => acknowledgeAlert(alert.id)}
                    className="shrink-0 text-xs text-muted-foreground hover:text-foreground"
                    aria-label={`Dismiss ${alert.title}`}
                  >
                    ✕
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="border-t border-border px-4 py-2">
          <Link
            href="/alerts"
            className="block text-center text-xs text-primary hover:underline"
          >
            See all alerts
          </Link>
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

export { BellDropdown }
export type { Alert }
