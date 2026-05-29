import * as React from "react"

import { cn } from "@/lib/utils"

interface PageHeaderProps extends Omit<React.ComponentProps<"div">, "title"> {
  title: React.ReactNode
  description?: React.ReactNode
  icon?: React.ReactNode
  actions?: React.ReactNode
  breadcrumb?: React.ReactNode
}

function PageHeader({
  title,
  description,
  icon,
  actions,
  breadcrumb,
  className,
  ...props
}: PageHeaderProps) {
  return (
    <div
      data-slot="page-header"
      className={cn("flex flex-col gap-3", className)}
      {...props}
    >
      {breadcrumb && <div data-slot="page-header-breadcrumb">{breadcrumb}</div>}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-start gap-3">
          {icon && (
            <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground [&>svg]:size-5">
              {icon}
            </div>
          )}
          <div className="flex flex-col gap-1">
            <h1
              data-slot="page-header-title"
              className="font-heading text-2xl font-semibold leading-tight tracking-tight text-foreground"
            >
              {title}
            </h1>
            {description && (
              <p
                data-slot="page-header-description"
                className="text-sm text-muted-foreground"
              >
                {description}
              </p>
            )}
          </div>
        </div>
        {actions && (
          <div
            data-slot="page-header-actions"
            className="flex shrink-0 items-center gap-2 sm:justify-end"
          >
            {actions}
          </div>
        )}
      </div>
    </div>
  )
}

export { PageHeader }
export type { PageHeaderProps }
