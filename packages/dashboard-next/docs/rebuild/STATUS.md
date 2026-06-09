# Dashboard-Next Rebuild — Work Package Status

| WP | Title | Status | Notes |
|----|-------|--------|-------|
| WP-01 | defineServerFn gate middleware | done | |
| WP-04 | API facade (client.ts) | done | services wired; system/network/processes/storage wired WP-31 |
| WP-10 | Services server fns | done | listServices, getService, createService, patchService, deleteService, listServiceHealth, recheckServiceHealth |
| WP-13 | Systemd server fns | done | |
| WP-14 | System/Network/Processes/Storage server fns | done | getSystem, getNetwork, getProcesses, getStorage |
| WP-17 | Alerts server fns | done | |
| WP-31 | Overview UI — wire real data | **done** | system + services wired; docker/incus/alerts degrade gracefully (separate WPs) |
| WP-32 | Apps + Healthcheck UI — wire real data | **done** | api.services / api.servicesList / api.healthcheckList via WP-04 facade; recheck calls recheckServiceHealth; alert timeline placeholder pending WP-17 UI wiring |
| WP-11 | Docker server fns | done | listContainers, listImages, listVolumes, dockerAction — all gated with auth/CSRF/rate-limit/approval; bridge PB-5 enforces approval token on every op |
| WP-33 | Docker UI — wire real data | **done** | /docker + /docker/$id wired to listContainers/listImages/listVolumes via api.docker.*; container actions (start/stop/restart/rm) call mintApproval then dockerAction (PB-5 approval flow); skeleton/empty/error states used; CSRF carried by TanStack RPC transport |
| WP-36 | Network / Storage / Processes / Terminal UI — wire real data | **done** | network/storage/processes → system.functions RPCs; terminal named-ops wired (listTerminalOps + dispatchTerminalOp); interactive PTY stays mocked pending WP-19 (node-pty + streaming transport) |
