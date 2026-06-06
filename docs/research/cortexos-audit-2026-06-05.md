# CortexOS Whole-Project Audit — 2026-06-05

Report only. No remediation applied. Assembled from five independent investigator passes:
app-code, prompts, processes, infra, docs/hygiene. Findings are deduplicated across
surfaces where the same root cause spans multiple files; per-surface detail follows the
ranked list; finding counts per input file are in the appendix.

---

## 1. Executive Summary

### Critical

- **C1 — Next.js→SvelteKit cutover left a broken build/deploy path.** Root `Dockerfile` builds a Next.js app that no longer exists; entrypoint COPY targets a missing file. (cross-surface: app/infra/processes/docs)
- **C2 — Installer is dead at step one.** `prompts/tools/00-preflight.md` and 13 distro-selection prompts call `scripts/rebuild/*` and `prompts/os/00-os-selection.md`, neither of which exists; the `:?` gate aborts a fresh operator's shell.
- **C3 — CI gates are green theater or hard-fail.** a11y/contract gates are `--if-present` no-ops on missing scripts; the `compose` gate hard-fails on a missing compose file.
- **C4 — API key interpolated into Python source.** `cortex-qwen-hermes-9router.sh` injects `$KEY` into `python3 -c` source and process args — injection + key exposure in `ps`.
- **C5 — Root helper has no command allowlist.** `cortex-dashboard-root-helper` runs any `command`+`argv` as root over a group-readable socket with no `SO_PEERCRED` check — a turnkey root-RCE primitive by design.
- **C6 — Dashboard service runs root with a hardcoded password and 0.0.0.0 bind.** `cortex-dashboard.service` ships `DB_PASSWORD=testpass`, `User=root`, `HOST=0.0.0.0`, zero systemd hardening.

### Major (top items)

- CSRF guard implemented but not wired into any privileged mutation route (`route-helper.ts`).
- Migration chain confusion: duplicate `003_` migrations, stale `migrate.ts` header, Dockerfile assumes a nonexistent `migrate.js`, dynamic-seed step apparently dropped.
- Referenced-but-absent artifacts: `stacks/cortex-sandbox-runner` (gVisor, empty), `cortex-dashboard-root-helper` source (pyc-only), `scripts/rebuild/`, `prompts/os/`, `scripts/pkg.sh`, `schemas/`.
- `_order.md` vs filesystem drift: 30/30b/30c prompts missing from canonical order; in-prompt Next-pointers disagree.
- Plaintext live credentials + API keys at rest in `.secrets/cortex-credentials.md`; `.sops.yaml` recipients are placeholders.
- Intent layer (CLAUDE.md/AGENTS.md/README/GUIDE) asserts "Next.js dashboard" — false; real stack is SvelteKit 5.

---

## 2. Severity-Ranked Findings (deduplicated)

### CRITICAL

#### C1 — Next.js→SvelteKit drift: broken Docker build + entrypoint (cross-surface)

**Severity:** Critical
**Locations:**
- `Dockerfile:1-110` (whole file builds Next.js)
- `Dockerfile:29` `RUN npm run build:next` — no `build:next` script (`package.json` only `"build":"vite build"`)
- `Dockerfile:30` esbuild `server.ts` — no `server.ts` exists
- `Dockerfile:91,98` `.next` / `next.config.ts` — neither exists
- `Dockerfile:96` `COPY .../docker-entrypoint.sh` — `packages/dashboard/docker-entrypoint.sh` absent in live tree (only under stale `.worktrees/`)
- `release.yml:73` `--exclude='.next'` (stale)

**Issue:** The live `packages/dashboard` is SvelteKit (vite, svelte-check, `svelte.config.js`, adapter-node). Every Next.js reference in the Dockerfile is dead; the build fails at `build:next` and again at the entrypoint COPY. Docker cannot build the current dashboard.

**Evidence:** "`Dockerfile:29 RUN npm run build:next` but `package.json` has no `build:next` (only `"build":"vite build"`); `Dockerfile:30 esbuild server.ts` - no `server.ts` exists; `Dockerfile:91,98 .next / next.config.ts` - neither exists." — audit-processes. "`packages/dashboard/docker-entrypoint.sh` does NOT exist in the live tree (only in stale `.worktrees/`). Build fails at this COPY." — audit-processes.

**Recommended fix:** Rewrite the Dockerfile for SvelteKit adapter-node (`build/index.js`) or delete it if the dashboard ships only as the `cortex-dashboard.service` systemd unit; supply or drop the entrypoint COPY. (Doc/app/package facets of this same drift are tracked in M-DRIFT below; they share the cutover root cause but are separate edits.)

#### C2 — Installer dead at step one: missing scripts/rebuild + prompts/os

**Severity:** Critical
**Locations:**
- `prompts/tools/00-preflight.md:7-11` — runs `scripts/rebuild/inventory.sh`, `validate.sh`, `plan.sh`; dir absent
- `prompts/tools/31-9router.md:42` — references `scripts/rebuild/apply.sh`; absent
- 13 distro-selection prompts (`10,11,14,15,16,20,21,22,23,24-*.md` and others) — `: "${CORTEX_OS_FAMILY:?run prompts/os/00-os-selection.md first}"`; `prompts/os/` absent

**Issue:** The first installer step invokes a directory that does not exist (`scripts/rebuild/` — confirmed `ls: No such file or directory`; `CHECKPOINT-PATTERN.md:2-5` states it "does not exist"). Every distro-selection block uses a `:?` parameter expansion that **aborts the shell** when `CORTEX_OS_FAMILY` is unset, hard-blocking a fresh operator at the first hardening prompt.

**Evidence:** "Entire preflight runs `scripts/rebuild/inventory.sh`... directory `scripts/rebuild/` does not exist." — audit-prompts. "The `:?` parameter expansion **aborts the shell** when the var is unset, so a fresh operator following the order is hard-blocked." — audit-prompts. Evidence quote (`10-os-hardening.md:19`): `: "${CORTEX_OS_FAMILY:?run prompts/os/00-os-selection.md first}"`.

**Recommended fix:** Ship `prompts/os/00-os-selection.md` and `scripts/rebuild/` (or replacements), or rewrite the 13 gates and `00-preflight.md`/`31-9router.md` to the current chat-driven flow.

#### C3 — CI gates are green theater or hard-fail

**Severity:** Critical
**Locations:**
- `ci.yml:225-228,247-251` — Gates 7 (a11y) & 8 (contract) run `pnpm -r --if-present run test:a11y` / `test:contract`; neither script exists in `packages/dashboard/package.json` → green no-ops
- `ci.yml:422-434` — `compose` gate runs `docker compose -f packages/dashboard/docker-compose.yml config`; file does not exist → hard-fail every run

**Issue:** `--if-present` converts "script missing" into "gate passed", so the a11y and contract gates assert coverage they do not provide. The `compose` gate references a missing `-f` target, which is an error not a no-op — CI is either red on main or this job is ignored.

**Evidence:** "`--if-present` makes them green no-ops. These gates assert coverage they do not provide." — audit-processes. "that file DOES NOT EXIST (verified). This gate hard-fails on every run." — audit-processes.

**Recommended fix:** Add the missing scripts or remove gates 7-8; create the compose file or drop the compose gate.

#### C4 — API key interpolated into Python source (secret injection)

**Severity:** Critical
**Locations:**
- `cortex-qwen-hermes-9router.sh:28` (and same pattern `:21`)

**Issue:** `python3 -c "...d['env'][k]='$KEY';..."` interpolates the API key directly into Python source. A key containing `'`, newline, or `${}` breaks the script or enables code injection; the key also lands in `ps`/process args, visible to other users.

**Evidence:** "interpolates the API key directly into Python source. A key containing `'`, newline, or `${}` breaks the script or enables code injection; the key also lands in `ps`/process args (visible to other users)." — audit-processes.

**Recommended fix:** Pass the key via env/stdin (`KEY="$KEY" python3 -c "import os;k2=os.environ['KEY'];..."`).

#### C5 — Root helper has no command allowlist + no peer-credential check

**Severity:** Critical
**Locations:**
- `stacks/cortex-dashboard-root-helper/__pycache__/helper.cpython-314.pyc` — `validate_request` / `execute_command`
- socket `/run/cortexos/dashboard-helper.sock` (`make_socket`, `os.chmod(path, 0o660)`, dir `0o750`)

**Issue:** `validate_request` accepts any non-empty `command` string and any `argv` array; `execute_command` runs `subprocess.run([command]+argv)` as root. No allowlist, no path restriction. The socket has no `SO_PEERCRED`/peer-credential check — any process in the socket's group can drive root command execution. A turnkey root-RCE primitive by design.

**Evidence:** "accepts any `command` (only checks it is a non-empty string) and any `argv`... runs `subprocess.run([command]+argv, ...)` as root. **No allowlist, no command whitelist, no path restriction.**" — audit-infra. "**No `SO_PEERCRED` / peer-credential check**... Any process whose GID matches the socket's group can drive root command execution." — audit-infra. (Source `helper.py` is absent; behavior recovered by decompiling the `.pyc`.)

**Recommended fix:** Add an explicit allowlist (permitted absolute `command` paths + per-command argv shape) and `SO_PEERCRED` peer-UID/GID verification on the socket.

#### C6 — Dashboard service: root + hardcoded password + 0.0.0.0 + no hardening

**Severity:** Critical
**Locations:**
- `templates/systemd/cortex-dashboard.service:16` — `Environment=DB_PASSWORD=testpass`
- `templates/systemd/cortex-dashboard.service:12` — `User=root`
- `templates/systemd/cortex-dashboard.service:14` — `Environment=HOST=0.0.0.0`
- whole unit — no hardening directives

**Issue:** A credential placeholder (`testpass`) is shipped in a template that becomes the live unit, contradicting the SOPS+age posture. The control-plane dashboard runs as root, binds all interfaces, and has zero systemd confinement (`NoNewPrivileges`, `ProtectSystem`, `PrivateTmp`, `CapabilityBoundingSet`, etc. all missing). Because the dashboard runs as root, the root-helper boundary (C5) is moot today.

**Evidence:** "`Environment=DB_PASSWORD=testpass` hardcoded in the unit file... also contradicts the SOPS+age secrets posture." — audit-infra. "**No hardening directives whatsoever**... A root service with zero confinement." — audit-infra.

**Recommended fix:** Move `DB_PASSWORD` to `EnvironmentFile=` from SOPS-decrypted secrets; bind loopback if Caddy fronts it; add systemd hardening consistent with the capabilities the dashboard genuinely needs.

---

### MAJOR

#### M-DRIFT — Next.js-vs-SvelteKit intent-layer drift (cross-surface, dedup of C1 doc/app facets)

**Severity:** Major
**Locations:**
- App: `packages/cortex-dashboard/` orphan Next.js scaffold (no `package.json`, not a workspace member; untracked `.next/`+`src/`; tracked `TECH_STACK.md` describes a SvelteKit stack)
- Docs: `CLAUDE.md:12`, `CLAUDE.md:63-65`; `AGENTS.md:5,27`; `README.md:98,129,143`; `docs/GUIDE.md:142,256`
- CI: `ci.yml:50-52` `SVELTE_PKG: '@cortexos/cortex-dashboard'`, `ci.yml:114-116` markdown-lint globs over nonexistent `packages/cortex-dashboard/docs/**`

**Issue:** Every intent-layer doc claims "Next.js dashboard"; the real stack is SvelteKit 5 at `packages/dashboard/`. A stale `packages/cortex-dashboard/` Next.js relic sits beside the real package (4 tracked docs + untracked `AGENTS.md`), and `README.md:143`'s project tree still points readers at it. CI's `SVELTE_PKG` env and markdown globs reference the wrong/nonexistent package, silently weakening the gate.

**Evidence:** "`CLAUDE.md:12` - 'Next.js dashboard for server control' - FALSE. Real dashboard is SvelteKit 5." — audit-docs. "Orphaned Next.js scaffold... sitting beside the real SvelteKit `packages/dashboard/`; creates confusion and stale-tech signal." — audit-app.

**Caveat (do not over-rename):** The systemd unit `cortex-dashboard.service`, the Docker service, and the seed slug are *legitimately* named `cortex-dashboard`; only the `packages/cortex-dashboard/` directory is the stale leftover. Disambiguate before any rename.

**Recommended fix:** Correct "Next.js"→"SvelteKit 5" across CLAUDE.md/AGENTS.md/README/GUIDE; delete or archive `packages/cortex-dashboard/` after eyeballing its 4 docs; fix `SVELTE_PKG`→`@cortexos/dashboard` and the markdown globs→`packages/dashboard/docs/**`.

#### M-MIG — Migration chain confusion (dedup: dup-003 + stale header + Dockerfile migrate.js + dropped seed)

**Severity:** Major
**Locations:**
- `packages/dashboard/migrations/003_incus_instances.sql:1` & `003_session_indexes.sql:1` — duplicate `003` number
- `src/lib/server/db/migrate.ts:6,8,67,237` — header cites nonexistent `scripts/migrate.js` and `src/lib/db/migrate.ts` as the "runner convention"
- `Dockerfile` — assumes `scripts/migrate.js` as the runner (does not exist)
- Live tree has no `dynamic-seed.js`; the scope's `docker-entrypoint + migrate.js + dynamic-seed.js` chain exists only under `.worktrees/*`

**Issue:** Two migrations share `003` (independent DDL, harmless today, but a latent ordering hazard and untested — the runner sorts by filename). The `migrate.ts` header documents two runners that no longer exist (stale manifest). The Dockerfile assumes the wrong runner. The dynamic-seed step appears dropped in the SvelteKit cutover, and how `cortex-dashboard.service` actually triggers migrations is untraced.

**Evidence:** "Two migrations share number `003`... the runner sorts by filename and the collision is a latent hazard." — audit-app. "the live migration runner is `src/lib/server/db/migrate.ts`, not the `scripts/migrate.js` the Dockerfile assumes." — audit-processes.

**Recommended fix:** Renumber `003_session_indexes.sql`→`004_` (004/005 free); refresh the `migrate.ts` header; correct the Dockerfile assumption; confirm the production migration trigger and whether dynamic-seed was intentionally dropped; add a runner test over the real `migrations/` dir.

#### M-ABSENT — Referenced-but-absent artifacts (grouped)

**Severity:** Major (individual items range Minor→Critical-adjacent; grouped here as a class)
**Locations / status:**
- `stacks/cortex-sandbox-runner/` — only `.DS_Store`; gVisor `policy.js`/`server.js` MISSING. Cited by `CLAUDE.md:26`, `AGENTS.md:11` as the untrusted-code sandbox. Security-relevant: docs promise a sandbox not in the repo. (unauditable)
- `stacks/cortex-dashboard-root-helper/` — only compiled `.pyc`; `helper.py` / `test_helper.py` MISSING (feeds C5)
- `scripts/rebuild/` — MISSING (feeds C2; also `ARCHITECTURE.md`, `REQUIREMENTS.md`, `SETUP.md`, `CHANGELOG.md:6-7`, `manifests/rebuild/`)
- `prompts/os/00-os-selection.md` — MISSING (feeds C2; 13 prompts)
- `prompts/tools/99-final-validation.md` — MISSING; cited by `20-prometheus.md:135`, `23-fluent-bit.md:130`, `24-cadvisor.md:119`; absent from `_order.md`
- `scripts/pkg.sh` — MISSING; CLAUDE.md/AGENTS.md mandate its use; `distro-matrix.yml` parse-checks it
- `scripts/os-detect.sh`, `scripts/__tests__/os-detect.bats`, `scripts/schema-version-check.js`, `schemas/`, `scripts/verify-artifact.sh` — MISSING; referenced by `distro-matrix.yml`, `schema-check.yml`, `release.yml:197`
- `packages/dashboard/docker-compose.yml` — MISSING (feeds C3 compose gate)
- Doc links: `docs/SECRETS.md`, `docs/CLI-TOOLS.md`, `docs/DOCKER-GUIDE.md` — MISSING; referenced by `CLAUDE.md:25`, `AGENTS.md:9`, `docs/README.md:58-59`, `docs/AI-SETUP.md:250`, `README.md:68`

**Issue:** A large class of docs, prompts, workflows, and the Dockerfile reference files that do not exist in the tree. The most security-relevant: the gVisor sandbox and the root-helper source are both absent, so the two highest-risk components named in scope cannot be verified from this checkout.

**Evidence:** "the source code for the two security-critical components named in the scope does not exist in this working tree." — audit-infra. "`stacks/cortex-sandbox-runner` being empty is a security-relevant gap: docs promise a gVisor sandbox... that is not actually in the repo." — audit-docs.

**Recommended fix:** Per item, decide planned-future vs dead; either commit the implementation/script or strip the reference. Locate `helper.py` and the sandbox-runner source (confirm whether host-only) before further security work.

#### M-PORTS — see reconciled port-allocation section (§3). Net: no active host-bound collision; latent Langfuse:3000-vs-Grafana conflict.

#### M-CSRF — CSRF guard implemented but never wired into privileged routes

**Severity:** Major
**Locations:** `src/lib/server/route-helper.ts:104-130` (auth step, no CSRF); guard that exists but is unused: `src/lib/server/auth/csrf.ts:76` (`requireCsrf`, called only from login/logout)

**Issue:** The `defineRoute` wrapper backing all privileged mutations (docker/systemd/incus/packages/approvals/services) never calls the implemented double-submit `requireCsrf`. `hooks.server.ts` does not enforce CSRF globally; session cookie is `SameSite=Lax`, which does not block top-level cross-site POSTs. The team built a stronger guard than they wired in.

**Evidence:** "The double-submit CSRF guard... is fully implemented but only called from `login` and `logout` routes. The shared `defineRoute` wrapper... does NOT call it." — audit-app.

**Recommended fix:** Add a CSRF enforcement step in `defineRoute` for non-safe methods, passing `event.locals.session?.csrfToken` as `expected`. (Severity moderated by SvelteKit's framework-level origin check, unverified against the installed version.)

#### M-SECRETS — Plaintext live credentials at rest + non-functional SOPS config

**Severity:** Major
**Locations:**
- `.secrets/cortex-credentials.md` — plaintext SSH password, Webmin password, Grafana admin, DB passwords, live provider API keys (ZAI, MiniMax). Gitignored (`.gitignore:93`) so not committed, but unencrypted at rest.
- `.sops.yaml:12-13` — age recipients are placeholders (`age1placeholder0000...`); config non-functional as shipped

**Issue:** Plaintext live credentials sit on disk, directly contradicting the SOPS+age posture in CLAUDE.md; anyone with checkout read access has the keys to the host. The `.sops.yaml` recipients are placeholders, so encryption would fail or produce undecryptable output.

**Evidence:** "**plaintext live credentials on the dev machine**: SSH password... and **live provider API keys**... directly contradicting the SOPS+age posture." — audit-infra. "age recipients are **placeholders**... non-functional as shipped." — audit-infra.

**Recommended fix:** Rotate the exposed keys/passwords; populate real age recipients and verify SECRETS.md round-trips; consider moving the creds file to SOPS-encrypted at rest.

#### M-ORDER — `_order.md` vs filesystem + in-prompt Next-pointer divergence

**Severity:** Major
**Locations:** `prompts/tools/_order.md` (missing `30-hermes-webui.md`, `30b-fzf.md`, `30c-boxbox.md` rows); `28-db-exporters.md:113`, `31-9router.md` chain skips 30*; `30-hermes-webui.md:14-15` cites missing `12-tailscale-serve.md`/`40-hermes.md`; `16-mongodb.md:45` points at nonexistent `17-dnsmasq.md`

**Issue:** Two navigation systems (`_order.md` canonical order vs in-prompt Next-pointers) disagree. An operator running strictly top-to-bottom never installs Hermes Web UI, fzf, or BoxBox; another following Next-pointers gets a different set. Several prerequisites and next-pointers reference prompts that do not exist.

**Evidence:** "Files present in `tools/` but **absent from `_order.md`**: `30-hermes-webui.md`, `30b-fzf.md`, `30c-boxbox.md`... An operator running strictly top-to-bottom never installs Hermes Web UI, fzf, or BoxBox." — audit-prompts.

**Recommended fix:** Pick one canonical navigation source; add 30/30b/30c rows; fix `16-mongodb.md` next-pointer; correct or ship `30-hermes-webui.md` prerequisites.

#### M-CONDDEP — Unconditional MongoDB dependency on an optional component

**Severity:** Major
**Locations:** `prompts/tools/28-db-exporters.md:14,51` (hard prereq + unconditional mongo-exporter) vs `16-mongodb.md:5` (`mongodb=yes` gate, optional)

**Issue:** `28-db-exporters.md` hard-requires MongoDB and deploys `cortex-mongo-exporter` unconditionally, but MongoDB is explicitly optional. On a MySQL-only / no-mongo host the exporter crash-loops and CHECKPOINT 1's `docker ps cortex-mongo` check fails.

**Evidence:** "On a MySQL-only or no-mongo host, `cortex-mongo-exporter` will crash-loop and CHECKPOINT 1's `docker ps cortex-mongo` check fails." — audit-prompts.

**Recommended fix:** Make the mongo exporter and its prereq conditional on `mongodb=yes`.

#### M-HONCHO — Honcho embeddings base-URL gateway mismatch

**Severity:** Major
**Locations:** `prompts/tools/32-honcho.md:61,65,...,91,180`

**Issue:** Chat/deriver/summary/dialectic/dream use `http://172.17.0.1:11434` (docker0), but `EMBEDDING_MODEL_CONFIG__OVERRIDES__BASE_URL=http://172.30.0.1:11435/v1` and the in-container verify use `172.30.0.1:11435` — a non-default network gateway that only exists if a custom network is created. If the embeddings proxy binds `172.17.0.1`, embeddings silently fail while chat works.

**Evidence:** "`172.30.0.1` is a non-default Docker network gateway that only exists if a custom network is created; if the embeddings proxy binds `172.17.0.1`, embeddings silently fail while chat works." — audit-prompts.

**Recommended fix:** Reconcile the embeddings gateway IP with the proxy's actual bind; document the custom network if `172.30.0.1` is intentional.

#### M-OBOT — Stale AgentGateway removal step on greenfield installs

**Severity:** Major
**Locations:** `prompts/tools/50-obot.md:88-99` (Step 8), `:7` (Step 7)

**Issue:** Step 8 treats `cortex-agentgateway` as a live service to `systemctl stop/disable` + `rm`, but the header says Obot replaces the previous custom agentgateway. On rebuilt/greenfield hosts these commands print errors; Step 7 assumes an allowlist the operator no longer has.

**Evidence:** "If agentgateway is already retired on rebuilt hosts, these `systemctl stop/disable` + `rm` commands are stale and will print errors." — audit-prompts.

**Recommended fix:** Gate the removal on "if the unit exists" or drop the step on greenfield installs.

#### M-HERMES-PREREQ — 30-hermes-webui prerequisites reference missing prompts

**Severity:** Major
**Locations:** `prompts/tools/30-hermes-webui.md:14-15`

**Issue:** Prerequisites cite `12-tailscale-serve.md` and `40-hermes.md`; neither exists in `tools/`. The "Hermes agent runtime reachable on 127.0.0.1:8932" prerequisite has no install prompt.

**Evidence:** "Prerequisites cite `12-tailscale-serve.md` and `40-hermes.md`. Neither file exists in `tools/`." — audit-prompts.

**Recommended fix:** Ship the missing prompts or correct the prerequisite list.

#### M-99VAL — `99-final-validation.md` cited but never shipped

**Severity:** Major
**Locations:** `20-prometheus.md:135`, `23-fluent-bit.md:130`, `24-cadvisor.md:119`

**Issue:** Three prompts defer end-to-end/consolidated validation to `99-final-validation.md`, which does not exist and is absent from `_order.md`. Operators defer checks to a pass that was never shipped.

**Evidence:** "Operators are told to defer checks to a validation pass that was never shipped." — audit-prompts.

**Recommended fix:** Create `99-final-validation.md` and add to `_order.md`, or remove the deferrals.

#### M-IMGPIN — Hermes Web UI tag pin fragility

**Severity:** Major
**Locations:** `prompts/tools/30-hermes-webui.md:74,100,135`; `60-incus-project.md:155`

**Issue:** Image pinned to `ghcr.io/nesquena/hermes-webui:v0.51.280` with prompt text noting "5+ releases/day" upstream cadence. A homelab pulling a specific high-churn tag months later risks the tag being garbage-collected upstream.

**Evidence:** "A homelab pulling a specific 5-releases-per-day tag months later risks the tag being garbage-collected upstream." — audit-prompts.

**Recommended fix:** Document a digest pin or a known-good-tag refresh procedure.

#### M-ORPHAN — Orphaned Next.js scaffold beside the real dashboard

**Severity:** Major
**Locations:** `packages/cortex-dashboard/` (tracked: 4 `docs/*.md`; untracked: `.next/`, `src/`, `AGENTS.md`, `node_modules/`, `tsconfig.tsbuildinfo` 612 KB)

**Issue:** Abandoned Next.js scaffold with no `package.json`, not a pnpm workspace member, last touched 2026-06-03 ("M0 discovery"). Its tracked `TECH_STACK.md` describes a SvelteKit stack, mixing a Next.js build dir with Svelte-targeting docs. (Closely related to M-DRIFT; listed separately as a deletion/archive action.)

**Evidence:** "Orphaned Next.js scaffold (untracked `.next/`+`src/`, no `package.json`, not a workspace member) sitting beside the real SvelteKit `packages/dashboard/`." — audit-app.

**Recommended fix:** Delete the directory (or move the 4 M0 docs to `docs/_archive/`) and remove untracked `AGENTS.md`/`.next`/`src` after a brief eyeball.

#### M-WF-PR — DEPRECATED workflows NPE on their only trigger

**Severity:** Major
**Locations:** `gate-enforcement.yml:23,55`, `ai-review-request.yml:18`

**Issue:** These `workflow_dispatch`-only workflows read `context.payload.pull_request` / `pr.labels` / `!github.event.pull_request.draft`, but on `workflow_dispatch` there is no `pull_request` payload — `pr.labels` throws `Cannot read properties of undefined`. The declared `pr_number` input is never used. Broken on their only trigger (lower practical impact since DEPRECATED).

**Evidence:** "`gate-enforcement.yml:23 const pr = context.payload.pull_request; ... pr.labels` throws `Cannot read properties of undefined`." — audit-processes.

**Recommended fix:** Fetch the PR via `github.rest.pulls.get({pull_number: inputs.pr_number})` or leave deprecated/disabled.

#### M-CI-META — CI gate-count / coverage-enforcement claims unverified; wrong package path

**Severity:** Major
**Locations:** `ci.yml:18` ("13+1 blocking gates"), Gate 6 `≥95%` coverage claim; `ci.yml:50-52,114-116` (`SVELTE_PKG`/markdown globs — see M-DRIFT)

**Issue:** Gate 6 claims 95% coverage enforced "in vitest.config.ts"; enforcement is real only if `vitest.config.ts` sets thresholds, which was not verified. `--if-present` runs `test:coverage` but will not fail without wired thresholds.

**Evidence:** "Coverage enforcement is only real if `vitest.config.ts` sets thresholds... Not verified end-to-end." — audit-processes.

**Recommended fix:** Confirm `vitest.config.ts` `coverage.thresholds` are set to 95.

#### M-DISTROMATRIX — distro-matrix / schema-check workflows reference missing scripts

**Severity:** Major
**Locations:** `distro-matrix.yml:11-19,35-48` (`scripts/os-detect.sh`, `scripts/pkg.sh`, `scripts/__tests__/os-detect.bats` — all missing); `schema-check.yml:31-38` (`schemas/*.json`, `scripts/schema-version-check.js` — both missing)

**Issue:** Both workflows parse-check/iterate files that do not exist; they fail if ever dispatched (path filters keep them mostly dormant). CLAUDE.md mandates `scripts/pkg.sh`, which is absent. (Feeds M-ABSENT.)

**Evidence:** "Triggers on and parse-checks `scripts/os-detect.sh` and `scripts/pkg.sh`, both MISSING... `bats scripts/__tests__/os-detect.bats` - that file is MISSING too." — audit-processes.

**Recommended fix:** Add the scripts or remove the workflow references and the CLAUDE.md mandate.

#### M-INCUS-HARDEN — incus-create-project.sh shell + supply-chain gaps

**Severity:** Major
**Locations:** `incus-create-project.sh:5` (`set -e` only, no `-uo pipefail`); `:120` (`curl -fsSL https://tailscale.com/install.sh | sh` as root, unpinned); `:181-185` (`TELEGRAM_BOT_TOKEN`/`CHAT_ID` into world-readable `/tmp/hermes-config.yaml`)

**Issue:** Missing `-u`/`-o pipefail` masks unset-var and pipe failures (all other audited scripts use `set -euo pipefail`). Remote script piped to shell as root with no checksum/pin. Telegram secrets written to world-readable `/tmp` during the pre-push window.

**Evidence:** "`set -e` only; missing `-u` and `-o pipefail`... `curl -fsSL https://tailscale.com/install.sh | sh` - pipes remote script to shell as root with no checksum/pin." — audit-processes.

**Recommended fix:** `set -euo pipefail`; download-verify-then-run the installer; `umask 077`/`mktemp` for the config file.

---

### MINOR

- **m1** `src/lib/server/db/migrate.ts:6,8,67,237` — stale header cites nonexistent `scripts/migrate.js` / `src/lib/db/migrate.ts` as the runner convention. (also audit-processes `migrate.ts:6-9,67,237`) → update header to reflect the sole runner. *(folded into M-MIG; logged here as the doc-comment facet)*
- **m2** `src/lib/server/db/__tests__/migrate.test.ts:54-70` — tests use synthetic temp dirs, never exercise committed `migrations/*.sql`; duplicate-003, LAN-IP placeholder, TimescaleDB filtering uncovered. → add a real-dir runner test.
- **m3** `packages/paperclip-adapter/package.json` — only non-`private` package; may leak on publish. → add `"private": true` if not intended for publish.
- **m4** `packages/cortex-mail-guardian/src/telegram.ts:81` — bot token embedded in request path (`/bot${token}/...`); standard for Telegram but ensure URLs/paths are never logged. → verify redaction covers the path.
- **m5** `prompts/tools/56-pgadmin.md:91` — Next-pointer "→ 58-mongo-express.md" skips `57-redisinsight.md` (`_order.md` orders 56→57→58). → fix Next to 57.
- **m6** `prompts/tools/25-node-exporter.md:46` & `28-db-exporters.md:93` — missing `/prometheus` route-prefix; bare `/api/v1/targets` returns 404 (Prometheus set `--web.route-prefix=/prometheus`). → add prefix.
- **m7** `prompts/tools/15-redis.md:88,95` — verify/CHECKPOINT quote literal placeholder `{REDIS_PASSWORD}`; operator may paste braces. → use `$REDIS_PASSWORD` from env consistently.
- **m8** `prompts/tools/30b-fzf.md:175`, `30c-boxbox.md:330,332` — authoring TODOs ("see the patch in `git show`", "update docs/APPS.md/CONFIG.md/seed") leaked into operator-facing install steps. → move to a developer changelog.
- **m9** `prompts/tools/30c-boxbox.md:328` — Next-pointer points at itself. → point at the actual next prompt.
- **m10** `prompts/tools/30c-boxbox.md:255-270` — malformed placeholder `user_jwt_file { users { ... } }` Caddy block alongside real `htpasswd_file`; pasting as-is yields an invalid Caddyfile. → delete placeholder block.
- **m11** `prompts/tools/50-obot.md:46,65,70` — Obot on `:8090` with no port-free CHECKPOINT (inconsistent with house pattern). → add a port-8090-free check.
- **m12** `prompts/00-bootstrap.md:33,41,63-72` — "legacy Next.js" section is correct *retirement* documentation, NOT a stale instruction. No action (noted because brief flagged Next.js).
- **m13** `Dockerfile:3,10,79` — `NEXT_TELEMETRY_DISABLED=1` and "no host-prebuilt Next assets" comment inert for SvelteKit. → remove. *(folded into C1)*
- **m14** `ci.yml:348` — `category: '/language:${{ matrix.language }}'` but the in-ci `codeql` job defines no matrix → category becomes `/language:`. (standalone `codeql.yml:18-23` is correct). → add matrix or hardcode.
- **m15** `ci.yml:201,204` — `fail_ci_if_error: true` on Codecov with optional token; public-uploader rate-limit fails the coverage gate for infra reasons. → `fail_ci_if_error: false` or require token.
- **m16** `workflow-pipeline.yml:18-27` — reads `github.event.label.name` / `context.payload.label`, absent on `workflow_dispatch`; job skips or NPEs. Dead (DEPRECATED).
- **m17** `release.yml:73,197` — `--exclude='.next'` (stale) and references `scripts/verify-artifact.sh` (missing) in release notes. → remove/repoint. *(.next facet folded into C1; verify-artifact into M-ABSENT)*
- **m18** `cortex-auto-update.sh:147` — unquoted `$freeze` word-splits intentionally; malformed freeze line could inject args. Low risk (local venv). → acceptable with comment.
- **m19** `cortex-backup.sh:51` — `exec > >(tee -a "$LOG_FILE") 2>&1` under `set -e`+`pipefail`; tee subshell exit not reaped, log may truncate on early `exit 2`. Logging-only.
- **m20** `incus-create-project.sh:60` — GitHub token read via `read -p` (echoes). → `read -rsp`.
- **m21** `incus-create-project.sh:190,211,213` — many unquoted `$PROJECT_NAME` in paths/unit names; a name with spaces breaks silently. → quote consistently.
- **m22** `check-mock-leaks.sh:33,45` — `ALLOWLIST_REGEX` anchored `^src/...` but `grep -RInE` emits absolute paths, so the allowlist never excludes anything (false leak reports or inert filter). → strip `$SRC_DIR` prefix before filtering.
- **m23** `templates/systemd/boxbox.service:33` & `hermes-webui.service:29` — `ExecReload=/usr/bin/docker compose pull && ... up -d`; `&&` is passed as a literal argv to `docker compose` (no `/bin/sh -c`), so reload silently does the wrong thing. `hermes-webui.service` also has no `User=` (runs root). → wrap in `/bin/sh -c '...'`; add `User=`.
- **m24** `prompts/tools/60-incus-project.md:27-28` — instances use `security.nesting=true` + `raw.lxc` `/dev/net/tun` allow; nesting weakens isolation (acceptable for use case, attack-surface expander). Instances otherwise unprivileged (good).
- **m25** `.sops.yaml:10` — `path_regex` only matches `templates/.secrets/*.enc.yaml`; an encrypted secret placed elsewhere gets no creation rule and could be saved in plaintext. → broaden or document.
- **m26** `.gitleaks.toml:14` — allowlists entire `docs/CREDENTIALS.md` (and `docs/SECRETS.*.md`) by name; real secrets in those files would not be caught. → narrow the allowlist.
- **m27** `prompts/tools/60-incus-project.md:41` (`~/.ssh/id_ed25519`) vs `.secrets/cortex-credentials.md:11-14` (`~/.ssh/id_rsa`) — inconsistent host-key reference. → reconcile.
- **m28** `docs/APPS.md:78` / `CLAUDE.md`/`AGENTS.md` — dangling `55-langfuse.md` reference; latent Langfuse:3000-vs-Grafana conflict (see §3). → resolve the reference, decide Langfuse host port now.
- **m29** Git-history hygiene — `.omx/state/session.json` (committed `6446260`, removed `047cb6d`): stale UUID + dead PID `95251` + local path `/Users/heitor/.../homeos`. Low sensitivity. 22 gitleaks hits all false positives (test fixtures, truncated JWT examples, DevTools `?token=` URL, curl auth-header patterns). `.git` is 21 MB / 633 commits. → no history rewrite; optionally add the false-positive patterns to `.gitleaks.toml`.

---

## 3. Reconciled Port-Allocation Section (prompts table ∪ infra map)

Two investigators produced port tables from different sources: prompts/install-time (audit-prompts) and infra/credentials/units (audit-infra). Reconciled below. **Bind:** `lo`=127.0.0.1, `all`=0.0.0.0, `proxy`=via Caddy, `?`=not explicitly bound in evidence.

| Port | Service | Bind | Source(s) | Notes / conflict flag |
|---|---|---|---|---|
| 22 | SSH (`{SSH_PORT}`) | host | 10-os-hardening.md:155 | placeholder, default 22 |
| 80 | Caddy HTTP redirect | all | creds:36 | →443 |
| 443 | Caddy reverse proxy | all | creds:36 | Tailscale auto-TLS |
| 1933 | OpenViking API | lo | creds:42,78 | proxied |
| **3000** | **Grafana (prompts) / container-internal (infra)** | lo | 22-grafana.md:66; creds:223 | **RECONCILED CONFLICT:** prompts say Grafana on host :3000; infra says Grafana container `3000→host 3100` to avoid the clash. Treat host :3000 as the *latent* conflict slot (see Langfuse below). |
| 3080 | Dashboard (SvelteKit) | **all (0.0.0.0)** | 70-dashboard.md:25,131; unit:14, creds:39 | NOT 3000; C6 flags 0.0.0.0 |
| 3100 | Loki HTTP (prompts) / Grafana host (infra) | lo / all | 21-loki.md:82; creds:47,221,223 | **CONFLICT FLAG:** prompts assign 3100 to Loki HTTP; infra assigns 3100 to Grafana host map. Reconcile — both claim 3100. |
| 3200 | Loki (infra) | lo | creds:233 | infra places Loki at 3200; prompts at 3100 — reconcile Loki's actual port |
| 3306 | MySQL | lo | 16a-mysql.md:5; creds:202 | optional; root host `%` internally |
| 3420 | Dockhand | proxy | creds:46 | |
| 4100/4101 | AgentGateway MCP/aux | lo | creds:51,113,115 | |
| 4317/4318 | OTel collector gRPC/HTTP | ? | creds:246 | |
| 5050 | pgAdmin | lo | 56-pgadmin.md:26 | |
| 5432 | PostgreSQL | lo | 14-postgresql.md:43,83; creds:188 | |
| 5540 | RedisInsight | lo | 57-redisinsight.md:34 | |
| 6333 | Qdrant (planned) | lo | mavis plan:114 | not yet deployed |
| 6379 | Redis | lo | 15-redis.md:57; creds:195 | |
| 8020 | OpenViking UI | proxy | creds:43 | |
| 8081 | cAdvisor (host) | lo | 24-cadvisor.md:52 | host 8081→container 8080 (Caddy owns 8080) |
| 8082 | phpMyAdmin | lo | 59-phpmyadmin.md:47 | |
| 8083 | mongo-express (host) | lo | 58-mongo-express.md:5 | host 8083→container 8081 |
| 8090 | Obot | tailnet/lo | 50-obot.md:65,70 | no port-free checkpoint (m11) |
| 8091 | cortex-sandbox-runner healthz | lo | 47a-sandbox:12 | **source absent from tree** (M-ABSENT) |
| 8096 | Jellyfin | proxy | creds:48 | |
| 8123 | Home Assistant | proxy | creds:49 | |
| 8200 | BoxBox | lo | 30c-boxbox.md:53,196; mavis | |
| 8787 | Hermes Web UI (container) | - | 30-hermes-webui.md:141; 60-incus:182 | mapped from 18787/8933 |
| 8889 | Hindsight API | lo | creds:44,129 | proxied |
| 8932 | Hermes agent runtime / per-profile gateway | lo | 60-incus:87; 30-hermes-webui.md:15 | install prompt missing (M-HERMES-PREREQ) |
| 8933 | Hermes Web UI per-profile (host map) | lo | 60-incus:166,182 | `127.0.0.1:8933:8787` — correctly loopback |
| 9080 | Promtail | ? | creds:238 | |
| 9081/9081 | cAdvisor (FQDN, infra) | all | creds:253 | infra exposes cAdvisor on FQDN at 9081; prompts use host 8081 — **reconcile cAdvisor host port** |
| 9090 | Prometheus | lo | 20-prometheus.md:92; creds:229 | `/prometheus` route-prefix (m6) |
| 9093 | Cockpit | all | creds:176 | exposed on FQDN |
| 9096 | Loki gRPC | container | 21-loki.md:43 | internal |
| 9100 | Node Exporter | 0.0.0.0/? | 25-node-exporter.md:33; creds:242 | host network |
| 9104 | MySQL exporter | ? | creds:211 | |
| 9121 | redis-exporter | lo | 28-db-exporters.md:21 | |
| 9187 | pg-exporter | lo | 28-db-exporters.md:20 | |
| 9216 | mongo-exporter | lo | 28-db-exporters.md:22 | conditional bug (M-CONDDEP) |
| 9999 | Hindsight UI | proxy | creds:45,130 | |
| 10000 | Webmin | all | creds:182 | HTTPS, FQDN |
| 11434 | 9Router AI gateway | all/FQDN | 31-9router.md:9; creds:41 | proxied + direct |
| 11435 | Ollama (Vulkan, direct) | lo | 31-9router.md:36; 32-honcho.md:26 | not installed by any shipped prompt; embeddings IP mismatch (M-HONCHO) |
| 15000 | AgentGateway Admin UI | lo | creds:50,116 | |
| 15020/15021 | AgentGateway envoy admin/health | lo | creds:117-118 | |
| 18443 | OpenClaw gateway HTTPS | all | creds:36,55 | direct |
| 18690 | Honcho API | lo | 32-honcho.md:18,53 | |
| 18787 | Hermes Web UI (prompts host map) | lo | 30-hermes-webui.md:57,141 | host 18787→container 8787 |
| 18789 | OpenClaw local API | lo | creds:57 | proxied |
| 18800 | AgentGateway (host-services) | ? | host-services.env:18 | |
| 24224 | Fluent Bit forward | lo | 23-fluent-bit.md:76 | |
| 27017 | MongoDB / FerretDB | lo | 16-mongodb.md:66; creds:214 | infra: **auth disabled** (localhost-only) |

**Port-conflict findings:**
- **No active host-bound collision** across either source (both investigators agree). Intentional near-misses documented: cAdvisor 8081 (Caddy owns 8080), Hermes per-profile 8933 (vs 8932 agent runtime).
- **Cross-source reconcile items (flagged, not yet resolved):** (a) **:3000 / :3100 / :3200** — prompts and infra disagree on Grafana vs Loki port assignments; needs a single source of truth. (b) **Grafana :3000** is the latent conflict slot: infra moved Grafana to host 3100 specifically to avoid :3000; if `55-langfuse.md` (M-ABSENT/m28) is authored to bind Langfuse web on its default **:3000**, and any change moves Grafana back to :3000, they collide. Currently inert. (c) **cAdvisor host port** — 8081 (prompts) vs 9081 FQDN (infra).
- **Services on 0.0.0.0 relying on Tailscale/host-firewall (not bind restriction):** dashboard 3080, Webmin 10000, Cockpit 9093, cAdvisor (9081), OpenClaw 18443, 9Router 11434.

---

## 4. Per-Surface Sections (remaining detail)

### 4.1 App code (`packages/dashboard`, `contracts`, small packages)

Security posture of the SvelteKit dashboard is otherwise strong: command execution is allowlist-first via `execFile`/`execFileSync` (no shell), denylist + smuggling detection (`policy/index.ts:111-128`, `validateShellArg`), approval gates, audit logging, rate limiting. Auth: HttpOnly 32-byte CSPRNG session token, constant-time CSRF compare (`safeCsrfEqual`), rolling 30-day expiry, 60s PAM role re-validation (SR-011/012), probabilistic session GC, security headers per response. No hardcoded secrets in `dashboard/src`; no mock leaks to prod (guarded); zero TODO/FIXME in server code; no committed build artifacts. Seed migration `009` port-discrepancy concern was **refuted** (uses named bind-port env vars, not a hardcoded conflicting port). `contracts/` is a clean single-source schema package consumed via `contracts-bridge.ts`.

Latent coupling risk: `renderArgv` does not itself re-run smuggling detection on bound placeholders — it trusts each route to have called `validateShellArg`. Sampled routes (docker/actions) do; a future `defineRoute` that binds a `<placeholder>` without `validateShellArg` would bypass smuggling detection (bridge only catches literal `bash -c`). Pattern risk, not a confirmed per-route defect (route tree was sampled, not exhausted). `migrate.ts:136` path-containment `startsWith(opts.dir)` is theoretically weak without a trailing separator, but `readdirSync` already constrains inputs.

Findings here: M-CSRF, M-ORPHAN, M-MIG (dup-003 facet), m1, m2, m3, m4.

### 4.2 Prompts (34 files under `prompts/` and `prompts/tools/`)

Highest-impact class is broken references to nonexistent files (C2, M-ABSENT, M-99VAL, M-HERMES-PREREQ). Operator pre-flagged staleness partially refuted: **no Opik/Langfuse references in any prompt**; the only Next.js references are the intentional "where the legacy instructions went" retirement note (`00-bootstrap.md:63-72`); dashboard correctly documented as SvelteKit on **3080**, not 3000. The brief's `99-final-validation.md` "Langfuse port 3000" claim could not be verified — that file does not exist in `prompts/`.

Secret-handling posture in prompts is generally sound: secrets to `/opt/cortexos/.secrets/*.env` mode 0600; `curl|bash` limited to official Docker/Tailscale/PostgreSQL keyrings; BoxBox plaintext-credential caveat honestly documented. The `: "${VAR:?...}"` gate is the single highest-impact runtime failure (aborts the session under non-interactive/`set -e`).

Findings here: C2, M-ORDER, M-CONDDEP, M-HONCHO, M-OBOT, M-HERMES-PREREQ, M-99VAL, M-IMGPIN, m5–m12, m24, m27, m28.

### 4.3 Processes (scripts, CI workflows, Dockerfile, migration chain)

Substantial drift between what workflows/Dockerfile/CLAUDE.md reference and what exists. Dockerfile is an entirely stale Next.js build (C1). CI has green-theater and hard-fail gates (C3); `pnpm -r --if-present` is the dominant footgun — it converts "script missing" into "gate passed". Secret-injection bug in `cortex-qwen-hermes-9router.sh` (C4). Manual-trigger-only convention for E2E/agent workflows is correctly honored (all use `workflow_dispatch`, marked DEPRECATED), though several of those DEPRECATED workflows NPE on their only trigger (M-WF-PR, m16).

Healthy: `cortex-backup.sh` (DB creds **fixed** — `MYSQL_PWD="$MYSQL_ROOT_PASSWORD" mysqldump -uroot`, matches prior memory note), `cortex-auto-update.sh` (backup-freshness preflight + cleanup trap), `cortex-render-units.sh` (root check, arg/suffix/template guards), `secrets-scan.yml`, `codeql.yml` standalone. The `.worktrees/` tree holds 30+ stale `migrate.js`/`dynamic-seed.js` copies — do not mistake for live code.

Findings here: C1, C3, C4, M-MIG, M-CI-META, M-DISTROMATRIX, M-INCUS-HARDEN, M-WF-PR, m13–m23.

### 4.4 Infra (systemd units, root-helper, sandbox-runner, secrets, ports)

Two Criticals: root-helper with no allowlist/peer-cred check (C5) and the dashboard service running root + `testpass` + 0.0.0.0 + no hardening (C6). Major scoping caveat: the two security-critical components named in scope are **not in the tree** — `cortex-sandbox-runner/` has only `.DS_Store` (gVisor unauditable), `cortex-dashboard-root-helper/` has only `.pyc` (helper behavior recovered by decompilation). Secrets: plaintext live creds at rest + placeholder SOPS recipients (M-SECRETS). `docker-compose.yml` (local-only) is clean; the real production compose (`/opt/homeos/docker-compose.infra.yml`) and Caddyfile live host-only and were unverifiable. FerretDB runs with auth disabled (safe only while the 127.0.0.1 bind holds); MySQL root host is `%`.

Findings here: C5, C6, M-ABSENT (sandbox/helper facet), M-SECRETS, m23, m24, m25, m26, m27, m28.

### 4.5 Docs / hygiene (intent layer + git history)

Intent layer materially out of sync on three load-bearing facts: dashboard is SvelteKit 5 not Next.js (M-DRIFT); the real path is `packages/dashboard/` while a stale `packages/cortex-dashboard/` leftover persists (M-ORPHAN); multiple referenced docs/paths do not exist (M-ABSENT). Retired-tool status is clean (Opik correctly marked retired `AGENTS.md:13`; `deploy.sh` referenced only as a known-gap TODO). Git-history hygiene: **no plaintext production secrets in history** — all 22 gitleaks hits are false positives; `.omx/state/session.json` is low-sensitivity (dead PID/UUID/local path, already removed from HEAD); 10 `.enc.yaml` SOPS files are encrypted-by-design; `.git` is 21 MB. **Recommendation: document-and-fix-forward, no history rewrite** (a rewrite would invalidate 633 commit hashes + the `v1.0.0` tag for negligible benefit).

Findings here: M-DRIFT, M-ORPHAN, M-ABSENT (doc-link facet), m29.

---

## 5. Appendix — Finding Counts Per Input File

Counts are the severity tallies as tagged (or, for the docs file, as classified from grouped themes) in each raw investigator output, before cross-surface deduplication. Dedup in §2 merges several of these into shared entries (M-DRIFT, M-MIG, M-ABSENT, M-PORTS), so the report's unique-entry count is lower than the raw sum.

| Input file | Critical | Major | Minor | Notes |
|---|---|---|---|---|
| `/tmp/audit-app-code.md` | 0 | 2 | 5 | Major: CSRF gap, orphan `cortex-dashboard`. Minor: dup-003, migrate.ts header, migrate test, paperclip private, mail-guardian token. Seed-009 port concern **refuted**. |
| `/tmp/audit-prompts.md` | 3 | 8 | 9 | Critical: 00-preflight scripts/rebuild, 13 distro-selection prompts/os gate, 31-9router apply.sh. Opik/Langfuse refs **refuted** (none present). |
| `/tmp/audit-processes.md` | 5 | 9 | 11 | Critical: Dockerfile Next.js, Dockerfile entrypoint COPY, ci a11y/contract no-op, ci compose hard-fail, qwen-hermes key injection. Backup creds **confirmed fixed**. |
| `/tmp/audit-infra.md` | 2 | 3 | 6 | Critical: root-helper no allowlist, dashboard.service root+testpass+0.0.0.0. Sandbox-runner source **absent (unauditable)**. |
| `/tmp/audit-docs-hygiene.md` | 0 | 5 | 2 | Major (classified from grouped themes): stack drift, broken links, dead-path refs, empty sandbox-runner claim, stale `cortex-dashboard` leftover. Minor: session.json history, gitleaks false-positives. No history rewrite recommended. |
| **Raw totals** | **10** | **27** | **33** | Pre-dedup. Post-dedup unique entries in §2: 6 Critical, ~18 Major-tier (several cross-surface), 29 Minor. |

Note on the docs file: that investigator presented findings as grouped drift themes rather than per-line severity tags; the 5 Major / 2 Minor split is this report's classification of those themes, stated explicitly so the count is auditable rather than invented. Every finding in §2 traces to a cited path from one of the five inputs; no finding was synthesized without a source citation, and no Critical/Major from any input was dropped (cross-surface Criticals/Majors were merged, not removed — see M-DRIFT, M-MIG, M-ABSENT, M-PORTS).

---

## 6. Recommended Remediation Order (priority sequence — no code)

1. **Stop active harm / unblock the basics (Criticals).**
   - C4 key injection in `cortex-qwen-hermes-9router.sh` (smallest blast radius, real injection).
   - C6 `cortex-dashboard.service` (remove `testpass`, loopback bind, add hardening).
   - C5 root-helper allowlist + `SO_PEERCRED` — but first **locate the absent `helper.py`/sandbox-runner source** (M-ABSENT); the fix lands wherever the real source lives.
2. **Restore the install + build path (Criticals).**
   - C2 installer dead-references (`scripts/rebuild/`, `prompts/os/`) — decide ship-vs-rewrite; this blocks every fresh operator.
   - C1 Dockerfile/SvelteKit cutover — rewrite for adapter-node or delete if systemd-only.
   - C3 CI gate honesty — add scripts or remove gates; create or drop the compose gate.
3. **Reconcile the intent layer + dedup the package tree (Major, high agent-impact).**
   - M-DRIFT doc corrections (Next.js→SvelteKit across CLAUDE.md/AGENTS.md/README/GUIDE).
   - M-ORPHAN delete/archive `packages/cortex-dashboard/`.
   - M-ABSENT triage: per item, commit-or-strip; clarify the gVisor sandbox's real location.
4. **Migration + secrets correctness (Major).**
   - M-MIG renumber dup-003, refresh header, confirm prod migration trigger + dynamic-seed fate.
   - M-SECRETS rotate exposed plaintext creds/keys; populate real SOPS recipients.
5. **Installer navigation + conditional-dependency correctness (Major).**
   - M-ORDER reconcile `_order.md` vs Next-pointers; add 30/30b/30c.
   - M-CONDDEP gate mongo exporter on `mongodb=yes`; M-HONCHO embeddings gateway IP; M-99VAL, M-HERMES-PREREQ, M-OBOT, M-IMGPIN.
6. **Port reconciliation (Major).**
   - Resolve the :3000/:3100/:3200 Grafana-vs-Loki disagreement and the cAdvisor 8081/9081 split; decide Langfuse's host port pre-emptively (m28) to kill the latent :3000 conflict.
7. **CI/workflow + script hardening (Major).**
   - M-CI-META coverage thresholds; M-DISTROMATRIX missing scripts; M-INCUS-HARDEN `set -euo pipefail` + installer pin + `/tmp` perms; M-WF-PR (or leave deprecated).
8. **Minor cleanup sweep (m1–m29).** Batch by surface; m12/m18/m19 are no-ops/acceptable. Optionally add gitleaks false-positive allowlist entries; explicitly **do not rewrite git history**.
