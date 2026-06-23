// @vitest-environment node
/**
 * Docker bridge dispatch tests — SEC-02 flag-spoofing hardening.
 *
 * Drives `dispatch()` with an injected fake executor (no real docker, no
 * shell). incus neutralizes leading-dash flag-spoofing with its name regex and
 * systemd with an existence snapshot; docker previously did neither — a
 * `<container>` value like `-f` would be rendered straight into argv and parsed
 * by docker as a flag. These tests pin the two restrictive defences:
 *
 *   1. renderArgv rejects any placeholder value starting with `-`
 *      (`leading_dash`), BEFORE the approval gate.
 *   2. the docker templates carry a literal `--` end-of-options token before
 *      the first caller-controlled positional, so even a benign value can't be
 *      mis-parsed as a flag.
 */

import { describe, it, expect, afterEach } from "vitest";

import {
  dispatch,
  internals,
  setExecutorForTests,
  type DispatchContext,
  type Executor,
} from "../bridge";
import { allowlistedCommand } from "../../policy";
import { asUserId, asSessionId } from "../../entities";
import { mintApproval, resetApprovalStore } from "../../approval";

afterEach(() => {
  setExecutorForTests(null);
  resetApprovalStore();
});

function makeAdminCtx(): DispatchContext {
  return {
    user: {
      id: asUserId("u-admin"),
      username: "admin",
      is_admin: true,
      isAdmin: true,
      isActive: true,
      groupMemberships: ["cortexos-admin"],
    },
    ip: "127.0.0.1",
    userAgent: "vitest",
    requestId: "req-docker-sec02",
  };
}

// Records every argv the bridge issues so we can assert exact commands.
function recordingExecutor(): { exec: Executor; calls: string[][] } {
  const calls: string[][] = [];
  const exec: Executor = async (argv) => {
    calls.push([...argv]);
    return { stdout: "ok", stderr: "", exitCode: 0 };
  };
  return { exec, calls };
}

describe("docker bridge SEC-02 — leading-dash flag-spoofing", () => {
  it("renderArgv rejects a `<container>` value starting with '-' (leading_dash)", () => {
    const entry = allowlistedCommand("docker.stop");
    expect(entry).toBeDefined();
    const r = internals.renderArgv(entry!, { container: "-f" });
    expect("code" in r && r.code).toBe("leading_dash");
    if ("code" in r) expect(r.field).toBe("container");
  });

  it("dispatch rejects a `<container>` of '-f' as leading_dash before any docker runs", async () => {
    const { exec, calls } = recordingExecutor();
    setExecutorForTests(exec);

    const res = await dispatch(
      { op: "docker.stop", args: { container: "-f" }, approvalToken: "irrelevant" },
      makeAdminCtx(),
    );

    expect(res.status).toBe("rejected");
    if (res.status === "rejected") expect(res.code).toBe("leading_dash");
    // The executor must never have been invoked.
    expect(calls).toHaveLength(0);
  });

  it("dispatch rejects a `--rm`-style `<command>` on docker.exec as leading_dash", async () => {
    const { exec, calls } = recordingExecutor();
    setExecutorForTests(exec);

    const res = await dispatch(
      {
        op: "docker.exec",
        args: { container: "grafana", command: "--privileged" },
        approvalToken: "x",
      },
      makeAdminCtx(),
    );

    expect(res.status).toBe("rejected");
    if (res.status === "rejected") expect(res.code).toBe("leading_dash");
    expect(calls).toHaveLength(0);
  });

  it("renders a benign `<container>` AFTER a literal `--` end-of-options token", async () => {
    const { exec, calls } = recordingExecutor();
    setExecutorForTests(exec);

    const sid = asSessionId("sess-docker-ok");
    const tok = mintApproval({
      action: "docker.stop",
      payload: { op: "docker.stop", args: { container: "grafana-1" } },
      sessionId: sid,
      userId: asUserId("u-admin"),
    });

    const res = await dispatch(
      {
        op: "docker.stop",
        args: { container: "grafana-1" },
        approvalToken: tok.token,
        sessionId: sid,
      },
      makeAdminCtx(),
    );

    expect(res.status).toBe("accepted");
    if (res.status === "accepted") {
      // `--` immediately precedes the caller-controlled positional.
      const dashIdx = res.argv.indexOf("--");
      expect(dashIdx).toBeGreaterThan(-1);
      expect(res.argv[dashIdx + 1]).toBe("grafana-1");
      expect(res.argv).toEqual(["/usr/bin/docker", "stop", "--", "grafana-1"]);
    }
    expect(calls).toHaveLength(1);
    expect(calls[0]).toContain("--");
  });
});
