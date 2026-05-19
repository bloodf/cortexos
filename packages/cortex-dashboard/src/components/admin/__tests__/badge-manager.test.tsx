import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { BadgeManager } from "../badge-manager";

const mockFetch = vi.fn();

describe("BadgeManager", () => {
  beforeEach(() => {
    mockFetch.mockReset();
    global.fetch = mockFetch;
  });

  it("shows loading then renders badges", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        badges: [
          { id: 1, service_id: 10, label: "prod", color: "#ff0000" },
          { id: 2, service_id: 10, label: "stable", color: "#00ff00" },
        ],
      }),
    });

    render(<BadgeManager serviceId={10} />);
    expect(screen.getByText("Loading badges...")).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByText("prod")).toBeInTheDocument();
      expect(screen.getByText("stable")).toBeInTheDocument();
    });

    expect(mockFetch).toHaveBeenCalledWith("/api/badges?service_id=10");
  });

  it("shows empty state when no badges", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ badges: [] }),
    });

    render(<BadgeManager serviceId={10} />);
    await waitFor(() => {
      expect(screen.getByText("No badges yet.")).toBeInTheDocument();
    });
  });

  it("adds a new badge", async () => {
    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ badges: [] }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ id: 3, service_id: 10, label: "beta", color: "#0000ff" }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          badges: [{ id: 3, service_id: 10, label: "beta", color: "#0000ff" }],
        }),
      });

    render(<BadgeManager serviceId={10} />);
    await waitFor(() => screen.getByText("No badges yet."));

    fireEvent.change(screen.getByPlaceholderText("Label"), {
      target: { value: "beta" },
    });
    fireEvent.change(screen.getByDisplayValue("#3b82f6"), {
      target: { value: "#0000ff" },
    });
    fireEvent.click(screen.getByRole("button", { name: /add badge/i }));

    await waitFor(() => {
      expect(screen.getByText("beta")).toBeInTheDocument();
    });

    expect(mockFetch).toHaveBeenNthCalledWith(
      2,
      "/api/badges",
      expect.objectContaining({
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ service_id: 10, label: "beta", color: "#0000ff" }),
      })
    );
  });

  it("deletes a badge", async () => {
    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          badges: [{ id: 5, service_id: 10, label: "old", color: "#333" }],
        }),
      })
      .mockResolvedValueOnce({ ok: true, json: async () => ({}) })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ badges: [] }),
      });

    render(<BadgeManager serviceId={10} />);
    await waitFor(() => screen.getByText("old"));

    fireEvent.click(screen.getByRole("button", { name: /delete/i }));

    await waitFor(() => {
      expect(screen.queryByText("old")).not.toBeInTheDocument();
    });

    expect(mockFetch).toHaveBeenNthCalledWith(
      2,
      "/api/badges?id=5",
      expect.objectContaining({ method: "DELETE" })
    );
  });

  it("edits a badge inline", async () => {
    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          badges: [{ id: 6, service_id: 10, label: "draft", color: "#999" }],
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ id: 6, service_id: 10, label: "final", color: "#111" }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          badges: [{ id: 6, service_id: 10, label: "final", color: "#111" }],
        }),
      });

    render(<BadgeManager serviceId={10} />);
    await waitFor(() => screen.getByText("draft"));

    fireEvent.click(screen.getByRole("button", { name: /edit/i }));

    const labelInput = screen.getByDisplayValue("draft");
    fireEvent.change(labelInput, { target: { value: "final" } });

    const editColorInput = screen.getByTestId("edit-color");
    fireEvent.change(editColorInput, { target: { value: "#111" } });

    fireEvent.click(screen.getByRole("button", { name: /save/i }));

    await waitFor(() => {
      expect(screen.getByText("final")).toBeInTheDocument();
    });

		const patchCall = mockFetch.mock.calls.find((call) => call[1]?.method === "PATCH");
		expect(patchCall).toBeTruthy();
		expect(patchCall![0]).toBe("/api/badges");
		expect(JSON.parse(patchCall![1].body)).toMatchObject({ id: 6, label: "final" });
	});
  it("cancels edit and reverts to display mode", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        badges: [{ id: 7, service_id: 10, label: "keep", color: "#abc" }],
      }),
    });

    render(<BadgeManager serviceId={10} />);
    await waitFor(() => screen.getByText("keep"));

    fireEvent.click(screen.getByRole("button", { name: /edit/i }));
    expect(screen.getByDisplayValue("keep")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /cancel/i }));
    expect(screen.queryByDisplayValue("keep")).not.toBeInTheDocument();
    expect(screen.getByText("keep")).toBeInTheDocument();
  });
});
