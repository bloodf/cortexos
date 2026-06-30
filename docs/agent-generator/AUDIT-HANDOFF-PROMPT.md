# CortexOS Agent Generator — Audit, Gap-Hunt & Hardening Mission

> Paste this whole file as the first message of a fresh session. It is
> self-contained: assume you have **no prior context**. Your job is to take the
> CortexOS Agent Generator (and the dashboard around it) to production-perfect:
> find real bugs, close gaps, finish half-built features, and harden it.

---

## 0. How to work (read first)

- **Evidence over assertions.** Verify every claim against the code and the
  *running* system before you state it. Never say "fixed/works" without running
  the check and showing output.
- **Adversarial + broad.** For breadth, fan out read-only auditors (one per
  domain/feature), collect structured findings, then **independently verify each
  finding** before acting on it. Roughly half the "findings" in the last pass
  were false positives — confirm against the code.
- **Don't rebuild what works.** Section 3 lists what's already implemented and
  verified. Re-verify rather than reimplement.
- **Respect the gotchas in Section 4** — each one cost real debugging time.
- **Be honest about constraints.** Hermes (Section 1) is an external runtime
  with hard limits; don't promise capabilities it doesn't have.
- This repo commits to `main`. End commit messages with a `Co-Authored-By:`
  trailer. `git push` only when asked.

---

## 1. System map

- **Host:** single Linux box, repo at `/opt/cortexos`, pkg manager `pnpm`,
  Node 22. Reach the live UI at `https://cortexos.tailfd052e.ts.net`.
- **Dashboard** (`packages/dashboard-next`): TanStack Start + React 19 + Vite,
  Postgres, PAM auth. Runs as native systemd `cortex-dashboard.service` on
  `127.0.0.1:3080`. Transport is typed **`createServerFn` RPC** — there are NO
  REST `/api/*` routes. Server fns live in `src/lib/api/<domain>.functions.ts`
  and dynamically import server logic from `src/server/**`.
- **Agent Generator** = the `/agents/new` page. AI-assisted interview that
  designs a **Hermes agent profile** and then builds it. Two LLM paths:
  - **WS sidecar** (live path): `packages/cortex-agent-generator/src/server.js`,
    a Node WS server on `127.0.0.1:3082` that streams chat + advisor/skeptic
    panels + a live root PTY. This is what the page uses when connected.
  - **RPC fallback**: `src/server/agents/generator/llm.ts` (`generatorTurn`),
    used when the WS is unavailable.
  - **Both embed an identical `SYSTEM_PROMPT` — keep them in sync.**
- **Hermes** = the external agent runtime (`/home/cortexos/.local/bin/hermes`).
  A profile lives at `/opt/cortexos/hermes/profiles/<slug>/` (`config.yaml`,
  `SOUL.md`, `AGENTS.md`) and runs as `hermes-gateway@<slug>` +
  `hermes-profile@<slug>` systemd units. **One primary model per profile** plus
  quality/liveness fallbacks and ~11 auxiliary task-models. MCP servers are
  configured per-profile under `mcp_servers:` in `config.yaml`; per-profile
  secrets live in `/opt/cortexos/.secrets/hermes/<slug>.env` and are referenced
  as `${VAR}`. There is **no single gsuite/ms365 plugin** — only per-service
  plugins (`google_meet`, `google_chat`, `teams`, …) and per-profile custom MCP.
- **9router** = OpenAI-compatible LLM gateway on `127.0.0.1:11434`
  (`/v1/chat/completions`, `/v1/models`). The generator reads its key from
  `/opt/cortexos/.secrets/9router.env` (`NINEROUTER_API_KEY`).
- **Ingress:** `tailscale serve :443` → Caddy `:80` → dashboard `:3080` (and the
  sidecars). Caddy path-routes `/agent-generator/ws`→:3082, `/terminal/ws`→:3081.

## 2. Key files (the map)

```
packages/cortex-agent-generator/src/server.js        WS sidecar (auth, PTY, chat, spec emit) — DUP system prompt
packages/dashboard-next/src/
  features/AgentGenerator.tsx                          the page (chat, presets, live-spec panel, build)
  lib/api/generatorWs.ts                               WS client (frames, reconnect)
  lib/api/agentGenerator.functions.ts                  RPC: createSession/send/get/build/listPresets
  lib/api/client.ts                                    RPC facade (typed wrappers)
  server/agents/generator/
    llm.ts                                             RPC interview turn — DUP system prompt
    types.ts                                           ProfileSpec, ProfileMcp, ProfileRole
    build.ts                                           buildProfileFromSpec — turns spec into a real profile
    integration-catalog.ts                             gsuite/ms365/github/notion/slack/linear/n8n/filesystem/web
    archetype-catalog.ts                               personal/work/wellbeing starting points
    recommendation-catalog.ts                          vendored MetaHarness verticals (coding/business)
    __tests__/                                          generator + catalog + build tests
templates/hermes/profile-config.template.yaml          rich config template (GITIGNORED — host-managed)
scripts/hermes-profile-create.mjs                      scaffolds a new profile (create step)
scripts/migrate-cli.js                                 applies dashboard SQL migrations (see gotcha)
packages/dashboard-next/migrations/                    SQL migrations (NNN_*.sql)
```

## 3. What already works (verified this cycle — re-verify, don't rebuild)

The generator was repaired from "fully broken" to a working AI-assisted builder:

- **Ingress fixed** — `tailscale serve :443` now points at Caddy `:80`, so the WS
  reaches the sidecar (it was 404ing). This also fixed the Terminal page.
- **Sidecar repaired** — was crash-looping (`configureDbPool()` never called);
  now calls `pool()` at boot, guards `validateSession`, uses WS close code 4401.
- **Persona + hard gates** — deep system prompt: the AI is the "CortexOS Agent
  Generator" (not Claude Code), has NO machine/shell/file access, output is only
  conversation + the spec JSON.
- **Conversation memory** — the sidecar keeps the full transcript (was stateless).
- **Thinking status** — driven by the sidecar's `thinking`/`idle`/`ready` frames.
- **Spec → "Create agent"** — the sidecar parses the fenced ```json spec, emits a
  `spec` frame + `ready` status so the build button enables.
- **9router key** — the shared `9router.env` key was a dead pre-fork key (chat
  401'd while `/v1/models` is unauthenticated); now set to the valid `cortex`
  `sk-` key.
- **Effort** — the operator's reasoning effort flows UI→WS→model and the selector
  always shows (9router tolerates `reasoning_effort` on any model).
- **Rich builder** — `ProfileSpec.integrations` expands at build into real
  `hermes mcp add` (`--preset`/`--env KEY=${KEY}`/`--args`) + skills +
  per-profile `.env` credential placeholders. Operator-provided MCP servers +
  API keys are captured (`mcps[].env`) and written to the per-profile `.env`
  (secret-redacted in the UI).
- **Archetypes + preset buttons** — personal/work/wellbeing starting points
  offered conversationally and as clickable chips (`listGeneratorPresets` RPC).
- **Roles** — `ProfileSpec.roles` captured; prompt is explicit that Hermes runs
  one model (true per-role teams = separate profiles, deferred).
- **Persona files** — the build writes `SOUL.md` (model-authored, with a
  generated fallback) + `AGENTS.md` to the profile home — this is the agent's
  real identity.
- **Per-profile isolation** — integration MCP servers are named `<slug>-<name>`
  and creds live only in the per-profile `.env`, so multiple Google/MS accounts
  on different profiles never collide (unit-tested).
- **Lint fixed** — `eslint.config.js` lacked `parserOptions.projectService` for a
  type-aware rule, so eslint crashed on every file; fixed → `pnpm lint` rc=0.
- **Ollama removed** — dropped from the profile template and from the live
  `cleo`/`cieucpb` configs (Hermes never uses ollama).

## 4. Gotchas (verify before trusting — each cost real debugging time)

1. **Ingress:** `tailscale serve :443` MUST proxy Caddy `:80`, not dashboard
   `:3080`, or every WS sidecar 404s. (`sudo tailscale serve --bg --https=443
   http://127.0.0.1:80`.) Lives in tailscaled state, not a boot script.
2. **9router key:** `/v1/models` is **unauthenticated** (any key returns 200) but
   `/v1/chat/completions` validates. Valid keys are `sk-…` rows in
   `/home/cortexos/.9router/db/data.sqlite` table `apiKeys` (no `sqlite3` CLI —
   use `python3 -c "import sqlite3…"`). If chat 401s, the key is wrong.
3. **Migrations apply via `node scripts/migrate-cli.js`, NOT on service restart.**
   `DB_PASSWORD=$(…9router/dashboard.env…)`. The in-process runner is not wired on
   the pg path. (CLAUDE.md/AGENTS.md are stale on this.)
4. **Two system prompts** (sidecar `server.js` + `llm.ts`) are duplicated and
   MUST be edited together.
5. **`templates/` and `hermes/profiles/` are gitignored** (host-managed state).
   Edits there are live but not committed — that's by design.
6. **eslint** needs `parserOptions.projectService`; `pnpm test` runs **serial**
   on purpose (PGlite WASM tests flake/time-out under parallel load — they pass
   in isolation).
7. **Caddy:** `admin off` → after editing `/etc/caddy/Caddyfile`,
   `systemctl restart caddy` (reload won't apply). Reading it needs `sudo`.
8. **Hermes is one-model-per-profile.** Auxiliary slots are fixed functions
   (vision/web_extract/…), not arbitrary roles.
9. Build is best-effort for skills/mcp/integration steps (warns, doesn't fail);
   only create/render/enable are critical (throw).

## 5. Known gaps & candidate work (investigate, prioritize, implement)

Treat these as leads, not gospel — confirm each against the code/system first.

- **End-to-end build never run this cycle.** No real agent was created through
  the full UI→build→running-profile path (only LLM behavior + mocked-executor
  build tests). **Highest priority:** create a throwaway agent end to end as an
  authenticated admin and watch every build step; fix whatever breaks.
- **Build security review.** `buildProfileFromSpec` passes spec fields to shell
  commands / writes files. Audit for injection (slug is regex-guarded; check
  model, mcp name/command/args/env, soul, integration ids) and for secret
  leakage in logs.
- **cleo `agentgateway` MCP is misconfigured** — its config references
  `node ${CORTEX_AGENTGATEWAY_MCP_BIN}` but that env var is unset everywhere, so
  the tool fails to start. Find the correct bin path (or remove the MCP from
  cleo's config). Unrelated to ollama; surfaced by a restart.
- **gsuite/ms365 MCP packages are best-effort guesses** (no Hermes preset). Pin
  real, working community servers (or Hermes per-service plugins: `google_meet`,
  `google_chat`, `teams`) and verify they install via `hermes mcp add`.
- **Channel setup is interactive** (WhatsApp QR, Telegram chat-IDs) via the page
  PTY; only the Telegram token is written automatically. Decide whether to
  guide/automate more of this.
- **Auxiliary task-models + quality/liveness fallbacks are not
  interview-configurable** — the spec can't set them yet. Consider capturing
  them.
- **Multi-profile "team" architecture** (true per-role models that hand off) is
  deferred — design it if wanted.
- **3 pre-existing `react-refresh` eslint warnings** remain (MailGuardian,
  widget-catalog) — DX-only, don't fail lint; clean up if desired (move
  non-component exports to their own files).
- **Existing profiles vs template drift** — the template was hardened but live
  profiles (cleo/cieucpb/cortex) may differ in other ways; audit for drift.
- **Whole-dashboard sweep** — last audits found the systemic routing bug, the
  approval-reason data loss, and assorted runtime issues. Re-run a broad
  per-feature audit (routes ↔ server fns ↔ build/runtime) for anything missed.

## 6. Verify (run these; show output before claiming anything)

```bash
cd /opt/cortexos
# typecheck / lint / tests / build
pnpm --filter @cortexos/dashboard-next typecheck
pnpm --filter @cortexos/dashboard-next lint            # rc=0 expected (3 react-refresh warns ok)
pnpm --filter @cortexos/dashboard-next exec vitest run src/server/agents/generator/__tests__/
pnpm --filter @cortexos/dashboard-next build
node --check packages/cortex-agent-generator/src/server.js

# deploy
sudo systemctl restart cortex-agent-generator.service cortex-dashboard.service
systemctl is-active cortex-agent-generator.service cortex-dashboard.service
curl -skS -o /dev/null -w '%{http_code}\n' https://cortexos.tailfd052e.ts.net/agent-generator/healthz   # 200
curl -skS -o /dev/null -w '%{http_code}\n' https://cortexos.tailfd052e.ts.net/login                     # 200

# sidecar health (watch for 'rejected_origin' vs 'ws_close 401' vs crash)
sudo journalctl -u cortex-agent-generator.service -n 40 --no-pager
```

## 7. Test LLM / agent behavior (no browser session needed)

Use the valid `cortex` 9router key to exercise prompts exactly as the generator
would, e.g. to confirm persona / integration / soul behavior:

```bash
CK=$(sudo python3 -c "import sqlite3; print(sqlite3.connect('file:/home/cortexos/.9router/db/data.sqlite?mode=ro&immutable=1',uri=True).execute(\"SELECT key FROM apiKeys WHERE name='cortex' AND isActive=1\").fetchone()[0])")
curl -skS http://127.0.0.1:11434/v1/chat/completions -H "authorization: Bearer $CK" \
  -H 'content-type: application/json' \
  -d '{"model":"gc/gemini-2.5-flash","stream":false,"messages":[
       {"role":"system","content":"<paste the current SYSTEM_PROMPT>"},
       {"role":"user","content":"who are you?"}],"max_tokens":150}'
```

The full interview path also needs an authenticated admin session (PAM,
`cortexos-admin` group) to drive the WS — use that for true end-to-end tests.

## 8. Definition of "perfect shape"

- A logged-in admin can open `/agents/new`, pick a model or a preset, run the
  interview, hand the AI any MCP server + API keys, and **create a working
  Hermes profile** that comes up healthy with the designed SOUL.md, integrations,
  and isolated per-profile credentials.
- `typecheck` clean, `pnpm lint` rc=0, generator tests green, the full build runs
  end to end on a real profile, both services stable, no secret leakage.
- Every gap in Section 5 is either closed or consciously deferred with a reason.

Start by re-verifying Section 3 against the running system, then attack Section 5
in priority order. Show evidence at every step.
