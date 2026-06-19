// @vitest-environment node
/**
 * resolveHeadroomDashboardUrl — pure helper unit tests.
 *
 * Tests exercise the exported URL helper directly; bare createServerFn calls
 * are not used because the Vite/Nitro handler transform only runs during the
 * build, not under vitest.
 */

import { describe, expect, it } from "vitest";

import { resolveHeadroomDashboardUrl } from "../headroom.functions";

describe("resolveHeadroomDashboardUrl", () => {
  it("uses the local Headroom port by default", () => {
    expect(resolveHeadroomDashboardUrl({} as unknown as NodeJS.ProcessEnv)).toBe(
      "http://127.0.0.1:8787/dashboard",
    );
  });

  it("uses DASHBOARD_ORIGIN as the public origin without appending the Headroom port", () => {
    expect(
      resolveHeadroomDashboardUrl({ DASHBOARD_ORIGIN: "https://dash.example.com" } as unknown as NodeJS.ProcessEnv),
    ).toBe("https://dash.example.com/dashboard");
  });

  it("normalizes a trailing slash in DASHBOARD_ORIGIN", () => {
    expect(
      resolveHeadroomDashboardUrl({ DASHBOARD_ORIGIN: "https://dash.example.com/" } as unknown as NodeJS.ProcessEnv),
    ).toBe("https://dash.example.com/dashboard");
  });
});
