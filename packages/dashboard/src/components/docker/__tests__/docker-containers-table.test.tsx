import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { DockerContainersTable } from "../docker-containers-table";

describe("DockerContainersTable", () => {
  it("renders empty state", () => {
    render(<DockerContainersTable containers={[]} />);
    expect(screen.getByText("No containers")).toBeInTheDocument();
  });

  it("renders columns: Name, Image, Status, State", () => {
    render(<DockerContainersTable containers={[{ Names: ["/a"], Image: "img", Status: "Up", State: "running" }]} />);
    expect(screen.getByText("Name")).toBeInTheDocument();
    expect(screen.getByText("Image")).toBeInTheDocument();
    expect(screen.getByText("Status")).toBeInTheDocument();
    expect(screen.getByText("State")).toBeInTheDocument();
  });

  it("renders container data", () => {
    const containers = [
      {
        Names: ["/web"],
        Image: "nginx",
        Status: "Up 2 hours",
        State: "running",
      },
    ];
    render(<DockerContainersTable containers={containers} />);
    expect(screen.getByText("web")).toBeInTheDocument();
    expect(screen.getByText("nginx")).toBeInTheDocument();
    expect(screen.getByText("Up 2 hours")).toBeInTheDocument();
    expect(screen.getByText("running")).toBeInTheDocument();
  });

  it("shows success dot for running state", () => {
    const containers = [{ Names: ["/a"], Image: "img", Status: "Up", State: "running" }];
    render(<DockerContainersTable containers={containers} />);
    const dot = screen.getByLabelText("running");
    expect(dot.className).toContain("bg-success");
  });

  it("shows destructive dot for exited state", () => {
    const containers = [{ Names: ["/a"], Image: "img", Status: "Exited", State: "exited" }];
    render(<DockerContainersTable containers={containers} />);
    const dot = screen.getByLabelText("exited");
    expect(dot.className).toContain("bg-destructive");
  });

  it("shows warning dot for paused state", () => {
    const containers = [{ Names: ["/a"], Image: "img", Status: "Paused", State: "paused" }];
    render(<DockerContainersTable containers={containers} />);
    const dot = screen.getByLabelText("paused");
    expect(dot.className).toContain("bg-warning");
  });

  it("shows muted dot for other state", () => {
    const containers = [{ Names: ["/a"], Image: "img", Status: "Dead", State: "dead" }];
    render(<DockerContainersTable containers={containers} />);
    const dot = screen.getByLabelText("dead");
    expect(dot.className).toContain("bg-muted-foreground");
  });

  it("strips leading slash from name", () => {
    const containers = [{ Names: ["/foo"], Image: "img", Status: "Up", State: "running" }];
    render(<DockerContainersTable containers={containers} />);
    expect(screen.getByText("foo")).toBeInTheDocument();
    expect(screen.queryByText("/foo")).not.toBeInTheDocument();
  });

  it("falls back to Image when Names missing", () => {
    const containers = [{ Image: "fallback-img", Status: "Up", State: "running" }];
    render(<DockerContainersTable containers={containers} />);
    expect(screen.getAllByText("fallback-img").length).toBeGreaterThanOrEqual(1);
  });
});
