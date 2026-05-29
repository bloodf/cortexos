import { render, screen, fireEvent } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ServiceToggles } from "../service-toggles";
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

describe("ServiceToggles", () => {
  it("renders empty state when no services", () => {
    render(<ServiceToggles services={[]} onToggle={vi.fn()} />);
    expect(screen.getByText("No services to display.")).toBeInTheDocument();
  });

  it("renders table with name, category, and toggle", () => {
    const services = [
      makeService({ id: 1, name: "Alpha", category: "AI", is_active: true }),
      makeService({ id: 2, name: "Beta", category: "Storage", is_active: false }),
    ];
    render(<ServiceToggles services={services} onToggle={vi.fn()} />);

    expect(screen.getByText("Alpha")).toBeInTheDocument();
    expect(screen.getByText("Beta")).toBeInTheDocument();
    expect(screen.getByText("AI")).toBeInTheDocument();
    expect(screen.getByText("Storage")).toBeInTheDocument();
    expect(screen.getByTestId("toggle-1")).toBeInTheDocument();
    expect(screen.getByTestId("toggle-2")).toBeInTheDocument();
  });

  it("calls onToggle with correct args when clicked", async () => {
    const onToggle = vi.fn();
    const services = [makeService({ id: 3, is_active: true })];
    render(<ServiceToggles services={services} onToggle={onToggle} />);

    fireEvent.click(screen.getByTestId("toggle-3"));
    expect(onToggle).toHaveBeenCalledTimes(1);
    expect(onToggle).toHaveBeenCalledWith(3, false);
  });

  it("toggle reflects active and inactive states", () => {
    const services = [
      makeService({ id: 1, is_active: true }),
      makeService({ id: 2, is_active: false }),
    ];
    render(<ServiceToggles services={services} onToggle={vi.fn()} />);

    const activeToggle = screen.getByTestId("toggle-1");
    const inactiveToggle = screen.getByTestId("toggle-2");

    expect(activeToggle).toHaveAttribute("aria-checked", "true");
    expect(inactiveToggle).toHaveAttribute("aria-checked", "false");
  });
});
