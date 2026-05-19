# cortex-sandbox-runner

> V10 — gVisor (`runsc`) sandbox runner for agent tool execution.

Express service that accepts authenticated `POST /exec` requests and
spawns short-lived `podman --runtime=runsc run --rm` containers. Each
guest workload is isolated by gVisor's user-space syscall layer; the
service itself runs as an unprivileged `sandbox` user inside the
container with rootless podman + user-namespace mapping.

See [`docs/SANDBOX.md`](../../docs/SANDBOX.md) for the threat model and
operational runbook. See [`prompts/tools/47a-cortex-sandbox.md`](../../prompts/tools/47a-cortex-sandbox.md)
for VPS install steps.

## Endpoints

| Method | Path       | Auth   | Purpose                                    |
|--------|------------|--------|--------------------------------------------|
| GET    | `/healthz` | none   | Liveness probe                             |
| GET    | `/metrics` | none   | Prom-text counters                         |
| POST   | `/exec`    | Bearer | Spawn one sandboxed `podman run` invocation |

### `POST /exec`

Request:

```json
{
  "image":       "alpine:3",
  "cmd":         ["sh", "-c", "echo hi"],
  "env":         { "FOO": "bar" },
  "timeoutSec":  30,
  "cpuMillis":   1000,
  "memMB":       512,
  "networkMode": "none",
  "role":        "ENG-BACKEND",
  "stdin":       ""
}
```

Response:

```json
{
  "exitCode": 0,
  "stdout":   "hi\n",
  "stderr":   "",
  "stats":    { "durationMs": 412, "timedOut": false, "signal": null }
}
```

## Configuration (env)

| Variable                           | Default                 | Purpose                                |
|------------------------------------|-------------------------|----------------------------------------|
| `PORT`                             | `8091`                  | Bind port                              |
| `CORTEX_SANDBOX_API_TOKEN`         | _(required)_            | Bearer token; service refuses requests when unset |
| `CORTEX_SANDBOX_PODMAN_BIN`        | `podman`                | Override for testing                   |

Token lives in SOPS-encrypted `templates/.secrets/sandbox.enc.yaml` and
decrypts to `/opt/cortexos/.secrets/sandbox.env` per the standard
`scripts/secrets-decrypt.sh` flow.

## Policy

`app/policy.js` enforces:

- **Image allow-list:** `alpine:3`, `node:22-slim`, `python:3.13-slim`,
  `debian:13-slim` by default.
- **Network modes:** `none` (default), `bridge`. `host` is forbidden.
- **Per-role quota ceilings** clamping `cpuMillis`, `memMB`, and
  `timeoutSec` so a misbehaving caller cannot exceed the role's
  budget.

Add a new image or role by editing `policy.js` and shipping a new
revision — there is intentionally no runtime override.

## Dev workflow

```bash
cd stacks/cortex-sandbox-runner/app
pnpm install
node --test ../tests/**/*.test.js
```

Tests inject a fake `spawn` so they run without podman or runsc.

## Production deploy

```bash
cd /opt/cortexos/stacks/cortex-sandbox-runner
docker compose pull
docker compose up -d
curl -fsS http://127.0.0.1:8091/healthz
```

The compose file keeps `privileged:false`, applies `no-new-privileges`,
mounts `/tmp` and `/run/user/2000` as tmpfs, and reserves a named
volume for rootless podman storage that lives and dies with the
service.
