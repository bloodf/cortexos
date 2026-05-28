# CLAUDE.md

> Operating instructions for AI agents working inside CortexOS repository.

## Project context

CortexOS is prompt-driven self-hosted infrastructure and agent orchestration system. Repository contains deployment prompts, templates, Next.js dashboard, security runbooks, and agent role definitions. Brand name is **CortexOS**. Repository slug and paths use `cortexos`.

## Non-negotiable rules

- Never commit secrets, tokens, private keys, private IPs, or live credentials.
- Use `/opt/cortexos` and `CORTEX_ROOT`; do not reintroduce legacy names.
- Preserve checkpoint behavior in setup prompts.
- Update docs when behavior, paths, ports, roles, or credentials change.
- Keep security-sensitive operations explicit, auditable, and reversible.
- Prefer small focused changes over broad rewrites unless user requests docs rewrite.
- Supported host OS: Ubuntu 24.04 LTS, Ubuntu 25.x, Debian 13 Trixie. No Fedora / RHEL / Rocky / Alma support.
- All distro-sensitive shell operations (package install, repo add, firewall) must go through `scripts/pkg.sh` — never call `apt-get` directly in prompts or scripts.
- Every operator prompt that touches package management must branch on `CORTEX_OS_FAMILY` (set by `prompts/os/00-os-selection.md`).
- **Sandbox tool execution.** Any agent or tool invocation that runs untrusted code MUST execute under `stacks/cortex-sandbox-runner` (gVisor / `runsc`) with no host network, ephemeral rootfs, and per-call CPU / memory / wall-clock caps. Never shell out to untrusted code on the host.
- **SOPS+age is the only secret pipeline.** SOPS-encrypted YAML in Git is the source of truth for all secrets. Never commit plaintext `.env`. The operator age **private** key lives only at `~/.config/sops/age/keys.txt` on the laptop; the VPS never sees it. `scripts/secrets-decrypt.sh` is the only sanctioned path from encrypted file (`templates/.secrets/*.enc.yaml`) to runtime env (`/opt/cortexos/.secrets/*.env`, mode `0600`). See `docs/SECRETS.md`.
- **Hash-chained audit.** Every sandbox tool call, AgentGateway MCP invocation, dashboard root-helper command, and approval decision MUST append an `audit_log` row via `@cortexos/audit` (`payload_hash = SHA-256(JCS(payload))`, `chain_hash = SHA-256(prev_hash || payload_hash)`). Append failures emit `cortex.alerts.error.audit-append-failed` and never block the originating operation. Chain heads are anchored hourly into Sigstore Rekor.
- **Operator-laptop drives install.** The canonical install path is the operator running `prompts/00-bootstrap.md` from a local clone on their laptop; remote work happens via SSH dispatch through `scripts/bootstrap.sh` (`bootstrap_run_remote`, `bootstrap_push_repo`, `bootstrap_push_secrets`). Never assume CortexOS code lives on the VPS at the start of a bootstrap; the laptop pushes the repo via `git archive | ssh tar -x`. Plaintext `.env` files are decrypted locally and scp'd to `/opt/cortexos/.secrets/` (mode `0600`).
- **Signed supply chain.** Container images and release artifacts are built in GitHub Actions with OIDC, signed keylessly with cosign, and ship with syft SBOM + SLSA provenance attestations. Dashboard builds on the VPS via `docker compose build`; no `rsync` of source code. See `docs/SUPPLY-CHAIN.md`.

## Common commands

```bash
cd dashboard
pnpm install
pnpm run test
pnpm run build
```

Use targeted tests when possible. Dashboard uses Next.js 16, TypeScript, Vitest, PostgreSQL migrations, and server routes.

## Editing guidance

- Prompts in `prompts/` are operator-facing product surface. Use formal, stepwise language.
- Templates in `templates/` must be safe to copy to VPS.
- Agent roles in `templates/agent-roles/` must define scope, escalation, review standards, and stop conditions.
- Docs should link related docs and include verification steps.

## Architecture reminders

- Dashboard root: `dashboard/`.
- Host root: `/opt/cortexos`.
- Secrets root: `/opt/cortexos/.secrets`.
- Dashboard secret env: `/opt/cortexos/secrets/dashboard.env`.
- AgentGateway: `stacks/cortex-agentgateway/` (Python allowlist MCP proxy, native systemd, port 18800).
- Dashboard root helper: `stacks/cortex-dashboard-root-helper/` (Unix-socket shell executor with PostgreSQL + journald command audit).
- Incus rebuild tooling: `stacks/cortex-incus/`; Bash command wrappers under `scripts/rebuild/`.
- OS dispatcher: `scripts/os-detect.sh` + `scripts/pkg.sh`. OS prereq prompts: `prompts/os/*`.

## Completion checklist

- Search confirms no stale legacy names.
- Tests relevant to changed area pass.
- Markdown links resolve.
- New docs are linked from `docs/README.md`.
- Security and rollback notes exist for operational changes.
