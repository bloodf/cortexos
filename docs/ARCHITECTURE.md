# CortexOS System Architecture

> Authoritative technical design for the CortexOS v2 substrate: laptop-driven install, signed supply chain, CloudEvents bus, sandboxed tool execution, hash-chained audit, and self-hosted LLM observability.

## Contents

- [Overview](#overview)
- [Topology](#topology)
- [Install plane](#install-plane)
- [Event substrate](#event-substrate)
- [Graph execution layer](#graph-execution-layer)
- [Sandboxed tool execution](#sandboxed-tool-execution)
- [Secrets plane](#secrets-plane)
- [Audit plane](#audit-plane)
- [Supply-chain plane](#supply-chain-plane)
- [Observability plane](#observability-plane)
- [Trust boundaries](#trust-boundaries)
- [Extension guide](#extension-guide)
- [Related docs](#related-docs)

## Overview

CortexOS turns one Debian-family Linux host into a managed, audited AI-operations environment. The v2 substrate is built around four invariants:

1. **Laptop drives, VPS receives.** The operator runs every install step from their workstation; the VPS holds no CortexOS code, no operator age private key, and no plaintext secrets until pushed.
2. **Every event is a signed CloudEvent.** All NATS publishes, inbound webhooks, and audit rows are wrapped in a CloudEvents 1.0 envelope, validated against `schemas/*.json`, then HMAC-signed.
3. **Tools run in a sandbox.** Untrusted tool invocations execute under gVisor (`runsc`) with no host network, ephemeral rootfs, and per-call resource caps.
4. **Every state transition is hash-chained.** The audit hypertable links rows via SHA-256(prev || payload) and anchors heads hourly into Sigstore Rekor.

Supported host OS: Ubuntu 24.04 LTS, Ubuntu 25.x, Debian 13 (Trixie). No Fedora / RHEL / Rocky / Alma path.

## Topology

```text
┌──────────────────────────────────────────────────────────────────────┐
│ Operator laptop                                                      │
│   prompts/00-bootstrap.md  +  scripts/bootstrap.sh  +  age priv key  │
│   sops, git archive | ssh tar -x, scp .env, ssh dispatch             │
└─────────────────────────┬────────────────────────────────────────────┘
                          │ SSH
                          v
┌──────────────────────────────────────────────────────────────────────┐
│ VPS  (Ubuntu 24/25 or Debian 13)                                     │
│                                                                      │
│  ┌────────────────────┐   ┌────────────────────┐                     │
│  │ Next.js Dashboard  │   │ cortex-paperclip-  │                     │
│  │ + server actions   │   │  bridge (Express)  │                     │
│  └─────────┬──────────┘   └─────────┬──────────┘                     │
│            │                        │                                │
│            v                        v                                │
│  ┌──────────────────────────────────────────────────────────────┐    │
│  │ NATS JetStream                                                │    │
│  │  CORTEX_PAPERCLIP_WORK (workqueue, msg-id dedup)              │    │
│  │  CORTEX_PAPERCLIP_OPS  (status, approvals, alerts, signals)   │    │
│  │  CORTEX_DLQ            (dead-letter, 7d)                      │    │
│  │  cortex.graph.*  cortex.signals.*                             │    │
│  └─────────────────────────┬────────────────────────────────────┘    │
│                            │                                          │
│             ┌──────────────┼──────────────────────┐                  │
│             v              v                      v                  │
│  ┌──────────────────┐ ┌──────────────────┐ ┌──────────────────┐      │
│  │ cortex-consumer  │ │ cortex-graph     │ │ cortex-sandbox-  │      │
│  │ (Node, durable)  │ │ (LangGraph, PG)  │ │  runner (gVisor) │      │
│  └─────────┬────────┘ └─────────┬────────┘ └─────────┬────────┘      │
│            │                    │                    │               │
│            v                    v                    v               │
│  ┌──────────────────────────────────────────────────────────────┐    │
│  │ PostgreSQL (TimescaleDB)                                      │    │
│  │  dashboard schema, audit_log hypertable, langgraph_checkpoints│    │
│  │  pending_approvals, paperclip_ticket_link                     │    │
│  └──────────────────────────────────────────────────────────────┘    │
│                                                                      │
│  ┌──────────────────────────────────────────────────────────────┐    │
│  │ Observability                                                 │    │
│  │  Langfuse + ClickHouse + OpenLLMetry (LLM traces)             │    │
│  │  Prometheus + Loki + Grafana (host + services)                │    │
│  └──────────────────────────────────────────────────────────────┘    │
└──────────────────────────────────────────────────────────────────────┘
```

Filesystem layout under `CORTEX_ROOT` (default `/opt/cortexos`):

```text
/opt/cortexos
  ├─ .secrets/              host-only env files (mode 0600, owned by cortex)
  ├─ secrets/               dashboard + service env files
  ├─ stacks/                docker compose stacks (dashboard, nats, langfuse, graph, sandbox)
  ├─ packages/              @cortexos/{events,audit,telemetry} build artifacts
  ├─ schemas/               JSON Schema registry (CloudEvents + payloads)
  ├─ data/                  postgres, nats, clickhouse, langfuse volumes
  └─ templates/             role files, scripts, systemd units
```

## Install plane

The operator runs `prompts/00-bootstrap.md` on their laptop. `scripts/bootstrap.sh` provides the helpers:

| Helper | Purpose |
|---|---|
| `bootstrap_check_local_deps` | Verify `ssh`, `scp`, `git`, `sops`, `age` and the four `CORTEX_*` env vars on the laptop. |
| `bootstrap_ensure_operator_age_key` | Create or discover `~/.config/sops/age/keys.txt`; print the public recipient for `.sops.yaml`. |
| `bootstrap_detect_remote_os` | Pipe `scripts/os-detect.sh` to the VPS over SSH; export `CORTEX_OS_FAMILY` / `CORTEX_OS_VERSION` in the laptop shell. |
| `bootstrap_push_repo` | Materialize the working tree at `/opt/cortexos` via `git archive \| ssh tar -x`. |
| `bootstrap_run_remote <cmd>` | Run `<cmd>` on the VPS with the CortexOS env exported; wrapper for every `prompts/os/*` and `prompts/tools/*` step. |
| `bootstrap_push_secrets` | Decrypt every `templates/.secrets/*.enc.yaml` locally with the operator age key; scp plaintext `.env` files to `/opt/cortexos/.secrets/`; chmod `0600`. |

Rehearsal happens on the laptop with [Lima](../lima/README.md): `make vm-debian-up && make vm-rehearse FAMILY=debian` brings up a macOS-native Debian 13 VM and replays the install end-to-end without a real VPS.

## Event substrate

Every NATS publish, inbound webhook, and audit row body is wrapped in a CloudEvents 1.0 envelope and HMAC-signed:

```text
on-wire = { data: <CloudEvent>, sig: HMAC-SHA256(CORTEX_NATS_HMAC, JCS(<CloudEvent>)) }
```

Streams (JetStream):

| Stream | Subjects | Retention | Dedup |
|---|---|---|---|
| `CORTEX_PAPERCLIP_WORK` | `cortex.paperclip.work.>` | `workqueue` | 120s |
| `CORTEX_PAPERCLIP_OPS` | `cortex.paperclip.status.>`, `cortex.paperclip.approval.>`, `cortex.alerts.>`, `cortex.signals.>` | `limits` | 120s |
| `CORTEX_DLQ` | `cortex.dlq.>` | `limits`, 7d | 120s |

Producers build events via `@cortexos/events.envelope()` and call `validate()`; consumers `parse()` (or `validate()`) every inbound message. `CORTEX_REQUIRE_ENVELOPE=1` enforces strict mode once all producers have rolled. Dedup uses `Nats-Msg-Id: <CloudEvents.id>`. Failures route to `cortex.dlq.<original-subject>` with full error chain. Full taxonomy in [NATS-CONTRACT.md](NATS-CONTRACT.md).

## Graph execution layer

`stacks/cortex-graph` is a Python LangGraph sidecar that runs any agent role whose template frontmatter declares `graphEnabled: true`. Checkpoints persist in the dashboard's Postgres instance (`packages/cortex-dashboard/migrations/007_langgraph_checkpoints.sql`); a crash mid-run preserves state. `cortex-consumer` POSTs to `/graph/runs` when `CORTEX_GRAPH_URL` is set. Lifecycle events flow on `cortex.graph.state.<runId>`.

Human-in-the-loop: graphs interrupt before `human_review` and publish `status=awaiting_human`. Operators resume via the dashboard, which records the decision in `pending_approvals` (migration `009`) and publishes a signal on `cortex.signals.<runId>.<name>` that the sidecar listens for. See [AGENT-GRAPH.md](AGENT-GRAPH.md).

## Sandboxed tool execution

`stacks/cortex-sandbox-runner` executes untrusted tool calls under [gVisor](https://gvisor.dev/) (`runsc`). Each call gets an ephemeral container with no host network, an ephemeral rootfs, per-call CPU / memory / wall-clock caps, and a read-only mount of just the input bundle. Tool I/O is captured as audit rows. See [SANDBOX.md](SANDBOX.md) for the threat model and operational runbook.

## Secrets plane

SOPS+age encrypted YAML in Git is the source of truth. The operator age **private** key lives only on the laptop at `~/.config/sops/age/keys.txt`. Encrypted files live at `templates/.secrets/*.enc.yaml`; `scripts/secrets-decrypt.sh` is the only sanctioned path from ciphertext to runtime env. Plaintext `.env` files exist only at `/opt/cortexos/.secrets/*.env` (mode `0600`, owned by `cortex`) and are never committed. See [SECRETS.md](SECRETS.md).

## Audit plane

`audit_log` is a TimescaleDB hypertable (migration `008`). Every paperclip state transition, bridge inbound/outbound, graph node transition, sandbox tool call, and approval decision appends one row via `@cortexos/audit`:

```text
payload_hash = SHA-256( JCS(payload) )
chain_hash   = SHA-256( prev_hash || payload_hash )
```

The genesis row uses `prev_hash = 0x64`. Writers serialize on a row-level `FOR UPDATE` lock against the current chain tip. Chain heads are anchored hourly into the public Sigstore Rekor transparency log. `append()` failures never block the originating operation; they raise `cortex.alerts.error.audit-append-failed`. See [AUDIT.md](AUDIT.md).

## Supply-chain plane

CortexOS targets SLSA Level 2:

- Container images and release artifacts are built in GitHub Actions with OIDC.
- Images are signed keylessly with [cosign](https://github.com/sigstore/cosign).
- SBOMs are generated with [syft](https://github.com/anchore/syft) and attached as attestations.
- Provenance attestations follow the SLSA v1.0 provenance schema.
- The on-VPS dashboard build runs `docker compose build` directly on the host (no `rsync` of source); image references are verified before promotion.

Verification protocol, threat model, and operator commands are in [SUPPLY-CHAIN.md](SUPPLY-CHAIN.md).

## Observability plane

Two stacks live side-by-side:

- **LLM call traces**: self-hosted Langfuse + ClickHouse, fed by OpenLLMetry (`packages/cortex-telemetry`). Every LLM call from the consumer, the graph sidecar, the sandbox runner, and dashboard server actions is traced with prompt, response, latency, token count, model id, and run id. See [OBSERVABILITY-LLM.md](OBSERVABILITY-LLM.md).
- **Host + service metrics**: Prometheus, Loki, Grafana, exporters. See [OBSERVABILITY.md](OBSERVABILITY.md).

## Trust boundaries

| Boundary | Surface | Control |
|---|---|---|
| Laptop ↔ VPS | SSH, scp | Key-based auth, age private key never leaves laptop |
| Operator ↔ Dashboard | HTTPS via Caddy | Auth, Tailscale-only by default, server actions with zod |
| NATS bus | Every subject | CloudEvents envelope + HMAC signature, JCS-canonical |
| Inbound webhooks | Paperclip bridge | Bearer + `timingSafeEqual`, replay-safe via `paperclip_run_id UNIQUE` |
| Tool execution | Sandbox runner | gVisor isolation, no host net, per-call caps, audit row per call |
| Secrets at rest | `templates/.secrets/*.enc.yaml` | SOPS+age, only laptop has private key |
| Audit | `audit_log` hypertable | Hash chain + hourly Rekor anchor |

## Extension guide

Add a new service: extend `templates/compose/`, register a dashboard seed row, scrape config, schema file under `schemas/`, docs index entry, and a troubleshooting runbook. Add a new agent role: create a role file under `templates/agent-roles/`, declare `graphEnabled` if it should run under LangGraph, register a label mapping, dispatch rule, NATS subject (in [NATS-CONTRACT.md](NATS-CONTRACT.md)), and approval gate if needed.

## Related docs

- [Documentation index](README.md)
- [NATS contract](NATS-CONTRACT.md)
- [Agent graph](AGENT-GRAPH.md)
- [Sandbox](SANDBOX.md)
- [Audit](AUDIT.md)
- [Secrets](SECRETS.md)
- [Supply chain](SUPPLY-CHAIN.md)
- [LLM observability](OBSERVABILITY-LLM.md)
- [Security](SECURITY.md)
- [Paperclip integration](PAPERCLIP.md)
