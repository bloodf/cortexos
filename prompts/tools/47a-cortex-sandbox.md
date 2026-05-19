# cortex-sandbox-runner — gVisor tool exec sandbox (V10)

## Purpose

Deploy the `cortex-sandbox-runner` service. Provides isolated execution
for agent tool invocations: every `/exec` call spawns a short-lived
`podman --runtime=runsc` guest container. The runner becomes the
execution path for any agent role whose template frontmatter sets
`sandboxRequired: true` once `CORTEX_SANDBOX_URL` is exported into
`cortex-consumer`.

See `docs/SANDBOX.md` for the threat model and
`stacks/cortex-sandbox-runner/README.md` for the developer surface.

## Prerequisites

- `11-docker.md` completed — Docker Engine present.
- `12a-sops-bootstrap.md` completed — `sandbox.env` must be decryptable
  via `scripts/secrets-decrypt.sh`.
- `60-cortex-consumer.md` completed — V10 consumer routes sandbox-eligible
  roles through `CORTEX_SANDBOX_URL` when configured.

## Distro selection

```bash
source scripts/pkg.sh
echo "OS family: $(pkg_family) $(pkg_version)"
: "${CORTEX_OS_FAMILY:?run prompts/os/00-os-selection.md first}"
```

## CHECKPOINT 1

Operator: confirm the VPS kernel exposes user namespaces
(`sysctl kernel.unprivileged_userns_clone` reports `1` on Debian/Ubuntu)
and Docker daemon is running. Type "confirmed" to proceed.

## Decrypt the secret

```bash
sudo install -d -o root -g root -m 0750 /opt/cortexos/.secrets
sudo scripts/secrets-decrypt.sh sandbox
sudo chmod 0640 /opt/cortexos/.secrets/sandbox.env
```

`templates/.secrets/sandbox.enc.yaml` MUST define:

```yaml
CORTEX_SANDBOX_API_TOKEN: <random 256-bit hex>
```

Generate fresh with:

```bash
openssl rand -hex 32
```

## Build and start

```bash
cd /opt/cortexos/stacks/cortex-sandbox-runner
docker compose build
docker compose up -d
```

## Smoke test

```bash
TOKEN="$(grep -E '^CORTEX_SANDBOX_API_TOKEN=' /opt/cortexos/.secrets/sandbox.env | cut -d= -f2-)"

# Health
curl -fsS http://127.0.0.1:8091/healthz

# Exec under gVisor
curl -fsS -X POST http://127.0.0.1:8091/exec \
  -H "Authorization: Bearer ${TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{"image":"alpine:3","cmd":["sh","-c","uname -a; id"],"timeoutSec":15}' \
  | jq .
```

Expected: HTTP 200, `exitCode: 0`, and `stderr`/`stdout` reflecting an
unprivileged identity inside the sandbox.

## CHECKPOINT 2

Operator: confirm the smoke test returned `exitCode: 0`. Type "confirmed"
to proceed.

## Wire into the consumer

Append to `/opt/cortexos/.secrets/consumer.env`:

```ini
CORTEX_SANDBOX_URL=http://127.0.0.1:8091
CORTEX_SANDBOX_API_TOKEN=<same value as sandbox.env>
```

## Write the sandbox-required roster

`consumer.js` only routes through the sandbox when the role appears in
`/opt/cortexos/templates/agent-roles/.sandbox-required.json` (path
override: `CORTEX_SANDBOX_ROLES_FILE`). Without this file (or with an
empty array) dispatch is silently disabled. Seed a minimal roster —
add roles whose tool execution MUST run under gVisor:

```bash
sudo install -d -o root -g root -m 0755 /opt/cortexos/templates/agent-roles
sudo tee /opt/cortexos/templates/agent-roles/.sandbox-required.json <<'EOF'
["eng-backend"]
EOF
sudo chmod 0644 /opt/cortexos/templates/agent-roles/.sandbox-required.json
```

Then restart:

```bash
sudo systemctl restart cortex-consumer
journalctl -u cortex-consumer -n 50 --no-pager
```

The consumer logs `[sandbox] dispatched run=... role=... exit=...` for
each sandbox-eligible role on receipt of a
`cortex.paperclip.work.<role>` event. Failures log
`[sandbox] dispatch failed ...`. Confirm via:

```bash
journalctl -u cortex-consumer -n 200 --no-pager | grep -E '\[sandbox\] (dispatched|dispatch failed)'
```

## Rollback

```bash
docker compose -f /opt/cortexos/stacks/cortex-sandbox-runner/docker-compose.yml down
# Optional: unset CORTEX_SANDBOX_URL in consumer.env to fall back to the
# legacy direct-exec path until the service is re-deployed.
```

## Verification checklist

- [ ] `docker compose ps` shows `cortex-sandbox-runner` healthy.
- [ ] `/healthz` returns `200 {ok:true}`.
- [ ] Unauthenticated `/exec` returns `401`.
- [ ] `/exec` with a non-allow-listed image returns `400 policy_rejected`.
- [ ] `/exec` with `alpine:3` returns `exitCode:0` and `stats.timedOut:false`.
- [ ] `/opt/cortexos/templates/agent-roles/.sandbox-required.json` exists and lists the test role.
- [ ] Consumer logs show `[sandbox] dispatched` for the test role event.

## Next

→ `prompts/tools/49-openclaw-account-ops.md`
