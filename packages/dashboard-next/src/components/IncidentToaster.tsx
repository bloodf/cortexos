import { useEffect, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { api } from "@/mocks/api";

/**
 * Surfaces newly-created alerts from the drift simulator as sonner toasts.
 * Mounted once at the app shell level.
 */
export function IncidentToaster() {
  const { data: alerts = [] } = useQuery({ queryKey: ["alerts", "history"], queryFn: api.alerts.history, refetchInterval: 4000 });
  const seen = useRef<Set<string>>(new Set());
  const primed = useRef(false);

  useEffect(() => {
    // Skip the very first batch — they're seed data, not "new".
    if (!primed.current) {
      alerts.forEach((a) => seen.current.add(a.id));
      primed.current = true;
      return;
    }
    for (const a of alerts) {
      if (seen.current.has(a.id)) continue;
      seen.current.add(a.id);
      const title = `${a.serviceName}: ${a.message}`;
      if (a.status === "fired") toast.error(title, { description: a.ruleName });
      else if (a.status === "resolved") toast.success(title, { description: a.ruleName });
      else toast.info(title, { description: a.ruleName });
    }
  }, [alerts]);

  return null;
}
