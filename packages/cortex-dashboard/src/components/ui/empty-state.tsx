"use client"

import * as React from "react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"

interface EmptyStateCTAProps {
  label: string
  onClick?: () => void
  href?: string
}

interface EmptyStateProps extends React.ComponentProps<"div"> {
  icon?: React.ReactNode
  title: string
  description?: string
  cta?: EmptyStateCTAProps
}

function EmptyState({
  icon,
  title,
  description,
  cta,
  className,
  ...props
}: EmptyStateProps) {
  return (
    <div
      data-slot="empty-state"
      className={cn(
        "flex flex-col items-center justify-center gap-3 py-12 text-center",
        className
      )}
      {...props}
    >
      {icon && (
        <div className="flex size-12 items-center justify-center rounded-full bg-muted text-muted-foreground">
          {icon}
        </div>
      )}
      <div className="flex flex-col gap-1">
        <p className="text-sm font-medium text-foreground">{title}</p>
        {description && (
          <p className="text-sm text-muted-foreground">{description}</p>
        )}
      </div>
      {cta && (
        <Button
          variant="outline"
          size="sm"
          onClick={cta.onClick}
          {...(cta.href ? { render: <a href={cta.href} /> } : {})}
        >
          {cta.label}
        </Button>
      )}
    </div>
  )
}

export { EmptyState }
export type { EmptyStateProps, EmptyStateCTAProps }
