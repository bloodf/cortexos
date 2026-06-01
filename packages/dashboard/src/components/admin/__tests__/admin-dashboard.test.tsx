import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { AdminDashboard } from "../admin-dashboard";
import type { Service } from "../service-row";

function makeService(overrides: Partial<Service> = {}): Service {
  return {
    id: 1,
    slug: "svc-1",
    name: "Service One",
    open_url: "http://localhost:3000",
    health_url: "http://localhost:3000/health",
    health_type: "http",
    category: "Infrastructure",
    is_active: true,
    icon_color: null,
    icon_image: null,
    ...overrides,
  };
}

const mockFetch = vi.fn();

describe("AdminDashboard", () => {
  beforeEach(() => {
    mockFetch.mockReset();
    global.fetch = mockFetch;
    mockFetch.mockResolvedValue({ ok: true, json: async () => ({ badges: [] }) });
  });

  it("renders service toggles tab by default", () => {
    const services = [makeService({ id: 1, name: "Alpha" })];
    render(<AdminDashboard services={services} />);

    expect(screen.getByText("Alpha")).toBeInTheDocument();
    expect(screen.getByText("Service Toggles")).toBeInTheDocument();
    expect(screen.getByText("Badge Manager")).toBeInTheDocument();
  });

  it("switches to Badge Manager tab", async () => {
    const services = [makeService({ id: 1, name: "Alpha" })];
    render(<AdminDashboard services={services} />);

    fireEvent.click(screen.getByRole("button", { name: /badge manager/i }));
    await waitFor(() => {
      expect(screen.getByText("Loading badges…")).toBeInTheDocument();
    });
  });

  it("shows service selector when multiple services", () => {
    const services = [
      makeService({ id: 1, name: "Alpha" }),
      makeService({ id: 2, name: "Beta" }),
    ];
    render(<AdminDashboard services={services} />);

    expect(screen.getByText("Alpha")).toBeInTheDocument();
    expect(screen.getByText("Beta")).toBeInTheDocument();
  });

  it("calls onToggle when service toggle clicked", () => {
    const services = [makeService({ id: 1, name: "Alpha", is_active: true })];
    const onToggle = vi.fn();
    render(<AdminDashboard services={services} onToggle={onToggle} />);

    fireEvent.click(screen.getByTestId("toggle-1"));
    expect(onToggle).toHaveBeenCalledWith(1, false);
  });
});
