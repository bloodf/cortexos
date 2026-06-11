# MP-020d — cortex-terminal → 0 findings (SERVICE-CRITICAL)

Implementer: kimi. Repo root: /opt/cortexos. Report (append after EVERY
step): `/opt/cortexos/.planning/harness/artifacts/impl-mp-020d-report.md`
Manifest input: `artifacts/recon-mp020-manifest.md` §3a (the per-site
exit-path analysis — BINDING; do not start without reading it).
Scope: cortex-terminal n/no-process-exit ×3 (src/server.js ~:458, :482,
:485 — sidecar lifecycle hard-fail paths).

## Context (why this is its own micro-plan)
cortex-terminal.service is the LIVE PTY sidecar on :3081. Its fatal
paths currently `process.exit(1)` so systemd's Restart= recovers it.
Replacing exit() must NOT create a zombie state where exitCode is set
but open PTY/server handles keep the process alive forever.

## Tasks
1. RED: quote `pnpm exec eslint packages/cortex-terminal 2>&1 | tail -1`
   (expect 3) and the three flagged functions IN FULL.
2. Per the manifest's handle analysis, convert each site to:
   `process.exitCode = 1;` + explicit teardown — close the HTTP/WS
   server (`server.close()`), destroy active PTY sessions (the module's
   existing cleanup path), clear intervals/timeouts. If the manifest
   shows a handle that cannot be closed from that site, restructure so
   teardown is reachable (a single `fatal(reason)` helper owning
   teardown + exitCode is the preferred shape — define once, call from
   all 3 sites).
3. `node --check packages/cortex-terminal/src/server.js` → exit 0.
4. LIVE verification (the binding gate):
   a. `sudo systemctl restart cortex-terminal.service` → active.
   b. Functional probe: the dashboard terminal WS endpoint answers (use
      the screen-verify allowlisted check or `curl -s -o /dev/null -w
      '%{http_code}' http://127.0.0.1:3081/healthz` per the package's
      actual probe — quote).
   c. FAILURE-INJECTION: trigger one fatal path in a THROWAWAY copy
      (run `node src/server.js` with an invalid required env/port
      conflict that hits a converted site) → process must EXIT (rc=1)
      within 10s, not hang. Quote the rc and timing. Do NOT inject
      faults into the live service.
5. eslint scope → 0; zero added disables (grep → 0); format:check exit 0.
6. ONE commit: `fix(lint): MP-020d — terminal exit paths to exitCode+teardown`
   Do NOT stage .planning/**. NEVER push.
End IMPL-COMPLETE or IMPL-BLOCKED: <reason>.

## Acceptance (binary)
- A1: scope 0; repo drops by exactly 3.
- A2: failure-injection proves natural exit rc=1 ≤10s on a converted
  path; live service active + probe green after restart.
- A3: zero added disables; single `fatal()` helper pattern (or quoted
  justification per-site).
