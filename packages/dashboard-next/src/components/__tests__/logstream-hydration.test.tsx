import { describe, it, expect } from "vitest";
import { renderToString } from "react-dom/server";
import { LogStream } from "../LogStream";

// Regression test for MP-003 / AN-002: LogStream previously called
// `makeLine()` (new Date() + Math.random()) inside its useState initializer,
// so the static markup produced by SSR and the first client render did not
// match — React then threw #418 (hydration text mismatch) on /healthcheck.
//
// The fix defers the 40 initial lines to a mount-only useEffect, so the
// initial markup is fully deterministic. This test pins that contract by
// rendering <LogStream /> twice to a string and asserting the outputs are
// byte-identical.
describe("LogStream — SSR/client hydration determinism (MP-003)", () => {
  it("produces identical static markup on two consecutive SSR renders", () => {
    const first = renderToString(<LogStream />);
    const second = renderToString(<LogStream />);
    expect(second).toBe(first);
  });
});
