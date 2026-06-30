import { StatusDot } from "@astryxdesign/core/StatusDot";
import { Badge } from "@astryxdesign/core/Badge";
import type { Status } from "@/lib/status";
import { ms } from "@/lib/format";
import { useT } from "@/hooks/useT";

const STATUS_VARIANT: Record<Status, "success" | "error" | "warning" | "neutral"> = {
  online: "success",
  offline: "error",
  checking: "warning",
  unknown: "neutral",
};

export function StatusBadge({
  status,
  responseTime,
  compact = false,
}: {
  status: Status;
  responseTime?: number;
  compact?: boolean;
}) {
  const t = useT();
  const variant = STATUS_VARIANT[status];
  const label = t.status[status];

  if (compact) {
    return <StatusDot variant={variant} label={label} isPulsing={status === "checking"} />;
  }

  return (
    <Badge
      variant={variant}
      label={
        <>
          {label}
          {status === "online" && typeof responseTime === "number" && (
            <span className="tabular-nums opacity-70"> · {ms(responseTime)}</span>
          )}
        </>
      }
      icon={
        <span aria-hidden="true">
          <StatusDot variant={variant} label={label} isPulsing={status === "checking"} />
        </span>
      }
    />
  );
}
