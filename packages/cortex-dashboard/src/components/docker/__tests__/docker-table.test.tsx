import { render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DockerTable } from "../docker-table";

const dockerPayload = {
  containers: { data: [{ ID: "abc", Names: "test-container", Image: "nginx", Command: "nginx", CreatedAt: "now", Ports: "80/tcp", State: "running", Status: "Up", Networks: "bridge", Size: "0B" }] },
  images: { data: [{ ID: "img", Repository: "nginx", Tag: "latest", Size: "10MB", CreatedSince: "1 day ago" }] },
  volumes: { data: [{ Name: "test-volume", Driver: "local", Mountpoint: "/var/lib/docker/volumes/test", Scope: "local", Labels: "" }] },
};

describe("DockerTable", () => {
  afterEach(() => { vi.restoreAllMocks(); });

  it("renders loading state with skeletons", () => {
    vi.stubGlobal("fetch", vi.fn(() => new Promise(() => {})));
    render(<DockerTable />);
    expect(document.querySelector(".animate-pulse")).toBeTruthy();
  });

  it("renders tabbed containers table after data loads", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => dockerPayload }));
    render(<DockerTable />);
    expect(await screen.findByText("test-container")).toBeInTheDocument();
    expect(screen.getByText("Image")).toBeInTheDocument();
    expect(screen.getByText("Ports")).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: /volumes/i })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: /images/i })).toBeInTheDocument();
  });
});
