# 35a - Configure a local AI harness to use 9Router models

## Purpose

Pick the right 9Router model for each task in your local AI harness
(Claude Code, Aider, OMP/PI, OpenCode, Hermes, etc.) and wire it up so every
session reaches the CortexOS VPS through the tunnel from
`prompts/tools/34-local-ai-harness.md`.

This prompt does **not** install anything new — the tunnel and credential
plumbing already exist. It just teaches the local operator which 9Router model
to pick, what it costs, and how to override it per-harness.

## Prerequisites

- `prompts/tools/34-local-ai-harness.md` completed. The `cortexos-vps-tunnel`
  user service is forwarding `127.0.0.1:11434` to the VPS.
- `NINEROUTER_API_KEY` is exported in `~/.bashrc` / `~/.zshrc` from the harness
  installer (it's the same value as `${OPENAI_API_KEY}` locally).
- The local machine can reach `http://127.0.0.1:11434/v1/models` and get a 200.

```bash
curl -fsS -H "Authorization: Bearer ${NINEROUTER_API_KEY}" \
  http://127.0.0.1:11434/v1/models | python3 -c "import sys,json;print(len(json.load(sys.stdin)['data']),'models')"
```

Expected: a number ≥ 60.

## The canonical 9Router model set

9Router exposes 70+ aliases; you do not need to learn them all. These ten
cover every realistic harness task.

> **Naming convention.** The bare model id is the part after `9router/` —
> e.g. `cc/claude-opus-4-8`. Use the **bare** id with every OpenAI-compatible
> client (`curl`, Aider, OpenCode, Claude Code's `--model`, etc.). The
> `9router/` prefix is an OMP-internal routing hint — only add it when
> invoking OMP itself. See [OMP / PI](#omp--pi) below for the prefix rule.

### Frontier reasoning (use for the hard work)

| Bare model id | Provider | Context | $/1M in/out | Thinking | Best for |
| --- | --- | --- | --- | --- | --- |
| `cc/claude-opus-4-8` | Anthropic | 1M | $5.00 / $25.00 | yes (xhigh) | Long autonomous refactors, system design |
| `cx/gpt-5.5` | OpenAI | 1M | $2.50 / $15.00 | yes (xhigh) | General coding, code review, agentic |
| `gc/gemini-3.1-pro` | Google | 2M | $2.00 / $12.00 | yes (xhigh) | Repo-wide context, multi-file reasoning |
| `kimi/kimi-k2.7` | Moonshot | 256K | $0.95 / $3.80 | yes (high) | Cheap code review, fast iteration |

### Mid-tier (the everyday choice)

| Bare model id | Provider | Context | $/1M in/out | Thinking | Best for |
| --- | --- | --- | --- | --- | --- |
| `minimax/MiniMax-M3` | minimax | 1M | $0.30 / $1.20 | yes (xhigh) | Daily driver — strong + cheap |
| `glm/glm-5.2` | Z.ai | 1M | $0.26 / $1.40 | yes (xhigh) | Coding tasks; MIT-licensed fallback path |
| `cx/gpt-5.3-codex` | OpenAI | 1M | $1.50 / $12.00 | yes (xhigh) | Code generation with structured output |

### Fast / cheap (use when you need iteration speed)

| Bare model id | Provider | Context | $/1M in/out | Thinking | Best for |
| --- | --- | --- | --- | --- | --- |
| `cc/claude-haiku-4-5-20251001` | Anthropic | 1M | $1.00 / $5.00 | no | Quick completions, summaries |
| `gc/gemini-3-flash-preview` | Google | 1M | $0.075 / $0.30 | no | Bulk classification, RAG |
| `kimi/kimi-k2.6` | Moonshot | 256K | $0.95 / $3.80 | yes (high) | Cheap reasoning; older K2.5 if you need stable |

### Local / free (no cost, works offline)

| Bare model id | Provider | Context | Cost | Best for |
| --- | --- | --- | --- | --- |
| `ollama-local/llama3.2:1b` | local ollama | 128K | $0 | Liveness, smoke tests |
| `openrouter/google/gemma-4-26b-a4b-it:free` | OpenRouter free | 128K | $0 | Throwaway tasks |

### Cloudflare Workers AI (separate config, see prompt 31)

| Bare model id | Provider | Cost | Best for |
| --- | --- | --- | --- |
| `cf/@cf/moonshotai/kimi-k2.6` | Cloudflare | $0.95 / $3.80 | When Anthropic/OpenAI rate-limit |

## Picking the right model

Decision tree (start at the top, drop down only when cost is a concern):

1. **What does OMP say?** OMP's `modelRoles` already maps task types to models
   — when OMP is your entry point (default for Cortex Hermes), it picks for
   you. Don't override unless you know why.
2. **Need a 1M context window for a giant refactor?** `gc/gemini-3.1-pro`
   (2M) or `cc/claude-opus-4-8` (1M).
3. **Default coding task** (you'd reach for Sonnet on the OpenAI/Anthropic
   direct APIs)? `cx/gpt-5.5` or `minimax/MiniMax-M3`. M3 is ~8× cheaper than
   Sonnet at $0.30/$1.20.
4. **Code review pass** (you'd reach for Sonnet/Opus direct)? `kimi/kimi-k2.7`
   at $0.95/$3.80 is the cost-effective choice; `cc/claude-sonnet-4-6` at
   $3.00/$15.00 if you need the Anthropic-flavoured reviewer.
5. **Cheap iteration loop / sub-agent dispatch** (you'd reach for Haiku)?
   `gc/gemini-3-flash-preview` ($0.075/$0.30) or
   `cc/claude-haiku-4-5-20251001` ($1.00/$5.00).
6. **9Router is up but the provider is throttling?** `claude-fallback`
   combo model gives provider-level failover (cc/ → cx/ → kimi) while 9Router
   is up. See `prompts/tools/31-9router.md`.
7. **9Router is down?** Each profile also has a Hermes-level fallback to
   local ollama on `:11435`. See `prompts/tools/31-9router.md` § "Hermes
   consumption + fallback".

## Wiring it into each harness

> **Reminder:** every example below uses the **bare** model id (no `9router/`
> prefix) unless the harness is OMP. The 9Router OpenAI-compatible endpoint
> expects `cc/claude-opus-4-8`, not `9router/cc/claude-opus-4-8`. The
> `9router/` prefix is only used by OMP itself.

### Claude Code

Claude Code uses `--model` (or the `/model` slash command). Pass the **bare**
9Router alias:

```bash
claude --model "minimax/MiniMax-M3:high"
claude --model "cx/gpt-5.5:high"
claude --model "kimi/kimi-k2.7:high"
```

The `:high` / `:xhigh` / `:medium` / `:low` suffix is the reasoning effort.
Omit it for non-reasoning models (`cc/claude-haiku-4-5-20251001`,
`gc/gemini-3-flash-preview`).

Persist the default in `~/.claude/settings.json`:

```json
{
  "model": "cx/gpt-5.5:high"
}
```

### Aider

Aider takes `--model`; pass the bare alias and configure the gateway in
`~/.aider.conf.yml`:

```yaml
model: openai/cx/gpt-5.5
api_base: http://127.0.0.1:11434/v1
api_key: ${NINEROUTER_API_KEY}
```

Aider prefixes its model names with the API family; `openai/` makes it speak
the OpenAI Chat Completions protocol to 9Router. The part **after** the
`openai/` prefix is the bare 9Router id.

### OMP / PI

OMP routes the `9router/` prefix internally. Pass the model id **with** the
prefix when invoking OMP:

```bash
omp --model "9router/cx/gpt-5.5:high" -p "..."
omp --model "9router/minimax/MiniMax-M3:high" -p "..."
```

OMP reads its models from `~/.omp/agent/models.yml` (curated) and the live
catalog from 9Router. To change the project defaults, edit `modelRoles` in
`~/.omp/agent/config.yml` (the OMP file, not the 9router one). Do not edit
`~/.omp/agent/models.yml` to change a default — that's the override map for
metadata (context, cost), not the routing table.

Recommended `modelRoles` block for the 9Router catalog — paste this into
`~/.omp/agent/config.yml` (the `minimax-code/...` defaults ship with OMP and
do not resolve via 9Router, so replace them):

```yaml
modelRoles:
  default: 9router/glm/glm-5.2:high
  plan: 9router/cc/claude-opus-4-8:xhigh
  slow: 9router/cc/claude-opus-4-8:xhigh
  smol: 9router/minimax/MiniMax-M3:high
  task: 9router/minimax/MiniMax-M3:high
  vision: 9router/cx/gpt-5.5:xhigh
  commit: 9router/minimax/MiniMax-M3:medium
  designer: 9router/cx/gpt-5.5:high
  advisor: 9router/minimax/MiniMax-M3:xhigh
```

### OpenCode

OpenCode accepts the same OpenAI-compatible model names. In
`~/.config/opencode/config.json`:

```json
{
  "model": "cx/gpt-5.5",
  "provider": {
    "openai": {
      "api": "openai-completions",
      "baseURL": "http://127.0.0.1:11434/v1",
      "apiKey": "${NINEROUTER_API_KEY}"
    }
  }
}
```

### Hermes (per profile)

Hermes already routes through 9Router when its profile is configured per
`prompts/tools/31-9router.md`. To change the default per profile, edit
`hermes/profiles/<name>/config.yaml`:

```yaml
model:
  provider: 9router
  base_url: http://127.0.0.1:11434/v1
  # Replace the model id below. The `:high` suffix sets reasoning effort.
  default: cx/gpt-5.5:high
```
## Reasoning effort suffixes

| Suffix | Maps to | Use when |
| --- | --- | --- |
| `:minimal` / `:low` | token-efficient reasoning | short answers, classification |
| `:medium` | balanced | default for most work |
| `:high` | full reasoning | code review, refactors |
| `:xhigh` | max reasoning | multi-hour planning sessions |
| (no suffix) | no reasoning | non-reasoning models (Haiku, Flash, ollama-local) |

Not every model supports every level. The 9Router catalog is the source of
truth — if you pass an unsupported level it falls back to `:medium` silently.

## Cost awareness

The cost column in the tables above is the **per-1M-token** rate. A 1k-token
prompt + 4k-token completion against `cx/gpt-5.5` costs:
$0.0025 (input) + $0.0600 (output) = $0.0625 per request. Against
`minimax/MiniMax-M3` the same request costs $0.0003 + $0.0048 = **$0.0051** —
**12× cheaper**.

Reasoning tokens (where supported) are billed at the model's **output** rate.
A 30-minute `cc/claude-opus-4-8:xhigh` run that consumes 50K reasoning tokens
+ 5K visible output costs: 50K × $25/1M = $1.25 (reasoning) + 5K × $25/1M =
$0.125 (output) = $1.375 for one turn. Set a budget before you start a long
session.

## Verify

Pick one model from each tier and run it through your harness:

```bash
# Frontier (bare model name; 9Router expects no 9router/ prefix)
curl -fsS -H "Authorization: Bearer ${NINEROUTER_API_KEY}" \
  http://127.0.0.1:11434/v1/chat/completions -H "Content-Type: application/json" \
  -d '{"model":"cx/gpt-5.5","messages":[{"role":"user","content":"Reply OK"}],"max_tokens":10}' \
  | python3 -c "import sys,json;print(json.load(sys.stdin)['choices'][0]['message']['content'])"
# Expected: OK

# Cheap
curl -fsS -H "Authorization: Bearer ${NINEROUTER_API_KEY}" \
  http://127.0.0.1:11434/v1/chat/completions -H "Content-Type: application/json" \
  -d '{"model":"gc/gemini-3-flash-preview","messages":[{"role":"user","content":"Reply OK"}],"max_tokens":10}' \
  | python3 -c "import sys,json;print(json.load(sys.stdin)['choices'][0]['message']['content'])"

# Reasoning
curl -fsS -H "Authorization: Bearer ${NINEROUTER_API_KEY}" \
  http://127.0.0.1:11434/v1/chat/completions -H "Content-Type: application/json" \
  -d '{"model":"kimi/kimi-k2.7","messages":[{"role":"user","content":"Reply OK"}],"max_tokens":10,"reasoning_effort":"high"}' \
  | python3 -c "import sys,json;print(json.load(sys.stdin)['choices'][0]['message']['content'])"

# OMP via the harness (uses the 9router/ prefix OMP convention)
omp --model "9router/cx/gpt-5.5" --no-session --no-tools 'Reply OK'
```

All four should print `OK`. If one fails, check the tunnel first:
`systemctl --user status cortexos-vps-tunnel.service`.

## CHECKPOINT 1

**STOP — operator question:** Did the four verification calls above all return `OK`?

Type `confirmed` to proceed.

## CHECKPOINT 2

**STOP — operator question:** Did `omp --model "9router/minimax/MiniMax-M3"` return "OK"?

Type `confirmed` to proceed.
## Command reference

| Command | What it does |
| --- | --- |
| `curl -fsS -H "Authorization: Bearer ${NINEROUTER_API_KEY}" http://127.0.0.1:11434/v1/models` | List the live 9Router catalog |
| `claude --model "cx/gpt-5.5:high"` | Run Claude Code through the VPS with GPT-5.5 |
| `omp --model "9router/cx/gpt-5.5:high" -p "..."` | One-off OMP run on GPT-5.5 |
| `systemctl --user restart cortexos-vps-tunnel.service` | Restart the SSH tunnels if 9Router is unreachable |


## Next

- Pin your default per-harness (Claude Code `~/.claude/settings.json`, Aider
  `~/.aider.conf.yml`, OMP `~/.omp/agent/config.yml modelRoles`, Hermes
  `hermes/profiles/<name>/config.yaml`).
- For per-task overrides inside a session, see each harness's `--model` flag.
- The full 9Router catalog is the source of truth for everything not in this
  prompt: `curl http://127.0.0.1:11434/v1/models` returns all 70+ aliases.
