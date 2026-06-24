# CortexOS Engineering Playbook — Agent Generator Case Study

> A technical wiki article derived from a real engineering session on CortexOS.
> It teaches the system's moving parts, the deploy/verify workflow, the
> prompt-engineering patterns, and the operational gotchas — using the rise and
> eventual removal of the **Agent Generator** as the worked example.
>
> Audience: engineers and operators working on CortexOS at `/opt/cortexos`.

---

## 1. System map (what you are working with)

CortexOS is a self-hosted AI infrastructure monorepo (pnpm workspace, Node 22)
served on a single Tailscale MagicDNS host (`cortexos.tailfd052e.ts.net`) with
**path-based** reverse proxying — no subdomains.

| Layer | What it is | Where |
|---|---|---|
| **Dashboard** | TanStack Start + React 19 control panel | `packages/dashboard-next`, `cortex-dashboard.service` on `:3080` |
| **9Router** | OpenAI-compatible AI gateway (chat + responses APIs) | `http://127.0.0.1:11434/v1`, key in `/opt/cortexos/.secrets/9router.env` |
| **Caddy** | TLS termination + path reverse-proxy | `/etc/caddy/Caddyfile`, fronted by `tailscale serve` |
| **Postgres** | Dashboard DB | `127.0.0.1:5432/cortex_dashboard`, creds in `/opt/cortexos/.secrets/dashboard.env` |
| **Hindsight** | Canonical cross-session memory store | `http://127.0.0.1:8888/v1`, per-profile banks `hermes-<slug>` |
| **Hermes profiles** | Deployed single-purpose agents | `/opt/cortexos/hermes/profiles/<slug>`, secrets in `/opt/cortexos/.secrets/hermes/<slug>.env` (mode 0600), `hermes-<slug>.service` |

**Mental model of a request:** browser → `tailscale serve` (HTTPS) → Caddy
(path match) → dashboard `:3080` **or** a sidecar (loopback port). The dashboard
talks to 9Router for model calls and to Postgres for state.

---

## 2. What the Agent Generator was (and why it was removed)

The **Agent Generator** (`/agents/new`) was a dashboard feature that interviewed
an operator and emitted a **ProfileSpec** (JSON), which a build pipeline turned
into a deployed Hermes profile. It had three runtime paths:

1. A **WebSocket sidecar** (`packages/cortex-agent-generator`, `:3082`) that
   streamed the AI chat and also spawned a live root-bash PTY.
2. An **RPC fallback** (`generatorTurn` in `dashboard-next/.../llm.ts`) used when
   the sidecar was unavailable.
3. A **build pipeline** (`build.ts`) that wrote profile files + `.env`.

It was ultimately **removed** in favor of running the interview as a prompt
inside the VPS AI harness. The removal is itself a teaching example (see §8).

The interview prompt lives on at `docs/agent-generator/HARNESS_PROMPT.md`.

---

## 3. The deploy / verify workflow (the most reusable part)

Every behavior change on CortexOS follows the same loop. **Memorize this.**

```
edit → gates → build → restart → smoke → commit/push
```

### 3.1 Gates (run from repo root)

```bash
# Sidecar (plain Node, no build step) — syntax only:
node --check packages/cortex-agent-generator/src/server.js

# Dashboard:
pnpm --filter @cortexos/dashboard-next typecheck   # tsc --noEmit — catches dangling refs
pnpm --filter @cortexos/dashboard-next lint         # eslint; 12 baseline react-refresh warnings are OK, 0 errors required
pnpm --filter @cortexos/dashboard-next test         # vitest
pnpm --filter @cortexos/dashboard-next build        # vite build → .output/
```

- **Subagents never run gates.** When you fan work out, the orchestrator runs
  typecheck/lint/test/build/format **once** at the end across the union of
  changed files. Subagents do the edit only.
- **Prettier is a lint gate.** Subagent edits often fail `prettier/prettier`;
  fix with `pnpm --filter @cortexos/dashboard-next exec prettier --write <files>`
  then re-lint.
- **`migrate-filter.test.ts` is a known serial flake.** If the full suite shows
  exactly that one failing, re-run it isolated to confirm:
  `pnpm exec vitest run src/server/db/__tests__/migrate-filter.test.ts`.

### 3.2 Deploy

- **Dashboard:** `pnpm build` (serves from `.output/`) **then**
  `sudo systemctl restart cortex-dashboard.service`. A code edit is NOT live
  until rebuilt + restarted.
- **A plain-Node sidecar** (read directly by `node ./src/server.js`) only needs
  a `systemctl restart` — no build.

### 3.3 Smoke test

```bash
curl -s -o /dev/null -w "%{http_code}" http://127.0.0.1:3080/login   # expect 200
curl -s -o /dev/null -w "%{http_code}" http://127.0.0.1:3080/agents  # expect 307 (auth redirect)
```

`307` on an authenticated route means "page exists, redirecting to auth" — that
is healthy. A removed route also returns `307` (it falls through), so pair smoke
checks with a `routeTree.gen.ts` inspection when verifying a deletion.

---

## 4. Prompt engineering on a live model (hard-won lessons)

The Agent Generator's core was a long system prompt. Most of the session was
spent learning that **prompt wording is weaker than people assume.** The lessons
generalize to any LLM feature on CortexOS.

### 4.1 Test the REAL model, not a roleplay subagent

A subagent asked to "play the model" **re-reads the rules and complies** — a
false positive. The production model with a long real conversation does not.
Always test against the actual gateway:

```js
// stream:false is REQUIRED — 9Router streams SSE by default, which breaks res.json()
fetch("http://127.0.0.1:11434/v1/chat/completions", {
  method: "POST",
  headers: { authorization: `Bearer ${key}`, "content-type": "application/json" },
  body: JSON.stringify({ model: "cc/claude-opus-4-8", messages, stream: false }),
});
```

Gotchas:
- 9Router serves **both** `/v1/chat/completions` and `/v1/responses` (both 200).
  The `@ai-sdk/openai` v2 `openai(model)` callable uses the **Responses API**
  (`/v1/responses`); the base URL must include `/v1` or you 404.
- A long prompt (~30 KB) can **time out** at 300 s for deep-reasoning models, or
  502. Mitigate by asking for terse output and raising the HTTP timeout.

### 4.2 "Lost in the middle" — recency beats buried rules

Rules placed mid-prompt get under-weighted. Re-asserting them as the **final**
message (after the last user turn) is the strongest lever. In CortexOS the
interview used a transient "last-mile reminder" injected each turn — **not**
persisted to history.

### 4.3 The decisive failure: multi-turn history pollution

The real bug behind "the agent won't interview, it just writes code and shell
commands": once **one** architect-style assistant reply (Python, SQL schema,
component tree, `tailscale serve …`) is in `state.history`, the model **imitates
its own prior output**, and no system reminder — even hardened, even placed
last — overrides that in-context precedent.

Two facts made this hard to see:
- The WS sidecar did **not** persist assistant turns to Postgres; the architect
  replies lived only in the connection's in-memory `state.history`. So a pasted
  transcript was real even though the DB session showed `transcript len 1`.
- Clean / fresh sessions always complied; only contaminated multi-turn sessions
  failed. So narrow tests passed while the live feature failed.

**The fix is structural, not more wording:** neutralize the imitable artifact in
history. Strip fenced code blocks from **prior assistant turns** before
replaying them (user turns untouched):

```js
function neutralizeArchitect(text) {
  return text.replace(/```[\s\S]*?```/g,
    "[earlier draft content removed — you are an interviewer, not a code author]");
}
```

**Takeaway for CortexOS LLM features:** *Prompt-only steering loses to
in-context behavioral precedent. Fix the history (remove what the model is
imitating); don't just add more rules.* And: a session already deep in the wrong
mode is best recovered by starting fresh — history surgery removes the worst
output but not the established conversational mode.

### 4.4 Two prompt copies must stay byte-identical

The WS sidecar (`server.js`) and the RPC fallback (`llm.ts`) carried the same
`SYSTEM_PROMPT` / `TURN1_SYSTEM_PROMPT` / `LATER_TURN_REMINDER`. After any edit,
verify the **runtime string value** matches (unescape `\`` / `\$` first):

```bash
node -e '
const fs=require("fs"),crypto=require("crypto");
const grab=(s,n)=>s.match(new RegExp("const "+n+" = `([\\s\\S]+?)`;"))[1]
  .replace(/\\`/g,"`").replace(/\\\$/g,"$");
const h=x=>crypto.createHash("sha256").update(x).digest("hex").slice(0,16);
// compare h(grab(fileA,name)) === h(grab(fileB,name)) for each prompt const
'
```

---

## 5. Security: never let secrets touch the chat / spec / mint payload

Operators repeatedly pasted live credentials (a Telegram bot token, GitHub PATs)
into the chat. **Any secret that touches the chat is burned and must be rotated.**
CortexOS hardened this in layers:

1. **Redaction of the imitable channel.** A `redactSecrets()` helper masks
   Telegram tokens (`\d{8,10}:AA…`), Atlassian (`ATATT…`), GitHub PATs
   (`ghp_…`, `github_pat_…`), `Bearer …`, and `key|token|secret=` assignments to
   `[REDACTED]` before pushing user/assistant turns to history and before
   sending text to any secondary model (advisor/skeptic panels).

2. **Prompt gate.** The system prompt forbids echoing, quoting, or embedding a
   secret in prose/code/commands; it acknowledges capture only and tells the
   operator to rotate anything they pasted.

3. **Out-of-band secret entry** (the proper fix). The interview declares secret
   **slots** (key names, empty values); real values are entered separately and
   **never** enter the transcript, the spec, or the approval-mint payload:
   - `setGeneratorSecret` server-fn (POST, admin, CSRF) validated each key
     against the **session spec's declared slots** (no arbitrary env injection),
     staged the value to `${SECRETS_DIR}/.staging/<sessionId>.env` (dir `0700`,
     file `0600`), and returned **key names only**.
   - The build merged staged values into the profile `.env` and cleared the
     staging file **only after all critical build steps succeeded** (survives a
     partial-failure retry).
   - A **server-side preflight** refused to build unless every required secret
     was staged — UI gating alone is bypassable.
   - The client deep-sanitized the spec (blank env values + token) **before**
     minting the approval token, so no secret entered the hash/payload.

**General rule:** approval tokens hash the full request input. If a secret is in
that input, it leaks into mint logs. Keep secrets out of the input entirely.

---

## 6. Multi-model code review (a repeatable CortexOS workflow)

To audit a feature, run **context-free** reviews across several models, then
triage against real source. (See the `cortexos-multi-model-review` and
`omp-json-mode-extraction` skills.)

1. **Split the artifact** into self-contained payloads (e.g. prompt-only and
   wiring/logic) so each model call is focused. Reviewers get **no repo access**
   — only the inlined code.
2. **Call models via 9Router HTTP** with `stream:false`. Working ids:
   `cc/claude-opus-4-8`, `cx/gpt-5.5`, `minimax/minimax-m3:high`. For a long
   payload, append a terse-output directive and raise the timeout (a 30 KB
   payload times out / 502s otherwise).
3. **Triage every finding against the real file.** ~50% are false positives
   because models review summaries, not code. **Cross-model agreement is the
   high-signal filter** — when two independent models flag the same thing
   (e.g. a duplicated schema block), it is almost always real.
4. **Fan out fixes by DISJOINT files**, one subagent per file; the orchestrator
   keeps byte-identical edits (like the twin prompts) for itself, runs gates
   once, and commits.

---

## 7. Orchestration & parallelism conventions

- **Parallelize with `task` subagents** when work decomposes into disjoint
  files. Each assignment is self-contained (no shared context), names ≤3–5
  explicit files, and is told to **skip all gates/format/commit**.
- **Serialize** only when one subagent produces a contract another consumes
  wholesale (types, schema, a shared module).
- **Coordinate live over IRC**, not by polling artifacts. A backend change that
  affects a sibling's work (e.g. adding a server-fn field) is a DM, not a silent
  edit.
- The orchestrator owns: verification, formatting, byte-identical twin edits,
  and the single commit.

---

## 8. Removing a feature cleanly (the deletion checklist)

Removing the Agent Generator touched code, DB, systemd, and Caddy. Use this as a
template for any dashboard feature removal.

**Delete** (source):
- feature component + route + tests; server-fn module + tests; any WS client
  helper (`generatorWs.ts`) + tests; the `server/agents/**` logic dir; the DB
  repo; the workspace package.

**Dereference** (edit):
- `lib/api/client.ts` — imports + exported bindings (and any types they own).
- `app/NavConfig.ts` — the nav item **and** the `NavKey` union member; drop a
  now-unused icon import.
- `i18n/en.ts` — the nav label.
- `server/db/schema.ts` — the table def, the `schema` registry entry, type
  exports.
- `server/approval/index.ts` — any approval action-string allowlist entry.
- test files with `vi.mock(...)` lists referencing removed exports.

**Infra** (host):
- `sudo systemctl disable --now <svc>` then `rm` the unit + `daemon-reload`.
- Remove the Caddy block, `caddy validate`, then **`systemctl restart caddy`**
  (see gotcha §9).

**Operational gotchas that bite during removal:**
- `routeTree.gen.ts` is **auto-generated** by the TanStack build — never
  hand-edit it. Delete the route file and **rebuild**; it still shows the old
  route until the post-deletion build runs.
- After deleting a workspace package, run `pnpm install --lockfile-only` to drop
  it from `pnpm-lock.yaml`.
- **`typecheck` is the best completeness check** — if it passes, no dangling
  references remain.
- A removed DB table's physical rows persist in Postgres; dropping them needs a
  migration. Removing the code refs is enough to "remove the feature"; schedule
  the `DROP TABLE` separately.

---

## 9. Operational gotchas reference card

| Symptom | Cause | Fix |
|---|---|---|
| `caddy reload` fails: `dial tcp 127.0.0.1:2019: connection refused` | The running Caddy has the **admin API disabled**, so hot-reload can't post config | `caddy validate` then **`systemctl restart caddy`**. The old instance keeps serving during the failed reload, so the dashboard stays up. |
| `res.json()` throws `Unexpected token 'd', "data: {…"` | 9Router streamed SSE | add `stream:false` to the request body |
| ai-sdk call 404s on `/responses` | base URL missing `/v1`, or wrong API surface | base = `…:11434/v1`; ai-sdk v2 `openai(model)` uses the Responses API |
| Full test suite shows 1 failure in `migrate-filter.test.ts` | known serial flake | re-run that file isolated; it passes |
| Edited `.ts` but behavior unchanged | dashboard serves `.output/` | `pnpm build` + `systemctl restart cortex-dashboard.service` |
| Deleted route still in `routeTree.gen.ts` | it's generated | rebuild; never hand-edit |
| `git add -A` about to stage `docs/agent-generator/SECRETS.md.backup*` | that dir holds 80+ secret backups, **not** gitignored | stage by path (`git add -u packages/ …`), assert `git diff --cached --name-only | grep -c SECRETS.md.backup` == 0 |
| Pasted a secret in chat | it's in the transcript/logs | **revoke + reissue**; never reuse |

---

## 10. Conventions to internalize

- **Secrets** live in `.secrets/*.env` (mode 0600) or the per-profile
  `.env` — never in code, chat, spec, or git. SOPS+age for committed secrets.
- **Two services touch shared data?** Both need rebuild + restart after a change
  (e.g. dashboard + a mail-guardian processor on the same table).
- **Add regression tests when a bug came from missing coverage** — and write a
  test that fails on revert (contract tests for approval gates, drift assertions
  for twin prompts).
- **Don't ship stubs/placeholders as done.** "Done" means the behavior works end
  to end, verified by the specific test/scenario that exercises the change.
- **Commit shape is the operator's call** — don't commit without a go-ahead when
  scope is undecided. Always secret-scan the staged diff before committing.

---

## Appendix A — Session change log (commits)

| Commit | What |
|---|---|
| `62803157` | Turn-1 confirm flow (Mission→Topology→How→Confirm gate) + role-guard + secret-echo gate; split minimal turn-1 prompt |
| `71c3fc09` | Multi-model-review hardening: secret redaction, orphan-turn rollback, reasoning-capability gate, model allowlist, panel error handling, WS double-send guard |
| `71b0e2d1` | Out-of-band secret entry: `secretStaging`, `setGeneratorSecret`, Secrets panel, build preflight + merge/clear |
| `361761ce` | Multi-turn architect-drift fix: `neutralizeArchitect` (strip code from prior assistant turns), reminder moved to final message, hardened wording |
| `7fa14051` | Full removal of the Agent Generator from the dashboard; interview prompt preserved at `docs/agent-generator/HARNESS_PROMPT.md` |

## Appendix B — Key paths

```
/opt/cortexos/.secrets/9router.env            # NINEROUTER_API_KEY, NINEROUTER_BASE_URL
/opt/cortexos/.secrets/dashboard.env          # DATABASE_URL, session keys
/opt/cortexos/.secrets/hermes/<slug>.env      # per-profile creds (0600)
/etc/caddy/Caddyfile                          # path reverse-proxy; restart (not reload) to apply
/etc/systemd/system/cortex-dashboard.service  # dashboard unit
packages/dashboard-next/                       # the control dashboard
docs/agent-generator/HARNESS_PROMPT.md         # preserved interview prompt
docs/wiki/cortexos-engineering-playbook.md     # this article
```
