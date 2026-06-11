import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { IncidentToaster } from "@/components/IncidentToaster";
import { api } from "@/lib/api/client";
import { toast } from "sonner";
import type { AlertHistory } from "@/mocks/types";
import source from "@/components/IncidentToaster.tsx?raw";

vi.mock("@/lib/api/client", () => ({
  api: {
    alerts: {
      history: vi.fn(),
    },
  },
}));

vi.mock("sonner", () => ({
  toast: {
    error: vi.fn(),
    success: vi.fn(),
    info: vi.fn(),
  },
}));

const seedAlerts: AlertHistory[] = [];

const newAlerts: AlertHistory[] = [
  {
    id: "ah-2",
    ruleName: "Database connection",
    serviceName: "postgresql",
    status: "resolved",
    message: "connection restored",
    timestamp: new Date().toISOString(),
  },
];

function renderToaster() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <IncidentToaster />
    </QueryClientProvider>,
  );
}

describe("IncidentToaster live wiring (MP-026 RED)", () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("fires a toast once for a new alert after mount and skips pre-existing entries", async () => {
    vi.mocked(api.alerts.history)
      .mockResolvedValueOnce(seedAlerts)
      .mockResolvedValueOnce(newAlerts);

    renderToaster();

    await vi.waitFor(() => expect(api.alerts.history).toHaveBeenCalledTimes(1));
    expect(toast.success).not.toHaveBeenCalled();
    expect(toast.error).not.toHaveBeenCalled();
    expect(toast.info).not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(5000);

    await vi.waitFor(() => expect(api.alerts.history).toHaveBeenCalledTimes(2));
    await vi.waitFor(() => expect(toast.success).toHaveBeenCalledTimes(1));

    expect(toast.error).not.toHaveBeenCalled();
    expect(toast.info).not.toHaveBeenCalled();
  });

  it("does not import from @/mocks in the component source", () => {
    expect(source).not.toMatch(/@\/mocks/);
  });
});
