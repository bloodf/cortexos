import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { AgentFileViewer } from "../agent-file-viewer";

// Mock SWR
vi.mock("swr", () => {
  const actual = vi.importActual("swr");
  return {
    ...actual,
    default: vi.fn(),
    mutate: vi.fn(),
  };
});

import useSWR, { mutate } from "swr";
const mockUseSWR = vi.mocked(useSWR);
const mockMutate = vi.mocked(mutate);

// Mock fetch
const mockFetch = vi.fn();
global.fetch = mockFetch;

const testFiles = [
  { name: "agent.md", path: "/test/.agents/coder/agent.md" },
  { name: "soul.md", path: "/test/.agents/coder/soul.md" },
  { name: "user.md", path: "/test/.agents/coder/user.md" },
];

describe("AgentFileViewer", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseSWR.mockReturnValue({
      data: { content: "# Test Content", filename: "agent.md" },
      error: undefined,
      isLoading: false,
      isValidating: false,
      mutate: vi.fn(),
    } as ReturnType<typeof useSWR>);
  });

  it("renders file tabs", () => {
    render(<AgentFileViewer slug="coder" files={testFiles} />);

    // agent.md appears in both tab and toolbar, so use getAllByText
    expect(screen.getAllByText("agent.md").length).toBeGreaterThanOrEqual(1);
    expect(screen.getByRole("button", { name: "soul.md" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "user.md" })).toBeInTheDocument();
  });

  it("shows file content", () => {
    render(<AgentFileViewer slug="coder" files={testFiles} />);
    expect(screen.getByText("# Test Content")).toBeInTheDocument();
  });

  it("switches between files on tab click", () => {
    render(<AgentFileViewer slug="coder" files={testFiles} />);

    fireEvent.click(screen.getByText("soul.md"));

    // SWR should be called with the new file URL
    expect(mockUseSWR).toHaveBeenCalledWith(
      "/api/agents/coder/files/soul.md",
      expect.any(Function),
    );
  });

  it("toggles edit mode", () => {
    render(<AgentFileViewer slug="coder" files={testFiles} />);

    // Click Edit
    fireEvent.click(screen.getByText("Edit"));

    // Should show Save and Cancel buttons
    expect(screen.getByText("Save")).toBeInTheDocument();
    expect(screen.getByText("Cancel")).toBeInTheDocument();

    // Should show textarea
    const textarea = screen.getByRole("textbox");
    expect(textarea).toBeInTheDocument();
    expect(textarea).toHaveValue("# Test Content");
  });

  it("cancels edit mode", () => {
    render(<AgentFileViewer slug="coder" files={testFiles} />);

    fireEvent.click(screen.getByText("Edit"));
    fireEvent.click(screen.getByText("Cancel"));

    // Should be back to view mode
    expect(screen.getByText("Edit")).toBeInTheDocument();
    expect(screen.queryByText("Save")).not.toBeInTheDocument();
  });

  it("calls PUT on save", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ success: true }),
    });
    mockMutate.mockResolvedValue(undefined);

    render(<AgentFileViewer slug="coder" files={testFiles} />);

    fireEvent.click(screen.getByText("Edit"));

    const textarea = screen.getByRole("textbox");
    fireEvent.change(textarea, { target: { value: "Updated content" } });

    fireEvent.click(screen.getByText("Save"));

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith(
        "/api/agents/coder/files/agent.md",
        expect.objectContaining({
          method: "PUT",
          body: JSON.stringify({ content: "Updated content" }),
        }),
      );
    });
  });

  it("shows no files message when empty", () => {
    render(<AgentFileViewer slug="coder" files={[]} />);
    expect(
      screen.getByText("No .md files found for this agent."),
    ).toBeInTheDocument();
  });

  it("shows loading state", () => {
    mockUseSWR.mockReturnValue({
      data: undefined,
      error: undefined,
      isLoading: true,
      isValidating: false,
      mutate: vi.fn(),
    } as ReturnType<typeof useSWR>);

    render(<AgentFileViewer slug="coder" files={testFiles} />);
    expect(screen.getByText("Loading…")).toBeInTheDocument();
  });

  it("shows error state", () => {
    mockUseSWR.mockReturnValue({
      data: undefined,
      error: new Error("fail"),
      isLoading: false,
      isValidating: false,
      mutate: vi.fn(),
    } as ReturnType<typeof useSWR>);

    render(<AgentFileViewer slug="coder" files={testFiles} />);
    expect(
      screen.getByText("Failed to load file content."),
    ).toBeInTheDocument();
  });
});
