# CortexOS Local-VPS Readiness Review

## Critical (blocks install)

- **Preflight deadlocks on OpenClaw** — `prompts/tools/00-preflight.md:86` — preflight requires OpenClaw running, but `SETUP.md:115` runs `00-preflight` before `40-openclaw`; `SETUP.md:101` says preflight should continue when OpenClaw is not installed — fix: make `00-preflight` record `NOT_INSTALLED` and defer the gateway probe to `40-openclaw` or reorder the install graph.
- **Caddy checkpoint probes future services** — `prompts/tools/13-caddy.md:157` — the spoke verifies Grafana, Prometheus, Loki, cAdvisor, NATS, and Langfuse before those spokes run — fix: validate only Caddy/Tailscale routing here and move each downstream path probe to its owning spoke plus `99-final-validation`.
- **NATS config cannot be cleanly installed** — `prompts/tools/30-nats.md:31` — the prompt copies `templates/nats/accounts.conf`, which still contains unreplaced NKey placeholders at `templates/nats/accounts.conf:19`, `:25`, `:46`, `:63`, `:81`; the tracked stack config uses no auth at `stacks/nats/config/nats-server.conf:15` — fix: choose one NATS deployment path; either remove account auth for localhost MVP or generate and inject real NKeys before `docker compose up`.
- **Secret decryption model is contradictory** — `prompts/tools/12a-sops-bootstrap.md:3` — docs say the age private key never lives on the VPS, but later spokes run `/opt/cortexos/scripts/secrets-decrypt.sh` on the VPS; the script requires `/opt/cortexos/.age/host.key` at `scripts/secrets-decrypt.sh:13` and ignores positional args — fix: make all spokes consume pre-pushed `/opt/cortexos/.secrets/*.env`, or update the script/docs to support host-side decrypt consistently.
- **Sandbox secret is missing** — `prompts/tools/47a-cortex-sandbox.md:41` — the spoke decrypts `sandbox`, but `templates/.secrets/` has no `sandbox.enc.yaml`, and `12a` only expects paperclip/dashboard/consumer/graph/langfuse/nats at `prompts/tools/12a-sops-bootstrap.md:123` — fix: add `templates/.secrets/sandbox.enc.yaml` and include `sandbox.env` in the bootstrap checkpoint.
- **Graph and bridge Compose files fail standalone** — `stacks/cortex-graph/docker-compose.yml:15` — `depends_on` references undefined `nats` and `postgres` services while `45a` runs `docker compose up` in that directory at `prompts/tools/45a-cortex-graph.md:80`; bridge has the same issue at `stacks/cortex-paperclip-bridge/docker-compose.yml:13` — fix: remove `depends_on` for external services or move graph/bridge into a top-level compose with real service definitions.
- **Consumer deployment omits required files** — `prompts/tools/60-cortex-consumer.md:30` — it copies only `consumer.js` and `config.json`, then runs `npm install`; `consumer.js` imports `./lib/dlq.js`, `./lib/signals.js`, and `./lib/pending-approvals.js` at `stacks/cortex-consumer/consumer.js:31`, and dependencies live in `stacks/cortex-consumer/package.json:10` — fix: deploy the whole `stacks/cortex-consumer/` directory including `package*.json` and `lib/`.
- **Consumer env file is unused and misnamed** — `prompts/tools/60-cortex-consumer.md:52` — the prompt writes `/opt/cortexos/.secrets/cortex-consumer.env`, while other spokes append `/opt/cortexos/.secrets/consumer.env`; the systemd unit has no `EnvironmentFile` and uses only inline env at `stacks/cortex-consumer/cortex-consumer.service:13` — fix: standardize on `/opt/cortexos/.secrets/consumer.env`, load it from systemd, and use `OPENCLAW_BASE_URL`, not `OPENCLAW_BASE`.
- **AgentGateway is not a reproducible local stack** — `prompts/tools/50-agentgateway.md:28` — the repo has no `stacks/cortex-agentgateway/`; the prompt clones an external repo at install time and assumes `index.js --config config/tools.json` at `prompts/tools/50-agentgateway.md:66` — fix: vendor or implement `stacks/cortex-agentgateway/` with pinned code, package files, health endpoint, auth, NATS/Postgres audit, and tests.
- **Dashboard health checkpoint cannot pass** — `prompts/tools/70-dashboard.md:102` — the prompt verifies `/api/health`, but `dashboard/src/app/api/` has `/api/system` and no `/api/health` route — fix: add `dashboard/src/app/api/health/route.ts` or change the spoke to use `/api/system` with the required internal token.
- **Final validation is stale for Debian/local paths** — `prompts/tools/99-final-validation.md:29` — Debian runs `firewall-cmd` even though the install path uses UFW; the same file uses literal `{DOMAIN}` at `:41`, wrong Prometheus path at `:58`, wrong cAdvisor port at `:62`, and wrong Langfuse port at `:83` — fix: update final validation to the current path-based Caddy routes, ports, and Debian UFW behavior.

## High (install completes but feature broken)

- **9router env and auth contract is split** — `prompts/tools/31-9router.md:47` — the spoke writes `NINE_ROUTER_*`, while dashboard requires `NINEROUTER_*` at `dashboard/src/lib/ai/provider-resolver.ts:41`; `templates/scripts/test-9router.sh:15` also requires `NINEROUTER_BASE_URL` and `NINEROUTER_API_KEY` — fix: standardize one env contract and update all prompts/templates.
- **9router port is inconsistent** — `prompts/tools/31-9router.md:48` — the spoke uses `11434`, but `templates/systemd/openclaw-gateway.service:16`, `templates/review-routing.json:4`, and `scripts/cortex-healthcheck.sh:82` use `20128` — fix: pick one canonical 9router listener and update health checks, OpenClaw, dashboard, review routing, and final validation.
- **9router auth is not verified** — `prompts/tools/31-9router.md:80` — the model-list probe omits `Authorization`, so it does not prove inbound LLM auth or master-key wiring — fix: verify `/v1/models` with `Authorization: Bearer $NINEROUTER_API_KEY` and propagate that key into dashboard, OpenClaw, OpenViking, LEANN, agentgateway, and consumer as needed.
- **AgentGateway audit subject mismatch** — `prompts/tools/50-agentgateway.md:98` — checkpoint expects `cortex.audit.*`, while NATS accounts export `agentgateway.audit.>` at `templates/nats/accounts.conf:69`; neither appears in `docs/NATS-CONTRACT.md` — fix: define the audit subject in `docs/NATS-CONTRACT.md`, update NATS accounts, and make AgentGateway publish signed CloudEvents there.
- **Consumer does not actually route through AgentGateway** — `prompts/tools/60-cortex-consumer.md:46` — the prompt asks to verify `agentgateway_url`, but `stacks/cortex-consumer/config.json:1` has no such field and `consumer.js` has no AgentGateway invocation path — fix: add explicit AgentGateway dispatch/tool-enforcement integration or remove it as a consumer prerequisite.
- **Paperclip bridge subscribes to the wrong JetStream stream** — `stacks/cortex-paperclip-bridge/worker.js:29` — bridge defaults `CORTEX_STREAM` to `CORTEX` while status/alerts live in `CORTEX_PAPERCLIP_OPS` per `docs/NATS-CONTRACT.md:222` and `stacks/cortex-consumer/config.json:33` — fix: default bridge status/alerts consumers to `CORTEX_PAPERCLIP_OPS`.
- **CloudEvents contract is not enforced at all publish sites** — `docs/NATS-CONTRACT.md:198` — raw publishes remain in `stacks/cortex-consumer/consumer.js:489`, `:500`, `:929`, `:1028`, and `:1203`; dashboard approval publishes also omit `Nats-Msg-Id` at `dashboard/src/app/api/paperclip/approve/route.ts:139` — fix: use a shared publisher that always wraps, validates, signs, and sets `Nats-Msg-Id`.
- **NATS subject contract has orphans** — `docs/NATS-CONTRACT.md:349` — documented subjects are `cortex.alerts.*`, `cortex.paperclip.status.*`, and `cortex.signals.*`; code still emits `cortex.alert.*`, `cortex.paperclip.accepted.*`, `cortex.approval.*`, and `cortex.health.consumer` at `stacks/cortex-consumer/consumer.js:500`, `:929`, `:1028`, `:1203` — fix: either document and stream these subjects or migrate them to the documented subject set.
- **Graph handoff never fires by default** — `stacks/cortex-consumer/consumer.js:632` — graph dispatch requires a non-empty `.graph-enabled.json`, but role frontmatter currently has `graphEnabled: false` and no graph-enabled roster is present; `45a` then asks for log text `graph dispatch ok` at `prompts/tools/45a-cortex-graph.md:120`, while code logs `[graph] dispatched` at `stacks/cortex-consumer/consumer.js:909` — fix: generate the roster during install and align the checkpoint with real log output.
- **Sandbox handoff is not checkpointed end-to-end** — `prompts/tools/47a-cortex-sandbox.md:89` — consumer env wiring happens after checkpoint 2, so the spoke never proves `cortex.paperclip.work.<role>` reaches sandbox; dispatch depends on the roster at `templates/agent-roles/.sandbox-required.json:1` — fix: restart consumer, publish a sandbox-eligible work event, and require `[sandbox] dispatched` evidence before the checkpoint.
- **Langfuse smoke trace hits a nonexistent endpoint** — `prompts/tools/55-langfuse.md:149` — it posts to `/paperclip/run`, but the bridge endpoint is `/paperclip/heartbeat` at `stacks/cortex-paperclip-bridge/server.js:88` — fix: update the smoke trace payload and endpoint.
- **Telemetry coverage excludes AgentGateway and sandbox** — `prompts/tools/55-langfuse.md:129` — only consumer, paperclip, and graph env files are wired; consumer and bridge call `instrument()` at `stacks/cortex-consumer/consumer.js:1376` and `stacks/cortex-paperclip-bridge/server.js:152`, graph calls it at `stacks/cortex-graph/app/main.py:34`, but sandbox has no telemetry call and AgentGateway has no local code — fix: instrument AgentGateway and sandbox or narrow the telemetry claim.
- **Audit chain has missing state transitions** — `stacks/cortex-graph/app/runner.py:68` — graph lifecycle emits state but does not append audit records; sandbox `/exec` returns execution results at `stacks/cortex-sandbox-runner/app/server.js:119` without audit; dashboard approval updates at `dashboard/src/app/api/paperclip/approve/route.ts:145` without audit append — fix: add `@cortexos/audit.append` or a documented equivalent at every transition.
- **OpenClaw delivery is known broken** — `prompts/tools/60-cortex-consumer.md:123` — consumer still posts to `/sendMessage`, which the prompt says returns 404, so smoke publishes do not reach Telegram/Slack/Discord/WhatsApp — fix: build the adapter sidecar or migrate consumer delivery to the actual OpenClaw RPC API before treating the install as end-to-end.

## Medium (degraded operation, monitoring gaps, etc.)

- **Prometheus checkpoint asks for future targets** — `prompts/tools/20-prometheus.md:115` — it asks for `cadvisor` and `node` targets before `24-cadvisor` and `25-node-exporter` run — fix: move target-UP checks to those spokes or final validation.
- **Exporter spokes do not prove Prometheus target state** — `prompts/tools/24-cadvisor.md:73` and `prompts/tools/25-node-exporter.md:60` — local metrics are checked, but the checkpoint also asks for Prometheus target `UP` without a query command — fix: add Prometheus API checks for each target.
- **Fluent Bit checkpoint lacks Loki query evidence** — `prompts/tools/23-fluent-bit.md:81` — it only tails container logs but asks the operator to confirm logs in Grafana/Loki at `:87` — fix: add a LogQL query against Loki’s HTTP API.
- **Dashboard catalog health URLs are stale** — `dashboard/migrations/002_seed.sql:33` — 9router is seeded at `20128/api/health`, AgentGateway at `15021/healthz/ready`, and env paths under `stacks/*/.env`, while spokes use `.secrets/*.env` and different ports — fix: update seed health URLs/env paths from the actual spokes.
- **Dynamic service seed misses required backends** — `dashboard/scripts/dynamic-seed.js:35` — no mapping exists for `45a-cortex-graph`, `47a-cortex-sandbox`, `60-cortex-consumer`, or `61-smoke-tests`; it only toggles active flags at `dashboard/scripts/dynamic-seed.js:205` and never calls `cortex_set_service_urls` — fix: add backend service rows/mappings and call `SELECT cortex_set_service_urls($CORTEX_DOMAIN)` after seeding.
- **Path-based service URLs are only partially covered** — `dashboard/migrations/011_services_open_url_paths.sql:27` — the function covers dashboard, Grafana, Prometheus, Loki, cAdvisor, Langfuse, and NATS, but backend-only rows are pinned to `#` at `:40`; this is fine for no-UI services, but dynamic seed must not re-expose stale `/agentgateway` from rollback/004 — fix: keep 011 authoritative and run it after dynamic seed.
- **Stale Langfuse references remain** — `docs/POSTGRES-LAYOUT.md:50` and `docs/POSTGRES-LAYOUT.md:83` — docs still reference removed `35a-langfuse.md` — fix: replace with `55-langfuse.md`.
- **`rsync` references remain as mixed messaging** — `templates/scripts/backup-openclaw-account.sh:119` — most install docs say no rsync, but the backup helper still uses rsync for off-host backup — fix: keep it only if intentional and document it as optional backup transport, otherwise replace with `scp`/`tar | ssh`.

## Per-spoke checkpoint verifiability

| Spoke | Checkpoint verifiable? | Issue |
|-------|------------------------|-------|
| 00-preflight | NO | Requires OpenClaw before its installing spoke. |
| 10-os-hardening | YES | Local OS/firewall/sysctl evidence is produced. |
| 11-docker | YES | Docker/Compose smoke evidence is produced. |
| 12-tailscale | YES | Tailscale status/IP evidence is produced. |
| 12a-sops-bootstrap | NO | Laptop-only secret flow conflicts with later VPS decrypt calls; expected env set omits sandbox. |
| 13-caddy | NO | Probes services installed later. |
| 14-postgresql | YES | DB/schema checks are locally verifiable. |
| 15-redis | YES | Redis ping/health evidence is locally verifiable. |
| 16-mongodb | YES | Optional; local Mongo health evidence is verifiable when enabled. |
| 17-dnsmasq | YES | Config/service checks are locally verifiable. |
| 18-fail2ban | YES | Jail/status evidence is locally verifiable. |
| 20-prometheus | NO | Asks for cAdvisor/node targets before those spokes run. |
| 21-loki | YES | Loki readiness is verifiable. |
| 22-grafana | YES | Grafana health/dashboard provisioning is verifiable. |
| 23-fluent-bit | NO | Does not query Loki/Grafana for the log evidence the checkpoint requests. |
| 24-cadvisor | NO | Does not query Prometheus target state. |
| 25-node-exporter | NO | Does not query Prometheus target state. |
| 30-nats | NO | Account placeholders are never generated/replaced. |
| 31-9router | NO | Verifies unauthenticated wrong/inconsistent env contract. |
| 32-openviking | YES | Health checkpoint is verifiable, though 9router env naming should be aligned. |
| 33-leann | YES | Health checkpoint is verifiable, though 9router env naming should be aligned. |
| 34-kernel-browser | YES | Browser/version smoke evidence is verifiable. |
| 40-openclaw | YES | Gateway health evidence is verifiable. |
| 41-openclaw-channels | YES | Channel tests are prescribed. |
| 42-openclaw-openviking | YES | Memory route checks are prescribed. |
| 43-openclaw-memory-core | YES | Memory-core checks are prescribed. |
| 44-openclaw-a2a-gateway | YES | Plugin presence check is prescribed. |
| 45-openclaw-compaction | YES | Compaction checks are prescribed. |
| 45a-cortex-graph | NO | Compose fails standalone and checkpoint log text does not match code. |
| 46-openclaw-codex-watchdog | YES | Service/timer evidence is prescribed. |
| 47-openclaw-foundry | YES | Foundry checks are prescribed. |
| 47a-cortex-sandbox | NO | Missing secret template and no post-wiring end-to-end consumer check. |
| 49-openclaw-account-ops | YES | Account operation checks are prescribed. |
| 50-agentgateway | NO | Assumes unpinned external app and asks for audit subject evidence it never produces. |
| 55-langfuse | NO | Smoke trace endpoint is wrong and telemetry wiring excludes AgentGateway/sandbox. |
| 60-cortex-consumer | NO | Deploy omits `lib/` and `package.json`; expected log strings do not match current code. |
| 61-smoke-tests | NO | Timers are verifiable, but downstream delivery is documented broken. |
| 70-dashboard | NO | `/api/health` route is absent. |
| 80-agent-factory | YES | GitHub-backed evidence is prescribed if credentials are available. |
| 81-projects | YES | Dashboard/project checks are prescribed. |
| 99-final-validation | NO | Uses stale ports, paths, literal `{DOMAIN}`, and Debian firewall command. |

## agentgateway deep-review

- The requested `stacks/cortex-agentgateway/` integration does not exist locally; `50-agentgateway` clones `https://github.com/agentgateway/agentgateway` into `/opt/cortexos/stacks/agentgateway` at `prompts/tools/50-agentgateway.md:28`, so the install is not reproducible from the repo.
- The systemd unit assumes `node index.js --config config/tools.json` at `prompts/tools/50-agentgateway.md:66`, but no pinned package, entrypoint, lockfile, or local health contract proves that command exists.
- Tool taxonomy exists at `templates/agentgateway/tools.json:1`, with destructive controls at `templates/agentgateway/tools.json:129`, but enforcement is not connected to consumer dispatch; `stacks/cortex-consumer/config.json:1` has no AgentGateway URL, and consumer code does not call `/tool/invoke`.
- NATS integration is inconsistent: `50-agentgateway` expects `cortex.audit.*` at `prompts/tools/50-agentgateway.md:98`, while `templates/nats/accounts.conf:69` exports `agentgateway.audit.>` and `docs/NATS-CONTRACT.md` documents neither.
- Postgres integration is unproven: `DATABASE_URL` is written at `prompts/tools/50-agentgateway.md:48`, but no migration or local code shows audit log columns being written.
- Auth is underspecified: `docs/AGENT-GATEWAY.md:50` says requests must authenticate, but `50-agentgateway` only writes `CONFIRMATION_TOKEN_SECRET` at `prompts/tools/50-agentgateway.md:49` and the verify call at `:89` sends no auth token.
- Dashboard catalog does not match the prompt: seed uses `15021/healthz/ready` and `/opt/cortexos/stacks/agentgateway/.env` at `dashboard/migrations/002_seed.sql:36`, while the prompt uses `18800/health` and `/opt/cortexos/.secrets/agentgateway.env`.

## 9router deep-review

- The install prompt writes `NINE_ROUTER_PORT` and `NINE_ROUTER_API_KEY` at `prompts/tools/31-9router.md:48`, but dashboard, the test script, and provider resolver use `NINEROUTER_BASE_URL` and `NINEROUTER_API_KEY` at `templates/scripts/test-9router.sh:15` and `dashboard/src/lib/ai/provider-resolver.ts:41`.
- The service template reads `/opt/cortexos/.secrets/9router.env` at `templates/systemd/9router.service:21`, but passes no explicit port/base-url CLI flag at `templates/systemd/9router.service:16`; the prompt assumes `11434` without proving the process binds there.
- Port references are split: `31-9router`, OpenViking, LEANN, and OpenClaw config use `11434` at `prompts/tools/31-9router.md:80`, `prompts/tools/32-openviking.md:40`, `prompts/tools/33-leann.md:52`, and `prompts/tools/40-openclaw.md:50`; OpenClaw systemd, healthcheck, and review routing use `20128` at `templates/systemd/openclaw-gateway.service:16`, `scripts/cortex-healthcheck.sh:82`, and `templates/review-routing.json:4`.
- Inbound auth is not exercised: the spoke’s verify curl at `prompts/tools/31-9router.md:80` sends no bearer token, while `templates/scripts/test-9router.sh:21` expects `Authorization: Bearer $NINEROUTER_API_KEY`.
- NATS integration is nominal only: `NATS_URL` is written at `prompts/tools/31-9router.md:52`, but no 9router subject is documented in `docs/NATS-CONTRACT.md`, no stream is declared, and no consumer/publisher contract is visible.
- Downstream master-key wiring is incomplete: dashboard rejects AI chat without `NINEROUTER_*` at `dashboard/src/app/api/ai/chat/route.ts:158`, while AgentGateway and consumer do not receive a canonical 9router key/base URL from their prompts.

## Recommended fix order

1. Fix the install graph blockers: `00-preflight`, `13-caddy`, `70-dashboard`, and `99-final-validation`.
2. Normalize secrets: one decrypt model, one env filename per service, add missing `sandbox.env` and `agentgateway.env` templates.
3. Normalize NATS: one compose/config path, generate or remove NKeys, and update `docs/NATS-CONTRACT.md` to match real subjects.
4. Standardize 9router: one port, one env prefix, bearer-auth verification, and downstream key propagation.
5. Make AgentGateway local and pinned under `stacks/cortex-agentgateway/`, then wire auth, NATS audit, Postgres audit, OpenClaw/tool enforcement, and dashboard catalog.
6. Repair consumer deployment and env loading, then remove or implement the AgentGateway dispatch contract.
7. Align JetStream streams/durables and replace raw publish sites with a shared CloudEvents/Nats-Msg-Id publisher.
8. Prove paperclip bridge → consumer → graph/sandbox with generated rosters and a real smoke event.
9. Add missing audit appends and telemetry wiring for graph, sandbox, dashboard approvals, and AgentGateway.
10. Refresh dashboard service catalog and stale docs after the runtime contracts are fixed.
