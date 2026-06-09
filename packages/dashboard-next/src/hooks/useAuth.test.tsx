import { describe, it, expect } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";
import { AuthProvider, useAuth } from "./useAuth";

const wrapper = ({ children }: { children: React.ReactNode }) => <AuthProvider>{children}</AuthProvider>;

describe("useAuth", () => {
  it("starts logged out", () => {
    localStorage.clear();
    const { result } = renderHook(() => useAuth(), { wrapper });
    expect(result.current.user).toBeNull();
  });

  it("logs in admin user", async () => {
    localStorage.clear();
    const { result } = renderHook(() => useAuth(), { wrapper });
    await act(async () => { await result.current.login("admin", "x"); });
    expect(result.current.user?.username).toBe("admin");
    expect(result.current.user?.is_admin).toBe(true);
  });

  it("logs in standard user", async () => {
    localStorage.clear();
    const { result } = renderHook(() => useAuth(), { wrapper });
    await act(async () => { await result.current.login("bob", "x"); });
    expect(result.current.user?.is_admin).toBe(false);
  });

  it("rejects empty credentials", async () => {
    const { result } = renderHook(() => useAuth(), { wrapper });
    await expect(result.current.login("", "")).rejects.toThrow();
  });

  it("logout clears user", async () => {
    const { result } = renderHook(() => useAuth(), { wrapper });
    await act(async () => { await result.current.login("admin", "x"); });
    act(() => result.current.logout());
    await waitFor(() => expect(result.current.user).toBeNull());
  });

  it("switchUser toggles admin", async () => {
    const { result } = renderHook(() => useAuth(), { wrapper });
    await act(async () => { await result.current.login("admin", "x"); });
    act(() => result.current.switchUser(false));
    expect(result.current.user?.is_admin).toBe(false);
  });
});
