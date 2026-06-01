# Paperclip + Hermes pipeline repair — 2026-05-27

## Symptom

Heartbeat runs across all three Paperclip companies (celebrar, 3guns, mementry)
were failing with `adapter_failed`:

| Org      | Failure rate (last ~300 runs) |
| -------- | ----------------------------- |
| celebrar | 85% (255 / 300)               |
| mementry | 52% (141 / 273)               |
| 3guns    | 35% (71 / 203)                |

Run logs showed two distinct upstream signatures plus one process-level bug.

## Root causes

### 1. `hermes-paperclip-adapter` corrupts env when bindings are wrapped

`hermes-paperclip-adapter/dist/server/execute.js` did:

```js
const userEnv = config.env;
if (userEnv && typeof userEnv === "object") {
    Object.assign(env, userEnv);
}
```

Paperclip's `envBindingSchema` is `union(string, {type:"plain",value:string}, {type:"secret_ref",...})`.
When agents are written via `PATCH /api/agents/:id` with plain-string env
values, Paperclip canonicalises them to `{type:"plain",value:string}` on
storage. `Object.assign`-ing those wrapped values into a Node `spawn` env
coerces them to the literal string `"[object Object]"`. The wrapper script
then ran with `HERMES_PROFILE=[object Object]` and Hermes exited 1 with
`Unknown provider '9router'` because nothing resolved.

Fix: replace `Object.assign` with an explicit unwrap loop that handles
`string`, `{type:"plain",value}`, and falls back gracefully on
`{type:"secret_ref",...}` (which Paperclip core resolves elsewhere).

```js
for (const [k, raw] of Object.entries(userEnv)) {
    if (typeof raw === "string") env[k] = raw;
    else if (raw && typeof raw === "object" && !Array.isArray(raw)) {
        if (raw.type === "plain" && typeof raw.value === "string") env[k] = raw.value;
        else if (typeof raw.value === "string") env[k] = raw.value;
    }
}
```

### 2. Per-provider rate limits / timeouts cascaded into adapter failures

Pre-fix, agents had `HERMES_MODEL` pinned to specific provider routes
(`cx/gpt-5.5`, `cc/claude-opus-4-7`, `kimi/kimi-k2.6`, `glm/glm-5.1`,
`minimax/MiniMax-M2.7`, …). Whenever the chosen upstream rate-limited or
timed out (Codex 429s, Claude 502 connect-timeouts during summarisation),
the entire heartbeat run failed.

Fix: every agent (66 total across the three orgs) now uses the existing
`claude-fallback` 9Router combo
(`[cc/claude-opus-4-7, cx/gpt-5.5, kimi/kimi-k2.6]`, round-robin) for
both `adapterConfig.model` and `adapterConfig.env.HERMES_MODEL`. New
profiles created via `scripts/paperclip-register-roles.ts`,
`scripts/hermes-profile-api.mjs`, and `scripts/hermes-profile-create.mjs`
default to `claude-fallback` going forward.

### 3. 9Router process OOM-killed without bounded restart guard

`9router.service` had `Restart=always` but no memory ceiling. The Node
binary peaked at ~995 MB and tripped the cgroup OOM killer at 02:26 UTC,
killing in-flight runs across all three companies.

Fix: drop-in `/etc/systemd/system/9router.service.d/10-hardening.conf`
sets `MemoryHigh=2G`, `MemoryMax=4G`, `MemorySwapMax=512M`,
`Restart=always`, `RestartSec=3`, `StartLimitBurst=10`,
`StartLimitIntervalSec=300` (latter two in `[Unit]`).

### 4. No active 9Router health check (process up ≠ routing healthy)

If 9Router stays alive but its routing layer wedges, systemd's
`is-active=active` lies. The dashboard's
`cortex-degraded-service-watcher` only catches `failed` units.

Fix: new `cortex-9router-health.timer` runs every 2 min and executes
`/usr/local/sbin/cortex-9router-healthcheck.sh`, which probes
`/v1/models` (5 s) then runs a real `chat/completions` against the
cheap local model `ollama-local/llama3.2:1b` (15 s). Either failure
triggers `systemctl restart 9router.service` and logs the cause.

## Files changed

| Path | Change |
| ---- | ------ |
| `paperclip/runtime/node_modules/hermes-paperclip-adapter/dist/server/execute.js` | Unwrap plain env bindings before spawn |
| `scripts/paperclip-register-roles.ts` | Default `model` + `HERMES_MODEL` → `claude-fallback` |
| `scripts/hermes-profile-api.mjs` | Default `HERMES_MODEL` → `claude-fallback` |
| `scripts/hermes-profile-create.mjs` | Default model arg → `claude-fallback` |
| `hermes/profiles.json` | All six profiles → `claude-fallback` |
| `.secrets/hermes/*.env` (×6) | `HERMES_MODEL=claude-fallback` |
| `/etc/systemd/system/9router.service.d/10-hardening.conf` | Memory bounds + restart limits (new) |
| `/etc/systemd/system/cortex-9router-health.{service,timer}` | Active probe (new) |
| `/usr/local/sbin/cortex-9router-healthcheck.sh` | Probe script (new) |

The 66 live agents (22 per company) were re-PATCHed via the Paperclip
API to flip `adapterConfig.model` and `adapterConfig.env.HERMES_MODEL`
to `claude-fallback`; obsolete `FALLBACK_MODEL` and `ANTAGONIST_MODEL`
env keys were stripped.

## Verification

After fix (05:28 UTC onward), 14 heartbeat runs:

- 12 succeeded
- 2 actively running (productive output; not stuck)
- 0 failed

Zero `adapter_failed` since the fix. The previously-failing
`HERMES_PROFILE=[object Object]` wrapper entries no longer appear — the
wrapper now logs `profile=3guns` / `profile=celebrar` / `profile=mementry`
as expected.

## Operator follow-ups (not done here)

These are user-side actions and out of scope for this repair:

- Re-authenticate dead OAuth providers: `claude` (expired 2026-05-23),
  `cursor` (2026-05-20), `gemini-cli` (2026-05-21). The `claude-fallback`
  combo currently relies on the `claude` connection refreshing via its
  refresh token; if that breaks, the combo still has `cx/gpt-5.5` and
  `kimi/kimi-k2.6` as round-robin partners.
- Today's 9Router spend was $1,884 across 18.3k requests, driven in part
  by the failure-retry loop. Now that runs succeed first time, daily
  spend should drop substantially. Monitor `usageDaily` in
  `~/.9router/db/data.sqlite`.
- 92 blocked issues across the three orgs are real product blockers
  (Laravel cutover, mobile Phase 09, Terraform/infra ownership). Now
  that the pipeline runs, agents can work them — but the blockers
  themselves are dependency-driven, not pipeline-driven.
