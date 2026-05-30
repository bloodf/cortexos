import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { IncusTable } from "../incus-table";

const mockData = {
  data: [
    {
      name: "mementry",
      status: "Running",
      type: "container",
      ipv4: "10.0.0.2",
      ipv6: null,
      architecture: "aarch64",
      created: "2026-05-28T12:00:00Z",
      profiles: ["default"],
      snapshotsCount: 0,
    },
  ],
};

describe("IncusTable", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("renders loading state with skeletons", () => {
    vi.stubGlobal("fetch", () => new Promise(() => {}));
    render(<IncusTable />);
    expect(screen.getByText("Instances")).toBeInTheDocument();
  });

  it("renders table headers after data loads", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() =>
        Promise.resolve({
          ok: true,
          json: () => Promise.resolve(mockData),
        } as Response)
      )
    );
    render(<IncusTable />);
    expect(await screen.findByText("mementry")).toBeInTheDocument();
    expect(screen.getAllByText("Name").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Status").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Type").length).toBeGreaterThan(0);
    expect(screen.getAllByText("IPv4").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Architecture").length).toBeGreaterThan(0);
  });

  it("renders instance status badge", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() =>
        Promise.resolve({
          ok: true,
          json: () => Promise.resolve(mockData),
        } as Response)
      )
    );
    render(<IncusTable />);
    expect(await screen.findByText("Running")).toBeInTheDocument();
  });
});
