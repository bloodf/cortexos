# CortexOS

CortexOS is a prompt-driven, self-hosted AI infrastructure and agent orchestration OS. It
declaratively provisions a single Ubuntu host (or Debian 13) with a full agent stack:
Next.js dashboard, AgentGateway MCP proxy, Incus project instances, Prometheus/Grafana/Loki
monitoring, hash-chained audit log, and SOPS+age secret pipeline — all driven from operator
prompts on your laptop via SSH dispatch.

## Prerequisites

**Operator laptop** (drives all installs — nothing runs on the VPS at bootstrap time):

- Git clone of this repo
- [age](https://github.com/FiloSottile/age) + [sops](https://github.com/getsops/sops) for secret encryption/decryption
- [pnpm](https://pnpm.io/) (≥ 10) + Node 22 for dashboard development
- SSH key-based access to the target host

**Target host**:

- Ubuntu 24.04 LTS, Ubuntu 25.x, or Debian 13 Trixie (see `scripts/os-detect.sh`)
- SSH accessible from the operator laptop

## Quick Start

Set the required environment variables:

```bash
export CORTEX_HOST=user@your-host        # SSH target
export CORTEX_USER=cortexos              # remote user
export CORTEX_ROOT=/opt/cortexos         # install root (must be this path)
export CORTEX_DOMAIN=your.domain.tld     # public domain for Caddy
```

Then follow the canonical bootstrap prompt:

```
prompts/00-bootstrap.md
```

The laptop-side dispatcher (`scripts/bootstrap.sh`) handles pushing the repo, decrypting
secrets locally, and running prompts remotely over SSH:

```bash
source scripts/bootstrap.sh
bootstrap_check_local_deps
bootstrap_push_repo
bootstrap_run_remote 'cd "$CORTEX_ROOT" && bash prompts/...'
bootstrap_push_secrets
```

After bootstrap, use the rebuild tooling for incremental phase-gated changes:

```bash
scripts/rebuild/validate.sh --local
scripts/rebuild/plan.sh
scripts/rebuild/apply.sh --phase <phase> --dry-run --backup-dir <dir>
```

## Documentation

- [SETUP.md](SETUP.md) — rebuild flow overview and phase gates
- [ARCHITECTURE.md](ARCHITECTURE.md) — system architecture overview
- [CONTRIBUTING.md](CONTRIBUTING.md) — contribution guidelines
- [SECURITY.md](SECURITY.md) — security model and vulnerability reporting
- [docs/README.md](docs/README.md) — full documentation index
- [LICENSE](LICENSE) — MIT

## License

MIT
