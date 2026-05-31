import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { ReactNode } from "react";

interface Props {
  label: string;
  value: ReactNode;
  hint?: ReactNode;
  icon?: ReactNode;
  trend?: ReactNode;
  className?: string;
}

export function MetricCard({ label, value, hint, icon, trend, className }: Props) {
  return (
    <Card className={cn("elev-1", className)}>
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-2">
          <div className="space-y-1 min-w-0">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
            <p className="text-2xl font-semibold tabular-nums leading-tight truncate">{value}</p>
            {hint && <p className="text-xs text-muted-foreground truncate">{hint}</p>}
          </div>
          {icon && <div className="text-muted-foreground shrink-0">{icon}</div>}
        </div>
        {trend && <div className="mt-3">{trend}</div>}
      </CardContent>
    </Card>
  );
}
