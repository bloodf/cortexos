import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { DockerImagesTable } from "../docker-images-table";

describe("DockerImagesTable", () => {
  it("renders empty state", () => {
    render(<DockerImagesTable images={[]} />);
    expect(screen.getByText("No images")).toBeInTheDocument();
  });

  it("renders columns: Repository, Tag, Size, Created", () => {
    render(<DockerImagesTable images={[{ Repository: "a", Tag: "b", Size: 0, Created: 0 }]} />);
    expect(screen.getByText("Repository")).toBeInTheDocument();
    expect(screen.getByText("Tag")).toBeInTheDocument();
    expect(screen.getByText("Size")).toBeInTheDocument();
    expect(screen.getByText("Created")).toBeInTheDocument();
  });

  it("renders image data", () => {
    const images = [
      {
        Repository: "nginx",
        Tag: "latest",
        Size: 150000000,
        Created: 1700000000,
      },
    ];
    render(<DockerImagesTable images={images} />);
    expect(screen.getByText("nginx")).toBeInTheDocument();
    expect(screen.getByText("latest")).toBeInTheDocument();
    expect(screen.getByText("143.05 MB")).toBeInTheDocument();
    expect(screen.getByText("11/14/2023")).toBeInTheDocument();
  });

  it("formats bytes correctly", () => {
    const images = [
      { Repository: "a", Tag: "b", Size: 0, Created: 0 },
      { Repository: "c", Tag: "d", Size: 1024, Created: 0 },
      { Repository: "e", Tag: "f", Size: 1048576, Created: 0 },
    ];
    render(<DockerImagesTable images={images} />);
    expect(screen.getByText("0 B")).toBeInTheDocument();
    expect(screen.getByText("1 KB")).toBeInTheDocument();
    expect(screen.getByText("1 MB")).toBeInTheDocument();
  });

  it("formats date from unix timestamp", () => {
    const images = [
      { Repository: "a", Tag: "b", Size: 0, Created: 1700000000 },
    ];
    render(<DockerImagesTable images={images} />);
    expect(screen.getByText("11/14/2023")).toBeInTheDocument();
  });
});
