import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { DockerTable } from "../docker-table";

const mockData = {
  containers: {
    data: [
      {
        ID: "abc123",
        Names: "test-container",
        Image: "nginx:latest",
        Command: "\"nginx -g 'daemon off;'\"",
        CreatedAt: "2026-05-14 07:57:11 +0000 UTC",
        Ports: "0.0.0.0:80->80/tcp",
        State: "running",
        Status: "Up 2 hours",
        Networks: "bridge",
        Size: "5MB",
      },
    ],
  },
  volumes: {
    data: [
      {
        Name: "test-volume",
        Driver: "local",
        Mountpoint: "/var/lib/docker/volumes/test-volume/_data",
        Scope: "local",
        Labels: "",
      },
    ],
  },
  images: {
    data: [
      {
        ID: "sha256:def456",
        Repository: "nginx",
        Tag: "latest",
        Size: "150MB",
        CreatedSince: "2 weeks ago",
      },
    ],
  },
};

describe("DockerTable", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("renders loading state with skeletons", () => {
    vi.stubGlobal("fetch", () => new Promise(() => {}));
    render(<DockerTable />);
    expect(screen.getByText("Containers")).toBeInTheDocument();
    expect(screen.getByText("Volumes")).toBeInTheDocument();
    expect(screen.getByText("Images")).toBeInTheDocument();
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
    render(<DockerTable />);
    expect(await screen.findByText("test-container")).toBeInTheDocument();
    expect(screen.getAllByText("Name").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Status").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Image").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Ports").length).toBeGreaterThan(0);
    expect(screen.getByText("test-volume")).toBeInTheDocument();
    expect(screen.getAllByText("Driver").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Mountpoint").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Repository").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Tag").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Size").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Created").length).toBeGreaterThan(0);
  });
});
