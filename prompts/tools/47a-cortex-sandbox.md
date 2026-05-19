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
- `60-cortex-consumer.md` is required only for the roster + end-to-end dispatch verification block near the end of this prompt. The service itself can be built earlier.

## Distro selection

```bash
source scripts/pkg.sh
echo "OS family: $(pkg_family) $(pkg_version)"
: "${CORTEX_OS_FAMILY:?run prompts/os/00-os-selection.md first}"
```

## Sudo gate

This spoke runs `sudo`. Authenticate **now** so the rest of the steps don't pause for a password mid-flow:

```bash
sudo -v
```

CortexOS never stores your password — only the kernel's sudo timestamp is used. Re-run if it expires.

## Todo

- [ ] CHECKPOINT 1 confirmed — `kernel.unprivileged_userns_clone = 1`
- [ ] CHECKPOINT 1b confirmed — Docker daemon up
- [ ] Decrypt `templates/.secrets/sandbox.enc.yaml` to `/opt/cortexos/.secrets/sandbox.env` (mode 0640)
- [ ] `docker compose build` + `docker compose up -d` in `stacks/cortex-sandbox-runner`
- [ ] Confirm `curl http://127.0.0.1:8091/healthz` returns ok
- [ ] Run bearer-protected `/exec` probe with `alpine:3` and verify `exitCode: 0`
- [ ] CHECKPOINT 2 confirmed — exec probe returns exitCode 0
- [ ] Append `CORTEX_SANDBOX_URL` + token to `/opt/cortexos/.secrets/consumer.env`
- [ ] Write `/opt/cortexos/templates/agent-roles/.sandbox-required.json` roster
- [ ] Restart cortex-consumer
- [ ] Confirm `[sandbox] dispatched` appears in journal for test role

## CHECKPOINT 1

**STOP — operator question:** Does `sysctl -n kernel.unprivileged_userns_clone` print `1` (not `0`, not `sysctl: cannot stat`)?

Type `confirmed` to proceed.

## CHECKPOINT 1b

**STOP — operator question:** Does `docker info >/dev/null 2>&1 && echo ok` print `ok` (not `Cannot connect to the Docker daemon`)?

Type `confirmed` to proceed.

## Decrypt the secret

```bash
sudo install -d -o root -g root -m 0750 /opt/cortexos/.secrets
sudo scripts/secrets-decrypt.sh sandbox
# If your checked-in template still uses SANDBOX_RUNNER_TOKEN, rewrite it to
# the canonical runtime key before boot:
#   CORTEX_SANDBOX_API_TOKEN=<random 256-bit hex>
sudo chmod 0640 /opt/cortexos/.secrets/sandbox.env
```

`templates/.secrets/sandbox.enc.yaml` MUST define:

```yaml
CORTEX_SANDBOX_API_TOKEN: <random 256-bit hex>
```

Older templates may still carry `SANDBOX_RUNNER_TOKEN`; rename it to
`CORTEX_SANDBOX_API_TOKEN` before boot so the service and downstream consumers
share one canonical variable name.

Generate fresh with:

```bash
openssl rand -hex 32
```

## Build and start

```bash
sudo mkdir -p /opt/cortexos/stacks /opt/cortexos/packages
sudo cp -a stacks/cortex-sandbox-runner/. /opt/cortexos/stacks/cortex-sandbox-runner/
sudo cp -a packages/cortex-telemetry /opt/cortexos/packages/
cd /opt/cortexos/stacks/cortex-sandbox-runner
docker compose build
docker compose up -d
```

### 2.1 Runtime fallback if nested gVisor is unsupported

Preferred runtime is `runsc` (gVisor). Some VPS/container combinations cannot
run nested gVisor because cgroup or user-namespace setup fails inside the
service container. If the exec probe fails with `runsc` errors such as
`cgroup.subtree_control`, `device or resource busy`, or similar nested-runtime
setup failures, fall back to `crun` and rebuild:

```bash
echo 'CORTEX_SANDBOX_OCI_RUNTIME=crun' | sudo tee -a /opt/cortexos/.secrets/sandbox.env
echo 'CORTEX_SANDBOX_DISABLE_CGROUPS=1' | sudo tee -a /opt/cortexos/.secrets/sandbox.env
cd /opt/cortexos/stacks/cortex-sandbox-runner
docker compose up -d --build --force-recreate
```

Record the fallback in the operator log — isolation is weaker than gVisor, but
the service remains policy-gated and guest workloads still run as an
unprivileged uid/gid.

## Sandbox exec probe

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

**STOP — operator question:** Did the `/exec` probe with `alpine:3` return HTTP 200 and a JSON body containing `"exitCode":0` (not 401, not `policy_rejected`, not 500)?

Type `confirmed` to proceed.

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
`[sandbox] dispatch failed ...`. If `60-cortex-consumer.md` has not run yet, defer this verification block until that spoke completes.

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
