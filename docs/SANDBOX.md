# SANDBOX.md

> V10 — Threat model and operational notes for `cortex-sandbox-runner`.

## What it is

`cortex-sandbox-runner` is an Express HTTP service that accepts
`POST /exec` requests from `cortex-consumer` (and other in-cluster
clients) and spawns one short-lived `podman --runtime=runsc` guest
container per request. The guest's syscalls run through gVisor's
user-space kernel rather than the host kernel.

```text
                +----------------------+
 NATS event --> | cortex-consumer      |
                +----------+-----------+
                           | HTTPS+Bearer
                           v
                +----------------------+        spawn(podman)
                | cortex-sandbox-runner| ---------------------+
                | (Express, port 8091) |                      v
                +----------------------+        +------------------------+
                                                | podman --runtime=runsc |
                                                |  +--------------------+|
                                                |  |  guest (alpine:3,  ||
                                                |  |  node:22-slim,...) ||
                                                |  +--------------------+|
                                                +------------------------+
```

## Isolation guarantees

| Layer                | Mechanism                                                              |
|----------------------|------------------------------------------------------------------------|
| Service ↔ Host       | Unprivileged container, rootless podman, user-namespace `subuid/subgid` |
| Guest ↔ Service      | gVisor (`runsc`) user-space syscall interception                        |
| Guest filesystem     | `--read-only`, `tmpfs` `/tmp` capped at 64 MiB                          |
| Guest capabilities   | `--cap-drop=ALL`, `--security-opt=no-new-privileges`                    |
| Guest network        | `--network=none` (default) or `--network=bridge`; `host` denied         |
| Guest resources      | `--memory`, `--cpus`, `--pids-limit=128`                                |
| Wall-clock           | Service kills with `SIGKILL` after `timeoutSec` (max 600)               |

The service container itself runs `privileged:false`,
`no-new-privileges`, and the default Docker seccomp profile. `seccomp`
is set to `unconfined` only on the SERVICE wrapper because nested
rootless podman uses `clone3(CLONE_NEWUSER|CLONE_NEWPID|...)` calls the
default Docker profile blocks. Guest workloads do NOT inherit this —
they run under gVisor's own syscall surface.

## Threat model

### In scope

1. **Untrusted code execution by agents.** Guest commands are written
   by LLM-driven roles; they MUST be treated as adversarial.
2. **Container escape.** A successful escape from the guest would land
   in the rootless `sandbox` user inside the service container — still
   one user namespace away from the host root.
3. **Host kernel exploitation.** gVisor reduces the kernel attack
   surface from "every syscall the guest can make" to "the bounded set
   runsc needs to implement its own kernel".
4. **Resource exhaustion.** Per-request quotas (`policy.js`) cap CPU,
   memory, PIDs, and runtime; the service container also carries
   `deploy.resources.limits` to bound aggregate impact.
5. **Cross-tenant data leakage.** Each invocation gets a fresh root
   filesystem (`--rm`), no host bind-mounts, and a tmpfs scratch
   directory that is destroyed when the guest exits.
6. **Unauthenticated access.** `POST /exec` requires a bearer token
   provisioned via SOPS; the service refuses to start handling
   `/exec` when the token is unset.

### Out of scope

1. **Side-channel attacks (Spectre, Rowhammer, etc.).** gVisor mitigates
   some classes (no direct syscall surface) but does not promise full
   isolation against microarchitectural attacks. Do not run untrusted
   code on the same host as cryptographic key material.
2. **Outbound network policy enforcement.** When `networkMode=bridge`
   the guest can reach the cortex-net Docker network. Operators MUST
   pair this with the `18-fail2ban.md` egress rules if egress is a
   concern.
3. **Image content trust.** The allow-list pins image tags by major
   version. Operators wanting strict content trust SHOULD additionally
   configure `cosign` verification on the host's podman policy.

## Known gVisor limitations (as of release-20260401)

- **Syscall coverage gaps.** A small number of niche syscalls return
  `ENOSYS` under runsc. Workloads that require them must be rewritten
  or run elsewhere. Track upstream `gvisor#issue tracker` for the
  current list.
- **Performance overhead.** Expect 20–40% throughput reduction on
  syscall-heavy workloads. CPU-bound code is largely unaffected.
- **CVE classes.** The runsc sandbox itself has had isolation CVEs
  (e.g. CVE-2023-32466 class). The Dockerfile pins
  `GVISOR_RELEASE=release-20260401`; operators MUST rebuild and
  redeploy when Google ships a security release. Track
  <https://gvisor.dev/security/>.

## Operational runbook

### Token rotation

```bash
# 1. Generate new token
NEW="$(openssl rand -hex 32)"

# 2. Update SOPS-encrypted secret
sops --set "[\"CORTEX_SANDBOX_API_TOKEN\"] \"${NEW}\"" \
     templates/.secrets/sandbox.enc.yaml

# 3. Decrypt + restart on VPS
scripts/secrets-decrypt.sh sandbox
docker compose -f stacks/cortex-sandbox-runner/docker-compose.yml \
  restart cortex-sandbox-runner

# 4. Update consumer.env with the same value and restart cortex-consumer
```

### Adding a new allowed image

Edit `stacks/cortex-sandbox-runner/app/policy.js`, append the image
tag (pinned to a major version) to `DEFAULT_ALLOWED_IMAGES`, ship a
new build, and update this doc.

### Tamper detection

- Service container exits non-zero on token mismatch — alert via
  `cortex.alerts.error.sandbox-token-unset`.
- `/metrics` exposes `sandbox_exec_rejected_auth_total` and
  `sandbox_exec_rejected_policy_total`; spikes indicate either a
  misconfigured caller or an attempted policy bypass.
- Audit hash-chain (V9) records every consumer-side dispatch via
  `cortex.sandbox.dispatch.<role>`.

## Cross-references

- [`prompts/tools/47a-cortex-sandbox.md`](../prompts/tools/47a-cortex-sandbox.md)
  — install runbook.
- [`stacks/cortex-sandbox-runner/README.md`](../stacks/cortex-sandbox-runner/README.md)
  — developer surface.
- [`docs/SECRETS.md`](SECRETS.md) — SOPS workflow for `sandbox.env`.
- [`docs/AUDIT.md`](AUDIT.md) — V9 audit hash chain that records
  sandbox dispatch events.
