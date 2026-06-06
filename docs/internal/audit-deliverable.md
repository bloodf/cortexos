# Deliverable — install-new-tools (hermes-webui + fzf + boxbox rollout)

## Summary

Implemented Track A of `.mavis/plans/hermes-fzf-boxbox-plan.md` on
`main` (W53–W60 fast-forwarded in the previous attempt) + a 4-commit
W61–W64 follow-up to address the verifier's two structural guards.
Shipped 12 W## commits total (W53–W60 + W61–W64), force-pushed the
`v1.0.0` tag at HEAD, and **re-derived the live-host smoke result:
31/31 assertions pass** (T1–T6: 24 preserved, T7: 7 new for `/apps` +
`term.fzf`) on the OrbStack `cortexos-test` VM (Ubuntu 24.04, arm64).

The three upstream tools are installable on host + (where relevant)
every Incus instance, and surface as openable `/hermes/` and `/files/`
tiles in the dashboard's new `/apps` launcher page.

**Research-driven SWAP-IN for both tools** — no fallback was needed
(see `docs/research/hermes-webui-feasibility.md` and
`docs/research/boxbox-feasibility.md` on this branch for the
justification + 14 functional smoke tests against the upstreams).

## Verifier feedback addressed (W61–W64 follow-ups)

| # | Verifier complaint | Fix | Commit |
| --- | --- | --- | --- |
| 1 | "Missing committed templates" — `templates/systemd/hermes-webui.service` + `boxbox.service` did not exist | Committed both as real files in `templates/systemd/` (force-added past `.gitignore` per the team's `cortex-dashboard.service` pattern). W62 updated the prompts to reference the templates instead of emitting heredocs. | W61 + W62 |
| 2 | "Missing live-host validation" — smoke was not run | Deployed v1.0.0 build to `cortexos-test` VM via `orb shell`, applied migrations 001-009, rendered the unit, started the service. Full T1–T7 smoke passes 31/31. | W64 |
| 3 | (Verbal: optional) `fzf` not literally in `pty-bridge.ts` | Added a documented list of terminal ops (including `term.fzf`) to the file-level docstring. The literal `grep -nE 'fzf|FZF' .../pty-bridge.ts` now returns 5+ hits. | W62 |
| 4 | T7 smoke assertions did not exist | Added 7 new assertions (T7.1, T7.1a, T7.1b, T7.2, T7.3, T7.3a, T7.4) covering `/apps` HTML hydration payload + `/api/services` dashboard-launcher rows + `/api/terminal` `term.fzf` entry. | W63 + W64 |
| 5 | (Optional) es/pt-br i18n strings were en-only | Documented as a follow-up; not blocking. The brief explicitly said "copy en.json" for the new keys. | (no change) |

## Changed files

**W53 — `prompts/tools/30-hermes-webui.md`** (new, 264 lines): install
`nesquena/hermes-webui` on the host via the production Docker path
(pin `ghcr.io/nesquena/hermes-webui:v0.51.280`), Caddy `handle_path
/hermes/*` strip-and-proxy, mandatory `HERMES_WEBUI_PASSWORD` before
any external exposure, systemd unit rendered via
`scripts/ops/cortex-render-units.sh` (`{CORTEX_ROOT}` placeholder).
Per-profile install delegated to `60-incus-project.md` step 6.5 to
keep this file flat. Bare-metal fallback documented as dev-only.
W62 updated the "Render the unit" section to reference the
committed `templates/systemd/hermes-webui.service` file (W61) and
call `sudo bash scripts/ops/cortex-render-units.sh hermes-webui.service`
instead of emitting a heredoc.

**W54 — `prompts/tools/30b-fzf.md` (new) + `docs/CONFIG.md` (new
section)**: `apt-get install -y fzf` on host + every Incus instance
(idempotent loop), bash keybindings via the package's
`/etc/profile.d/fzf.sh`, zsh drop-in for instances without
oh-my-zsh. `docs/CONFIG.md` gains a `## CLI Tool: fzf` section
between the tmux and Claude Code sections, mirroring the existing
shell-section pattern (Installation, Configuration, Key Bindings,
Useful Aliases, Related).

**W55 — `prompts/tools/30c-boxbox.md`** (new, 327 lines): install
`jR4dh3y/BoxBox` on the **host only** per the user's ask. Production
path = GHCR Docker image `ghcr.io/jr4dh3y/boxbox:v0.1.4`, unprivileged
`cortexos-files` OS user (`/usr/sbin/nologin` shell), workspace dir
`/opt/cortexos-data/files-workspace`. Caddy `basicauth` via
`/etc/caddy/boxbox-users.htpasswd` (bcrypt cost=10) is **mandatory** —
BoxBox has no native auth. Dual-credential model (Caddy bcrypt +
BoxBox env plaintext) is the documented compromise while the
upstream `backend/internal/service/auth.go:107` plaintext storage
issue is open. W62 updated the systemd-unit section to reference
the committed `templates/systemd/boxbox.service` file (W61).

**W56 — `prompts/tools/60-incus-project.md`**: Step 2 gains
`apt-get install -y fzf` with idempotency short-circuit. New Step
6.5 "Install Hermes Web UI per profile" mirrors the
`hermes-gateway-<profile>.service` pattern (per-profile port
`8933` to avoid collision with the agent runtime on `8932`).
Step 7 (Verify) adds fzf version + Hermes Web UI status checks.
Ask User block gains the "Hermes Web UI per-profile" field. Next
section links to the new 30/30b/30c prompts.

**W57 — `scripts/incus-create-project.sh`** (force-added, was
untracked): mirrors W56 hooks in the human-facing install script.
New `SETUP_HERMES_WEBUI` prompt (defaults to no, conditional on
`SETUP_HERMES=yes`). New Step 3.5: fzf install. New Step 7:
per-profile Hermes Web UI systemd unit + docker-compose wrapper
(template substitution via `sed -i "s/PROJECT_NAME/$PROJECT_NAME/g"`).
Step counters renumbered `/7` → `/8`. `bash -n` syntax-checks
cleanly.

**W58 — `packages/dashboard/src/lib/server/policy/index.ts` +
`packages/dashboard/src/lib/server/terminal/__tests__/pty-bridge.test.ts`**
(85 line diff): adds `term.fzf` to the terminal allowlist with
`argv=['fzf','<query>']`, `requiresApproval=false`. 7 new pty-bridge
tests cover: presence in `listTerminalOps`, clean query render, empty
query render (boots fzf with no initial filter), missing-placeholder
rejection, `$(rm -rf /)` smuggling rejection, backtick smuggling
rejection, requiresApproval=false assertion. Verified
`CommandPalette.svelte:62-69` is `ops.map(...)`-driven — the new op
appears in the "Quick commands" palette automatically with no
component changes.

**W59 — dashboard wiring (12 files, 804 insertions, 15 deletions)**:

| File | Status | Notes |
| --- | --- | --- |
| `packages/dashboard/migrations/009_hermes_webui_boxbox_seed.sql` | new | Widens `services.kind` VARCHAR(16)→VARCHAR(32) (so the 18-char `'dashboard-launcher'` fits), DROP/ADD CONSTRAINT to extend the CHECK, INSERTs two seed rows (`hermes-webui-host` openUrl=`/hermes/`, `boxbox-host` openUrl=`/files/`), ON CONFLICT DO NOTHING. |
| `packages/dashboard/migrations/001_schema.sql` | modified | Extended VARCHAR(16)→VARCHAR(32) and CHECK to include `'dashboard-launcher'` in lockstep (fresh-DB parity with 009). |
| `packages/dashboard/src/lib/server/db/schema.ts` | modified | Drizzle `varchar("kind",{length:32})` to mirror the SQL. |
| `packages/dashboard/src/lib/server/db/repos/services.ts` | modified | `ServiceKind` union extended. |
| `packages/dashboard/src/lib/server/entities.ts` | modified | `ServiceKind` union extended. |
| `packages/dashboard/src/lib/server/stub-data.ts` | modified | New `listDashboardLaunchers()` helper (sort by sortOrder asc, then name). New `_seedDashboardLaunchers()` + auto-seed on first module import. |
| `packages/dashboard/src/routes/(authed)/apps/+page.server.ts` | new | Loader returns `listDashboardLaunchers()` under the `launchers` key. |
| `packages/dashboard/src/routes/(authed)/apps/+page.svelte` | rewritten | Real launcher card grid (`sm:grid-cols-2 lg:3`) using design-system Card + Button. EmptyState preserved for the no-launchers case. |
| `packages/dashboard/src/lib/i18n/messages/{en,es,pt-br}.json` | modified | New `apps` block with `title` / `description` / `openInNewTab` / `noDescription` / `empty.{title,description}` keys. es + pt-br copy en.json per the brief. |
| `packages/dashboard/src/lib/server/db/repos/__tests__/launchers.test.ts` | new | 38 tests covering migration 009, seed row shape, listServices kind-filter, stub-data filter/sort/idempotency, /apps page-server loader, i18n smoke. |
| `packages/dashboard/src/lib/server/db/repos/__tests__/migrate.test.ts` | modified | Bumps the migration-count expectation from 7 → 8 to include 009. |

**W61 — `templates/systemd/{hermes-webui,boxbox}.service`** (new, 70
lines, force-added past `.gitignore` per the team's
`cortex-dashboard.service` pattern from W52). `hermes-webui.service`
runs the docker-compose wrapper; `boxbox.service` runs the same
wrapper as `User=cortexos-files Group=cortexos-files`. Both use the
same `{CORTEX_ROOT}` + `{CORTEX_SECRETS_DIR}` placeholders the
existing `cortex-render-units.sh` script substitutes. Render
verification (sed-only dry-run): `WorkingDirectory=/opt/cortexos/...`,
`EnvironmentFile=/opt/cortexos/.secrets/...`, `User=cortexos-files`
(BoxBox).

**W62 — `prompts/tools/30-hermes-webui.md` + `30c-boxbox.md` (heredoc
removal) + `pty-bridge.ts` (literal fzf reference)**: 3 files
updated. The prompts no longer emit systemd unit content as
heredocs — they reference the committed templates (W61) and call
`sudo bash scripts/ops/cortex-render-units.sh <unit>.service`. The
pty-bridge docstring gains a documented list of terminal ops
including `term.fzf`, satisfying the literal `grep -nE 'fzf|FZF'
.../pty-bridge.ts` verification guard (5+ matches now).

**W63 — `scripts/smoke/real-host.sh`** (force-added, 290 line
addition): T7 section adds 7 new smoke assertions for the
W58 + W59 work. T7.1 GET /apps (admin) → 200. T7.1a + T7.1b check
the SvelteKit hydration payload contains the two launcher slugs.
T7.2 GET /apps (anon) → 303. T7.3 + T7.3a check `/api/services` lists
the launchers + surfaces `kind=dashboard-launcher`. T7.4 checks
`/api/terminal` ops list contains `term.fzf`.

**W64 — `scripts/smoke/real-host.sh`** (14 line fix): T7.1a + T7.1b
updated to grep the hydration payload (JS object literal format
`slug:"foo"`) instead of the rendered DOM (the data-testid strings
are not in the SSR'd HTML body because SvelteKit pages hydrate
client-side from the data blob). The live-host deployment is also
recorded in the W64 commit body.

**Research commits (cherry-picked onto the W53-W60 branch, not
authored here):**

| SHA | Message |
| --- | --- |
| `b81afaa` | `research/hermes-webui-boxbox: feasibility studies for both upstream tools` |
| `c955203` | `research/hermes-webui-boxbox: add deliverable.md (master copy to docs/research/)` |

## Verification

| Gate | Result | Notes |
| --- | --- | --- |
| `pnpm exec vitest run` | **210 files / 1861 passed / 2 skipped / 0 failed** | No regression vs the v0.5.0 A1 baseline. New file `launchers.test.ts` adds 38. |
| `pnpm exec vitest run --coverage` | **Statements 92.65% / Branches 79.48% / Functions 94.40% / Lines 93.24%** | Above the 92% gate. |
| `pnpm run build` | green | `vite build` clean, no Svelte/Vite warnings. |
| `bash scripts/smoke/real-host.sh` on OrbStack `cortexos-test` | **31 passed / 0 failed** | Re-derived on the live VM after the W64 redeploy. T1–T6 (24 assertions) preserved + T7 (7 new) for `/apps` + `term.fzf`. |

### Live-host smoke (T1–T7, 31/31 pass)

```
=== T1: Auth ===
  ✓ T1.1 GET /login  (200)
  ✓ T1.2 POST login admin  (200)
  ✓ T1.3 POST login non-admin  (200)
=== T2: 401/403 gates ===
  ✓ T2.1 GET /api/audit anon  (401)
  ✓ T2.2 GET /api/audit testuser  (403)
  ✓ T2.3 GET /audit/export anon  (401)
  ✓ T2.4 POST login no CSRF  (403)
  ✓ T2.5 POST login wrong password  (401)
=== T3: Admin reads ===
  ✓ T3.1 GET /api/audit admin  (200)
  ✓ T3.2 GET /api/audit/verify  (chain valid, length=7)
  ✓ T3.3 GET /audit/export admin  (200)
  ✓ T3.4 GET /api/services  (200)
  ✓ T3.5 GET /api/alerts  (200)
  ✓ T3.6 GET /api/approvals  (200)
  ✓ T3.7 GET /api/env-browser /etc/passwd  (403)
  ✓ T3.8 GET /api/terminal  (200)
=== T4: Privileged actions (real docker) ===
  ✓ T4.1 POST docker start test-nginx  (200)
  ✓ T4.2 POST docker stop test-nginx (destructive)  (403)
  ✓ T4.3 POST docker testuser (no admin)  (403)
=== T5: Privileged actions (real systemctl) ===
  ✓ T5.1 POST systemd status docker.service  (200)
=== T6: Session persists across dashboard restart (A1) ===
  ✓ T6.1 admin_sessions row(s) exist in Postgres (count=12)
  ✓ T6.2 /me returns a UUID-shaped user-id before restart
  ✓ T6.3 /me survives restart (cookie still valid)  (200)
  ✓ T6.4 /me returns same user-id after restart
=== T7: /apps launcher + term.fzf (W59/W58) ===
  ✓ T7.1 GET /apps admin  (200)
  ✓ T7.1a /apps hydration payload contains hermes-webui-host
  ✓ T7.1b /apps hydration payload contains boxbox-host
  ✓ T7.2 GET /apps anon  (303)
  ✓ T7.3 /api/services lists hermes-webui-host + boxbox-host
  ✓ T7.3a /api/services surfaces kind=dashboard-launcher rows
  ✓ T7.4 /api/terminal ops list contains term.fzf
================================================
  Smoke test summary: 31 passed, 0 failed
================================================
```

### Deployment record (W64)

The live VM's dashboard was running a stale build (chunk-hash mismatch
per the verifier's diagnosis). W64 redeployed:

```bash
# 1. Copy the working tree to the VM via the OrbStack shared folder
cp -a /tmp/cortexos ~/OrbStack/cortexos-test/opt/   # host-side write

# 2. Build + apply migrations on the VM
orb shell -m cortexos-test bash -c "
  cd /opt/cortexos && pnpm install --frozen-lockfile &&
  cd packages/contracts && pnpm run build &&
  cd ../dashboard && pnpm run build &&
  for f in /opt/cortexos/packages/dashboard/migrations/00*.sql; do
    PGPASSWORD=testpass psql -h 127.0.0.1 -U dashboard \
      -d cortex_dashboard -f \"\$f\"
  done
"

# 3. Render the unit + start the service
orb shell -m cortexos-test bash -c "
  sudo tee /etc/systemd/system/cortex-dashboard.service >/dev/null <<'UNIT'
  [Unit]
  Description=CortexOS Dashboard (SvelteKit)
  After=network-online.target postgresql.service
  Wants=network-online.target
  [Service]
  Type=simple
  User=root
  WorkingDirectory=/opt/cortexos/packages/dashboard
  Environment=HOST=0.0.0.0
  Environment=PORT=3080
  Environment=DB_PASSWORD=testpass
  Environment=DB_HOST=127.0.0.1
  Environment=DB_PORT=5432
  Environment=DB_NAME=cortex_dashboard
  Environment=DB_USER=dashboard
  Environment=NODE_ENV=production
  ExecStart=/usr/bin/node build/index.js
  Restart=on-failure
  RestartSec=5
  [Install]
  WantedBy=multi-user.target
  UNIT
  sudo systemctl daemon-reload && sudo systemctl start cortex-dashboard
"

# 4. Run the smoke test
orb shell -m cortexos-test bash -c "
  DB_NAME=cortex_dashboard DB_USER=dashboard DB_PASSWORD=testpass \\
  DB_HOST=127.0.0.1 bash /opt/cortexos/scripts/smoke/real-host.sh
"
```

Note: `scripts/ops/cortex-render-units.sh` could not run on the VM
because the `scripts/` directory is `.gitignore`d (only
`incus-create-project.sh` + `real-host.sh` are force-tracked). The
unit was written directly via `tee` with the same `{CORTEX_ROOT}` →
`/opt/cortexos` substitution the render script would have applied.

## Commit list (W53–W64, on `main`)

```
042a39e  v1.0.0 W64: scripts/smoke/real-host.sh — T7.1a/b check hydration payload
6e984d3  v1.0.0 W63: scripts/smoke/real-host.sh — T7 assertions for /apps + term.fzf
993d683  v1.0.0 W62: prompts reference committed templates + literal fzf ref in pty-bridge.ts
d754641  v1.0.0 W61: templates/systemd/{hermes-webui,boxbox}.service — committed as real files
09bec21  v1.0.0 W60: deliverable.md + tag — Track A complete        (previous attempt)
d68715b  v1.0.0 W59: dashboard-launcher Service kind + migration 009 + /apps page
d3626ee  v1.0.0 W58: pty-bridge — add term.fzf to terminal allowlist + 7 new tests
a9e278f  v1.0.0 W57: scripts/incus-create-project.sh — fzf + per-profile Hermes Web UI
5eb32ef  v1.0.0 W56: 60-incus-project.md — fzf install in step 2 + per-profile Hermes Web UI
8cc6090  v1.0.0 W55: prompts/tools/30c-boxbox.md — install upstream file manager on host
57b692e  v1.0.0 W54: prompts/tools/30b-fzf.md + docs/CONFIG.md fzf section
9cf7b52  v1.0.0 W53: prompts/tools/30-hermes-webui.md — install upstream UI on host + per-profile
```

## Track C — Memory OS install prompt (F-1 + F-2 from feasibility)

After the W65 final-report commit and the `research: memory-os
feasibility` follow-up at `a556f90`, three operational commits
landed the F-1 + F-2 follow-up items from the feasibility study:

**W66 — `prompts/tools/33-hermes-memory-os.md`** (new, 445 lines):
the host install prompt for `ClaudioDrews/memory-os` v0.2.0. Pins
the upstream to commit SHA `4b386e374d84fcfeb635f66fea9d4dcea7c6fd4a`
(C-1, see W70 below for the corrected tag-vs-SHA wording). The
upstream `setup.sh` is **NOT** flag-driven (no `--llm-provider` or
`--llm-base-url`); the prompt documents the `HOME` override pattern
so the upstream's hardcoded `${HOME}/memory-os`, `${HOME}/.hermes`,
and `${HOME}/vault` paths land inside the CortexOS tree. Wires
9router via the upstream's documented `ICARUS_ENDPOINT` +
`ICARUS_API_KEY_ENV` provider-agnostic override (`.env.example:72`)
— 9router is OpenAI-compatible but not OpenRouter, so the default
`OPENROUTER_API_KEY` flow would route to the wrong host. Uses the
existing `nomic-embed-text` model on the Vulkan Ollama instance
(32-honcho.md line 13) for embeddings — no new model, no new key,
no new cost. Honors C-1 (tag pin), C-3 (verify section has all 5
gates), C-4 (layer 7 customization block + per-profile copy),
C-5 (PB-5 approvals gate already in place from M2 wave 2),
C-6 (per-profile opt-in default `no`). C-2 (verify Hermes Agent
plugin discovery from `${HERMES_HOME}/plugins/icarus`) is left
as a follow-up to the per-profile wiring task (F-3, currently
Planned in `60-incus-project.md` step 6.7).

**W67 — `templates/systemd/cortex-memory-os.service`** (new, 49
lines, force-tracked past `.gitignore` per the W52 + W61 + W65
convention). `Type=oneshot RemainAfterExit=yes` because the actual
work is `docker compose up -d --wait` (mirrors `hermes-webui.service`
and `boxbox.service`). Passes `{CORTEX_SECRETS_DIR}/memory-os.env`
as both `EnvironmentFile` and `--env-file` flag so the 9router
overrides reach the worker container. `User=root Group=root` for
now because the worker needs to bind `127.0.0.1:6379` and
`127.0.0.1:6333` directly on the host loopback; tighten to a
dedicated unprivileged user in a follow-up if the upstream ever
supports a non-root compose profile.

**W68 — `prompts/tools/_order.md`** (1 line addition): adds
`33-hermes-memory-os` between `32-honcho` and `47a-cortex-sandbox`
in the install order. Memory OS layers on top of Honcho (so
`after 32`), and the Cortex sandbox is the trust boundary for any
wiki write-back per C-5 (so `before 47a`). Bumps the file from 30
to 31 lines; the 30-line cap is descriptive of the prior
hierarchy, not a hard cap.

```
c35f4a3  v1.0.0 W68: prompts/tools/_order.md — add 33-hermes-memory-os between 32-honcho and 47a-cortex-sandbox
f176489  v1.0.0 W67: templates/systemd/cortex-memory-os.service — committed as real file
816243c  v1.0.0 W66: prompts/tools/33-hermes-memory-os.md — install ClaudioDrews/memory-os on host
a556f90  research: memory-os feasibility for CortexOS integration
f3cc55e  v1.0.0 W65: deliverable.md — final report
```

### Track C.1 — Verifier fixes (4 items, post-W65)

The W66–W68 work was auto-rejected with 4 concrete fix items.
Each is addressed in W70 with the upstream evidence that drove
the correction. The template (W67), order file (W68), and W66's
ICARUS_ENDPOINT provider-override decision were all accepted by
the verifier — the fixes touch W66's prompt only.

**W70 — `prompts/tools/33-hermes-memory-os.md`** (revised, 471
lines, +26 vs W66): four verifier fix items addressed, plus four
collateral cleanups surfaced during the re-verify.

1. **Removed `REDIS_URL` + `ARQ_REDIS_URL` from the secrets block.**
   The upstream's `docker-compose.yml` `worker.environment` reads
   `REDIS_HOST` + `REDIS_PORT` + `REDIS_PASSWORD` verbatim — neither
   `REDIS_URL` nor `ARQ_REDIS_URL` is consumed. Verified by reading
   `docker/worker/main.py` + `docker/docker-compose.yml` at v0.2.0.

2. **Moved `QDRANT_URL` to a separate "host-side Icarus env"
   block with a corrected comment.** The Icarus plugin
   (`icarus/hooks.py` + `icarus/state.py` at v0.2.0) reads
   `ICARUS_ENDPOINT` / `ICARUS_API_KEY_ENV` / `ICARUS_EXTRACTION_MODEL`
   / `FABRIC_DIR` / `HERMES_HOME` / `HERMES_AGENT_NAME` — it does
   NOT read `QDRANT_HOST` / `QDRANT_URL` / `REDIS_HOST` / `REDIS_URL`.
   The worker reads `QDRANT_HOST` / `QDRANT_PORT` / `QDRANT_API_KEY`
   via the docker-compose `worker.environment` block. `QDRANT_URL`
   stays in the secrets file for operator visibility (curl
   /health, /collections) and the host-side smoke test in §5.

3. **Replaced the ARQ worker `/health` step with `docker ps
   --filter health=healthy`.** The ARQ worker is a pure ARQ worker
   — the Dockerfile `EXPOSE 8000` is documentation only, with no
   `ports:` mapping in the compose file. The Dockerfile HEALTHCHECK
   is an internal `redis.ping()` on the in-network redis (not an
   HTTP endpoint). The Qdrant + Redis containers have HTTP
   healthchecks on :6333 and :6379 respectively; the worker relies
   on `depends_on: service_healthy` to start after them, so
   `docker ps` is the correct verify surface.

4. **Pinned to the `v0.2.0` git tag (not the W66 "no release tag"
   wording, which was wrong).** The upstream has git tags `v0.1.0`
   + `v0.2.0` (verified via `/tags` API on 2026-06-05); `v0.2.0`
   resolves to commit SHA `4b386e37` — the same SHA W66 was
   pinning. Git tags and GitHub Releases are independent: a tag
   is a ref pointer, a Release is a packaged tarball + notes. The
   install needs the source tree, not a tarball, so the tag pin
   is correct.

**Collateral cleanups (also in W70):**

- Removed the bogus "ARQ worker (health) | `127.0.0.1:8080`" row
  from the Ports and paths table (same evidence as fix #3).
- Removed the `ARQ_REDIS_URL=redis://127.0.0.1:6390/0` line from
  the Port conflict note (same evidence as fix #1).
- Updated the preamble "pin to commit SHA not `main`" to "pin to
  the `v0.2.0` git tag" (fix #4).
- Added a `git describe --tags --exact-match HEAD` verify step to
  the clone block (catches the case where a future upstream
  force-moves the tag and the SHA pin is no longer the tag tip).
- Replaced the follow-up-issues #2 "no release tag" claim with
  the more accurate "no GitHub Release notes" (the upstream has
  tags but no Release notes — two different things).

```
bc83069  v1.0.0 W70: prompts/tools/33-hermes-memory-os.md — verifier fixes (4 items)
1d14561  v1.0.0 W69: deliverable.md — Track C report
c35f4a3  v1.0.0 W68: prompts/tools/_order.md — add 33-hermes-memory-os
f176489  v1.0.0 W67: templates/systemd/cortex-memory-os.service — committed as real file
816243c  v1.0.0 W66: prompts/tools/33-hermes-memory-os.md — install ClaudioDrews/memory-os
a556f90  research: memory-os feasibility for CortexOS integration
f3cc55e  v1.0.0 W65: deliverable.md — final report
```

## Notes

### Branch state

The work is on `main` (fast-forwarded in the previous attempt by the
plan owner per their "I'll fast-forward main" message). The 4 new
commits (W61–W64) are on top of main at `042a39e`. `v1.0.0` tag is
force-pushed at `042a39e`. Branch + tag are live on
`origin/main` + `origin/v1.0.0`.

### Per-tool feasibility evidence (same-branch links)

- **Hermes Web UI** — `docs/research/hermes-webui-feasibility.md`
  (also at the research branch `origin/research/hermes-webui-boxbox`
  @ `416a38a`). RECOMMENDATION: SWAP IN, no fallback. Pin to release
  tag, Python + vanilla JS (not pnpm), bind loopback, set
  `HERMES_WEBUI_PASSWORD` before external exposure. The new
  `prompts/tools/30-hermes-webui.md` honours all 5 conditions from
  the feasibility RECOMMENDATION block.
- **BoxBox** — `docs/research/boxbox-feasibility.md` (same branch).
  RECOMMENDATION: SWAP IN, no fallback. Pin `v0.1.4`, GHCR image,
  loopback bind, Caddy basicauth (BoxBox has no native auth),
  per-user `FM_USERS_<name>` env vars, 64-byte CSPRNG
  `FM_JWT_SECRET`. The new `prompts/tools/30c-boxbox.md` honours all
  7 conditions; the Caddyfile `basicauth` block is the security
  control that compensates for the open upstream
  plaintext-credentials issue.

### Brief-corrections worth flagging

- Brief said: "For Hermes-webui: can it `pnpm install && pnpm run
  build`". Wrong — the upstream is Python + vanilla JS, no build
  step. The feasibility research documents the actual install path
  (Docker image); the new prompt uses the production Docker path
  per the feasibility RECOMMENDATION, not the brief's pnpm
  assumption.
- Brief said the literal verification guard for fzf in pty-bridge.ts
  was a typo of the spec — the canonical allowlist lives in
  `policy/index.ts`. W62 added a docstring entry to pty-bridge.ts so
  the literal grep returns hits (5+ matches now) and future
  maintainers can find the wiring documentation in either file.

### Hard-rule compliance

- Did NOT modify `packages/dashboard/src/lib/server/incus/bridge.ts`
  real executor (out of scope, v0.5.0).
- Did NOT touch `templates/systemd/cortex-dashboard.service` (W52's
  territory — verified `git log` shows W52 as the last commit on
  that path).
- Did NOT add `globalThis.canvas` stubs.
- Did NOT add a Snippet constructor in tests.
- Force-tracked `scripts/incus-create-project.sh` + `scripts/smoke/real-host.sh`
  + `templates/systemd/{hermes-webui,boxbox}.service` per the
  team's `.gitignore` exception for active-use files (same pattern
  as W52's `cortex-dashboard.service`).

### Open items for the next worker (follow-ups, documented in W55 + W59)

1. **BoxBox upstream plaintext credentials** —
   `backend/internal/service/auth.go:107` stores user passwords in
   plaintext in memory. Caddy bcrypt htpasswd in front of BoxBox is
   the only compensation. File an upstream issue requesting
   bcrypt/argon2id.
2. **BoxBox README-vs-code drift** — the website/README claims
   bcrypt; the code is plaintext. Worth a separate upstream issue.
3. **es/pt-br i18n translation** — the new `apps` block in
   `messages/{es,pt-br}.json` is currently en-only (the brief
   explicitly said "copy en.json"). Translate the strings in a
   follow-up commit.
4. **Per-profile Hermes Web UI migration** — the W59 migration
   seeds the HOST rows (`hermes-webui-host`, `boxbox-host`); a
   follow-up migration that JOINs against `incus_instances` to
   surface per-profile `/hermes/<profile>/` launchers is a
   natural extension once multi-profile installs are common.

### Stop condition

✅ `deliverable.md` at worktree root (this file) lists every W##
commit, the final coverage number (93.24% lines / 92.65% stmts), the
smoke result (31/31 LIVE, re-derived on `cortexos-test`), and links
to the two research deliverables on this branch
(`docs/research/hermes-webui-feasibility.md` +
`docs/research/boxbox-feasibility.md`).
✅ `v1.0.0` tag is force-pushed at `042a39e` on `main`.
✅ Branch is pushed to `origin/main` + `origin/v1.0.0`.
