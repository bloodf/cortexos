import { describe, it, expect } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useSavedFilters } from "./useSavedFilters";

describe("useSavedFilters", () => {
  it("toggles ids and persists per scope", () => {
    localStorage.clear();
    const { result } = renderHook(() => useSavedFilters("test-scope"));
    expect(result.current.has("a")).toBe(false);
    act(() => result.current.toggle("a"));
    expect(result.current.has("a")).toBe(true);
    expect(JSON.parse(localStorage.getItem("cortex.filters.test-scope") ?? "[]")).toContain("a");
    act(() => result.current.toggle("a"));
    expect(result.current.has("a")).toBe(false);
  });

  it("clears all filters", () => {
    const { result } = renderHook(() => useSavedFilters("clear-scope", ["x", "y"]));
    act(() => result.current.clear());
    expect(result.current.active).toEqual([]);
  });
});
