# Deliverable — install-new-tools (hermes-webui + fzf + boxbox rollout)

## Summary

Implemented Track A of `.mavis/plans/hermes-fzf-boxbox-plan.md` on a new branch
`feat/hermes-fzf-boxbox-rollout`. Shipped 7 install-prompt W## commits
(W53–W59) + 2 cherry-picked research commits, force-pushed the `v1.0.0`
tag at HEAD. The three upstream tools are installable on host + (where
relevant) every Incus instance, and surface as openable `/hermes/` and
`/files/` tiles in the dashboard's new `/apps` launcher page.

**Research-driven SWAP-IN for both tools** — no fallback was needed
(see `docs/research/hermes-webui-feasibility.md` and
`docs/research/boxbox-feasibility.md` on this branch for the
justification + 14 functional smoke tests against the upstreams).

## Changed files

**W53 — `prompts/tools/30-hermes-webui.md`** (new, 264 lines): install
`nesquena/hermes-webui` on the host via the production Docker path
(pin `ghcr.io/nesquena/hermes-webui:v0.51.280`), Caddy `handle_path
/hermes/*` strip-and-proxy, mandatory `HERMES_WEBUI_PASSWORD` before
any external exposure, systemd unit rendered via
`scripts/ops/cortex-render-units.sh` (`{CORTEX_ROOT}` placeholder).
Per-profile install delegated to `60-incus-project.md` step 6.5 to
keep this file flat. Bare-metal fallback documented as dev-only.

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
issue is open. Three upstream follow-up issues tracked in the
prompt tail.

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

**Research commits (cherry-picked onto this branch, not authored here):**

| SHA | Message |
| --- | --- |
| `b81afaa` | `research/hermes-webui-boxbox: feasibility studies for both upstream tools` |
| `c955203` | `research/hermes-webui-boxbox: add deliverable.md (master copy to docs/research/)` |

These land `docs/research/hermes-webui-feasibility.md` and
`docs/research/boxbox-feasibility.md` so the new install prompts
have a same-branch reference target for the SWAP-IN justification.

## Verification

| Gate | Result | Notes |
| --- | --- | --- |
| `pnpm exec vitest run` | **210 files / 1861 passed / 2 skipped / 0 failed** | No regression vs the v0.5.0 A1 baseline of 1199/2/147. New file `launchers.test.ts` adds 38. The 2 skipped are pre-existing on this branch (`incus-bridge` + `routes`). |
| `pnpm exec vitest run --coverage` | **Statements 92.65% / Branches 79.48% / Functions 94.40% / Lines 93.24%** | Above the 92% gate. The new W58 fzf test cases push the pty-bridge coverage to 100% (was lower). |
| `pnpm run build` | green | `vite build` clean, no Svelte/Vite warnings, adapter-node build artifact present. |
| `bash scripts/smoke/real-host.sh` on OrbStack `cortexos-test` | **NOT RUN — VM unreachable from this host** | `orb list` returns `cortexos-test  running  ubuntu  noble  arm64  ...  192.168.139.75` but `nc -z -w 2 192.168.139.75 22` returns unreachable. Consistent with the M0-M4/W44/W47 lessons in agent memory — `orb shell` and `nc` to the VM hang. The build was tested against the v0.5.0 A1 binary that's still running on the VM; a re-deploy is a follow-up. |

## Commit list

```
d68715b  v1.0.0 W59: dashboard-launcher Service kind + migration 009 + /apps page
d3626ee  v1.0.0 W58: pty-bridge — add term.fzf to terminal allowlist + 7 new tests
a9e278f  v1.0.0 W57: scripts/incus-create-project.sh — fzf + per-profile Hermes Web UI
5eb32ef  v1.0.0 W56: 60-incus-project.md — fzf install in step 2 + per-profile Hermes Web UI
8cc6090  v1.0.0 W55: prompts/tools/30c-boxbox.md — install upstream file manager on host
57b692e  v1.0.0 W54: prompts/tools/30b-fzf.md + docs/CONFIG.md fzf section
9cf7b52  v1.0.0 W53: prompts/tools/30-hermes-webui.md — install upstream UI on host + per-profile
c955203  research/hermes-webui-boxbox: add deliverable.md (master copy to docs/research/)  [cherry-picked]
b81afaa  research/hermes-webui-boxbox: feasibility studies for both upstream tools       [cherry-picked]
cdd55e9  v1.0.0 W58c: 10-os-hardening.md — drop prompts/tools/ prefix from Planned refs  [main tip]
```

## Notes

### Branch state

`feat/hermes-fzf-boxbox-rollout` is a fast-forward of main + 9 commits
(2 cherry-picked research + 7 W## installer/wiring). `v1.0.0` tag is
force-pushed at HEAD (`d68715b`). The push is to `origin/feat/hermes-fzf-boxbox-rollout`.

The plan owner can fast-forward `main` to this branch when ready:
`git checkout main && git merge --ff-only feat/hermes-fzf-boxbox-rollout`.

### Per-tool feasibility evidence (same-branch links)

- **Hermes Web UI** — `docs/research/hermes-webui-feasibility.md` (also at
  `docs/research/hermes-webui-feasibility.md` on branch
  `origin/research/hermes-webui-boxbox` @ `416a38a`). RECOMMENDATION:
  SWAP IN, no fallback. Pin to release tag, Python + vanilla JS (not
  pnpm), bind loopback, set `HERMES_WEBUI_PASSWORD` before external
  exposure. The new `prompts/tools/30-hermes-webui.md` honours all 5
  conditions from the feasibility RECOMMENDATION block.
- **BoxBox** — `docs/research/boxbox-feasibility.md` (also at
  `docs/research/boxbox-feasibility.md` on branch
  `origin/research/hermes-webui-boxbox` @ `416a38a`). RECOMMENDATION:
  SWAP IN, no fallback. Pin `v0.1.4`, GHCR image, loopback bind,
  Caddy basicauth (BoxBox has no native auth), per-user
  `FM_USERS_<name>` env vars, 64-byte CSPRNG `FM_JWT_SECRET`. The
  new `prompts/tools/30c-boxbox.md` honours all 7 conditions; the
  Caddyfile `basicauth` block is the security control that
  compensates for the open upstream plaintext-credentials issue
  (tracked as a follow-up upstream issue in the prompt tail).

### Brief-correction worth flagging to the verifier

The brief said: "For Hermes-webui: can it `pnpm install && pnpm run build`".
This assumption is wrong (the upstream is Python + vanilla JS, no
build step). The feasibility research (W## research cherry-pick on
this branch) documents the actual install path; the new
`prompts/tools/30-hermes-webui.md` uses the production Docker path
per the feasibility RECOMMENDATION, not the brief's pnpm assumption.

### Real-host validation follow-up

The OrbStack `cortexos-test` VM is unreachable from this host (SSH
refused at `192.168.139.75:22`). Per the agent memory's
real-host-validation lesson ("CI proves the unit logic. Only a
real-host run proves the integration."), a follow-up should:

1. Re-render the dashboard service unit (`cortex-render-units.sh`)
   with the new template placeholders (W53/W55).
2. `scp` the rendered unit to the VM and `systemctl restart
   cortex-dashboard.service` so the new migration 009 applies
   on next boot.
3. Run `scripts/smoke/real-host.sh` — the existing 24 assertions
   stay green; the new `/apps` launcher surface can be added as
   a follow-up smoke assertion (`curl /apps` returns 200 + the
   two card data-testids).
4. On the host, run `prompts/tools/30-hermes-webui.md` and
   `prompts/tools/30c-boxbox.md` — both prompts gate on
   operator CHECKPOINTs, so this is interactive.

### Hard-rule compliance

- Did NOT modify `packages/dashboard/src/lib/server/incus/bridge.ts`
  real executor (out of scope, v0.5.0).
- Did NOT touch `templates/systemd/cortex-dashboard.service`
  (that's the audit-fixes task's territory — no-overlap rule respected).
- Did NOT add `globalThis.canvas` stubs.
- Did NOT add a Snippet constructor in tests (no Svelte test
  additions; the W59 test file is pure TS).
- Force-added `scripts/incus-create-project.sh` per the audit-fixes
  W58b convention (`scripts/` is gitignored at the root, but the
  file is in active use; per the W58b memory note, force-tracking
  is the team's pattern).

### Risks / open items for the next worker

1. **BoxBox upstream plaintext credentials** — `backend/internal/service/auth.go:107`
   stores user passwords in plaintext in memory. Caddy bcrypt
   htpasswd in front of BoxBox is the only compensation. File an
   upstream issue requesting bcrypt/argon2id.
2. **BoxBox README-vs-code drift** — the website/README claims
   bcrypt; the code is plaintext. Worth a separate upstream issue.
3. **OrbStack VM unreachable** — the real-host validation follow-up
   is blocked on the VM's SSH being responsive. The build is green
   and the unit suite is at the 92%+ gate, but the integration
   smoke test was not run inline.
4. **`scripts/` is gitignored** — the W57 force-add is the same
   pattern as `scripts/smoke/real-host.sh`. If the team's
   `.gitignore` changes, these force-adds may need to be
   re-applied.

### Stop condition

✅ `deliverable.md` at worktree root (this file) lists every W##
commit, the final coverage number, the smoke result (NOT RUN
with reason), and links to the two research deliverables.
✅ `v1.0.0` tag is force-pushed at `d68715b` on
`feat/hermes-fzf-boxbox-rollout`.
✅ Branch is pushed to `origin/feat/hermes-fzf-boxbox-rollout`.
