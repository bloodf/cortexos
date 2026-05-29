"use client"

import * as React from "react"
import { Area, AreaChart, ResponsiveContainer } from "recharts"
import { ArrowDownIcon, ArrowUpIcon } from "lucide-react"

import { cn } from "@/lib/utils"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardAction,
} from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"

type DeltaTrend = "up" | "down" | "neutral"

interface SparklinePoint {
  value: number
}

interface StatCardProps extends React.ComponentProps<typeof Card> {
  label: React.ReactNode
  value: React.ReactNode
  delta?: React.ReactNode
  /** Controls delta badge tint + arrow. Defaults to "neutral". */
  deltaTrend?: DeltaTrend
  icon?: React.ReactNode
  /** Mini area-chart series; bound to --chart-1 token. */
  sparkline?: SparklinePoint[]
  /** Chart token index for the sparkline stroke/fill (1-5). Defaults to 1. */
  sparklineChartToken?: 1 | 2 | 3 | 4 | 5
}

function deltaClasses(trend: DeltaTrend): string {
  switch (trend) {
    case "up":
      return "bg-success/10 text-success"
    case "down":
      return "bg-destructive/10 text-destructive"
    default:
      return "bg-muted text-muted-foreground"
  }
}

function StatCard({
  label,
  value,
  delta,
  deltaTrend = "neutral",
  icon,
  sparkline,
  sparklineChartToken = 1,
  className,
  size = "sm",
  ...props
}: StatCardProps) {
  const gradientId = React.useId()
  const tokenVar = `var(--chart-${sparklineChartToken})`

  return (
    <Card
      data-slot="stat-card"
      size={size}
      className={cn("gap-2", className)}
      {...props}
    >
      <CardHeader>
        <CardTitle className="text-sm font-medium text-muted-foreground">
          {label}
        </CardTitle>
        {icon && (
          <CardAction className="text-muted-foreground [&>svg]:size-4">
            {icon}
          </CardAction>
        )}
      </CardHeader>
      <CardContent className="flex flex-col gap-2">
        <div className="flex items-end justify-between gap-3">
          <span
            data-slot="stat-card-value"
            className="text-2xl font-semibold tabular-nums tracking-tight text-foreground"
          >
            {value}
          </span>
          {delta != null && (
            <Badge
              className={cn(
                "gap-0.5 font-medium",
                deltaClasses(deltaTrend)
              )}
            >
              {deltaTrend === "up" && <ArrowUpIcon />}
              {deltaTrend === "down" && <ArrowDownIcon />}
              {delta}
            </Badge>
          )}
        </div>
        {sparkline && sparkline.length > 0 && (
          <div className="h-10 w-full" data-slot="stat-card-sparkline">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart
                data={sparkline}
                margin={{ top: 2, right: 0, left: 0, bottom: 0 }}
              >
                <defs>
                  <linearGradient
                    id={gradientId}
                    x1="0"
                    y1="0"
                    x2="0"
                    y2="1"
                  >
                    <stop offset="0%" stopColor={tokenVar} stopOpacity={0.3} />
                    <stop offset="100%" stopColor={tokenVar} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <Area
                  type="monotone"
                  dataKey="value"
                  stroke={tokenVar}
                  strokeWidth={1.5}
                  fill={`url(#${gradientId})`}
                  isAnimationActive={false}
                  dot={false}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

export { StatCard }
export type { StatCardProps, DeltaTrend, SparklinePoint }
