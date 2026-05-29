# 31 - 9Router

9Router stays on the host as the shared AI routing service.

Requirements:

- Env file: `/opt/cortexos/.secrets/9router.env`.
- Health: `GET http://127.0.0.1:11434/v1/models`.
- Project instances receive only the model access they need.

Record health and model-list evidence in `PLAN.md`.

## Hermes consumption + fallback

Every Hermes profile uses 9Router as its **primary** LLM provider:

```yaml
# <profile>/config.yaml
model:
  provider: 9router
  base_url: http://127.0.0.1:11434/v1
```

9Router's `claude-fallback` combo model gives provider-level failover
(cc/claude → cx/gpt → …) **while 9Router is up**.

To survive 9Router being **down** (connection error), each profile also sets a
Hermes-level fallback that bypasses 9Router and points **directly** at the
local ollama, so the agent stays alive (liveness, not full quality):

```yaml
fallback_providers:
- provider: custom
  model: llama3.2:1b
  base_url: http://127.0.0.1:11435/v1   # direct ollama, NOT via 9Router
  key_env: OLLAMA_API_KEY               # dummy value (e.g. "ollama"); ollama ignores it
```

Hermes tries the fallback chain on rate-limit / 5xx / connection errors.
Verify with `hermes --profile <p> fallback list`.

**Inside Incus project instances** there is no local ollama: the
`project-instances` phase of `scripts/rebuild/apply.sh` adds a `proxy-ollama`
device (instance loopback `:11435` → host ollama) alongside `proxy-9router`,
so the same `127.0.0.1:11435` fallback URL works unchanged. The instance
`config.yaml` is copied from the host profile, so the fallback propagates.
