import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  createMemoryHistory,
  createRootRouteWithContext,
  createRoute,
  Outlet,
  RouterProvider,
  createRouter,
} from "@tanstack/react-router";
import { UIProvider } from "@/hooks/ui-provider";
import { CommandPalette } from "@/app/CommandPalette";
import { api } from "@/lib/api/client";
import type { Service, DockerContainer, SystemdUnit, AuditEntry } from "@/mocks/types";
import source from "@/app/CommandPalette.tsx?raw";

vi.mock("@/lib/api/client", () => ({
  api: {
    services: vi.fn(),
    docker: { containers: vi.fn() },
    systemd: vi.fn(),
    audit: vi.fn(),
  },
}));

vi.mock("@/hooks/useAuth", () => ({
  useAuth: () => ({
    user: { username: "admin", is_admin: true },
    loading: false,
    login: vi.fn(),
    logout: vi.fn(),
    switchUser: vi.fn(),
  }),
}));

const mockServices: Service[] = [
  {
    id: 1,
    slug: "gateway",
    name: "API Gateway",
    open_url: "https://cortexos.local/gateway",
    category: "Core",
    status: "online",
    responseTime: 12,
    icon_color: null,
    icon_image: null,
    kind: "app",
    health_url: "https://cortexos.local/gateway/health",
    health_type: "http",
    description: "Core API gateway",
    env_source: null,
    is_active: true,
    has_webui: true,
    show_in_healthcheck: true,
    show_in_webui: true,
    sort_order: 1,
    icon_type: "auto",
    badges: [],
  },
];

function renderPalette() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });

  const rootRoute = createRootRouteWithContext<{ queryClient: QueryClient }>()({
    component: () => (
      <QueryClientProvider client={queryClient}>
        <UIProvider>
          <Outlet />
        </UIProvider>
      </QueryClientProvider>
    ),
  });

  const indexRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: "/",
    component: () => <CommandPalette open={true} onOpenChange={() => {}} />,
  });

  const router = createRouter({
    routeTree: rootRoute.addChildren([indexRoute]),
    context: { queryClient },
    history: createMemoryHistory({ initialEntries: ["/"] }),
  });

  return render(<RouterProvider router={router} />);
}

describe("CommandPalette live wiring (MP-026 RED)", () => {
  beforeEach(() => {
    vi.mocked(api.services).mockResolvedValue(mockServices);
    vi.mocked(api.docker.containers).mockResolvedValue([] as DockerContainer[]);
    vi.mocked(api.systemd).mockResolvedValue([] as SystemdUnit[]);
    vi.mocked(api.audit).mockResolvedValue([] as AuditEntry[]);
  });

  it("lists services from the mocked live client", async () => {
    renderPalette();
    await waitFor(() => {
      expect(screen.getByText("API Gateway")).toBeInTheDocument();
    });
  });

  it("does not import from @/mocks or drift in the component source", () => {
    expect(source).not.toMatch(/@\/mocks/);
    expect(source).not.toMatch(/drift/);
  });
});
