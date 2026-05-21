"use client"

import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { Loader2Icon } from "lucide-react"
import { Button as ButtonPrimitive } from "@base-ui/react/button"
import { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider } from "@/components/ui/tooltip"
import { cn } from "@/lib/utils"

const iconButtonVariants = cva(
  "inline-flex size-8 shrink-0 items-center justify-center rounded-lg border border-transparent bg-clip-padding text-sm transition-all outline-none select-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        default:
          "bg-sky-500/15 text-sky-700 hover:bg-sky-500/25 dark:text-sky-300",
        primary:
          "bg-primary text-primary-foreground hover:bg-primary/80",
        danger:
          "bg-destructive/15 text-destructive hover:bg-destructive/25 focus-visible:border-destructive/40 focus-visible:ring-destructive/20 dark:bg-destructive/20 dark:hover:bg-destructive/30",
        ghost:
          "bg-indigo-500/10 text-indigo-700 hover:bg-indigo-500/20 dark:text-indigo-300 dark:hover:bg-indigo-500/25",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

interface IconButtonProps
  extends ButtonPrimitive.Props,
    VariantProps<typeof iconButtonVariants> {
  tooltip?: React.ReactNode
  loading?: boolean
}

function IconButton({
  className,
  variant = "default",
  tooltip,
  loading = false,
  disabled,
  children,
  ...props
}: IconButtonProps) {
  const button = (
    <ButtonPrimitive
      data-slot="icon-button"
      aria-label={typeof tooltip === "string" ? tooltip : undefined}
      disabled={disabled || loading}
      className={cn(iconButtonVariants({ variant, className }))}
      {...props}
    >
      {loading ? <Loader2Icon className="size-4 animate-spin" /> : children}
    </ButtonPrimitive>
  )

  if (!tooltip) return button

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger render={<span />}>
          {button}
        </TooltipTrigger>
        <TooltipContent>{tooltip}</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}

export { IconButton, iconButtonVariants }
export type { IconButtonProps }
