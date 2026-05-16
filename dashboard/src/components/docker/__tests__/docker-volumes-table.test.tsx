import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { DockerVolumesTable } from "../docker-volumes-table";

describe("DockerVolumesTable", () => {
  it("renders empty state", () => {
    render(<DockerVolumesTable volumes={[]} />);
    expect(screen.getByText("No volumes")).toBeInTheDocument();
  });

  it("renders columns: Name, Driver, Mountpoint", () => {
    render(<DockerVolumesTable volumes={[{ Name: "vol1", Driver: "local", Mountpoint: "/mnt" }]} />);
    expect(screen.getByText("Name")).toBeInTheDocument();
    expect(screen.getByText("Driver")).toBeInTheDocument();
    expect(screen.getByText("Mountpoint")).toBeInTheDocument();
  });

  it("renders volume data", () => {
    const volumes = [
      {
        Name: "vol1",
        Driver: "local",
        Mountpoint: "/var/lib/docker/volumes/vol1/_data",
      },
    ];
    render(<DockerVolumesTable volumes={volumes} />);
    expect(screen.getByText("vol1")).toBeInTheDocument();
    expect(screen.getByText("local")).toBeInTheDocument();
    expect(screen.getByText("/var/lib/docker/volumes/vol1/_data")).toBeInTheDocument();
  });

  it("truncates mountpoint with max-width class", () => {
    const volumes = [
      {
        Name: "vol1",
        Driver: "local",
        Mountpoint: "/var/lib/docker/volumes/vol1/_data",
      },
    ];
    render(<DockerVolumesTable volumes={volumes} />);
    const cell = screen.getByText("/var/lib/docker/volumes/vol1/_data");
    expect(cell.className).toContain("max-w");
  });
});
