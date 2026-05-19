# CLAUDE.md

> Operating instructions for AI agents working inside CortexOS repository.

## Project context

CortexOS is prompt-driven self-hosted infrastructure and agent orchestration system. Repository contains deployment prompts, templates, Next.js dashboard, NATS consumer daemon, security runbooks, and agent role definitions. Brand name is **CortexOS**. Repository slug and paths use `cortexos`.

## Non-negotiable rules

- Never commit secrets, tokens, private keys, private IPs, or live credentials.
- Use `/opt/cortexos` and `CORTEX_ROOT`; do not reintroduce legacy names.
- Preserve checkpoint behavior in setup prompts.
- Update docs when behavior, paths, ports, subjects, roles, or credentials change.
- Keep security-sensitive operations explicit, auditable, and reversible.
- Prefer small focused changes over broad rewrites unless user requests docs rewrite.
- Supported host OS: Ubuntu 24.04 LTS, Ubuntu 25.x, Debian 13 Trixie. No Fedora / RHEL / Rocky / Alma support.
- All distro-sensitive shell operations (package install, repo add, firewall) must go through `scripts/pkg.sh` — never call `apt-get` directly in prompts or scripts.
- Every operator prompt that touches package management must branch on `CORTEX_OS_FAMILY` (set by `prompts/os/00-os-selection.md`).
- Paperclip integration is governance plane only: Paperclip owns goals/issues/approvals/budgets; CortexOS owns execution/code/infra/NATS. Never invert authority. Bridge stays stateless; idempotency via `paperclip_ticket_link.UNIQUE(paperclip_run_id)`.
- **CloudEvents envelope is mandatory.** Every NATS publish, inbound webhook payload, and audit row body MUST be wrapped in a CloudEvents 1.0 envelope (`schemas/cloudevents-base.json`) and validated against the matching `schemas/<namespace>-<verb>-v<N>.json`. The wire layering is `{ data: <CloudEvent>, sig: HMAC-SHA256(CORTEX_NATS_HMAC, JCS(<CloudEvent>)) }`. Producers build events via `@cortexos/events.envelope()`; consumers `parse()` or `validate()` every inbound message. Once `CORTEX_REQUIRE_ENVELOPE=1`, raw payloads are rejected.
- **JetStream contracts.** Work runs on `CORTEX_PAPERCLIP_WORK` (workqueue retention, 120s dedup); ops events run on `CORTEX_PAPERCLIP_OPS`; failures route to `CORTEX_DLQ` (`cortex.dlq.<original-subject>`, 7-day retention). Every publish stamps `Nats-Msg-Id: <CloudEvents.id>` for server-side dedup.
- **Sandbox tool execution.** Any agent or tool invocation that runs untrusted code MUST execute under `stacks/cortex-sandbox-runner` (gVisor / `runsc`) with no host network, ephemeral rootfs, and per-call CPU / memory / wall-clock caps. Never shell out to untrusted code on the host.
- **SOPS+age is the only secret pipeline.** SOPS-encrypted YAML in Git is the source of truth for all secrets. Never commit plaintext `.env`. The operator age **private** key lives only at `~/.config/sops/age/keys.txt` on the laptop; the VPS never sees it. `scripts/secrets-decrypt.sh` is the only sanctioned path from encrypted file (`templates/.secrets/*.enc.yaml`) to runtime env (`/opt/cortexos/.secrets/*.env`, mode `0600`). See `docs/SECRETS.md`.
- **Hash-chained audit.** Every paperclip transition, bridge inbound/outbound, graph node lifecycle, sandbox tool call, and approval decision MUST append an `audit_log` row via `@cortexos/audit` (`payload_hash = SHA-256(JCS(payload))`, `chain_hash = SHA-256(prev_hash || payload_hash)`). Append failures emit `cortex.alerts.error.audit-append-failed` and never block the originating operation. Chain heads are anchored hourly into Sigstore Rekor.
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

- NATS subject prefix: `cortex.*`.
- Core consumer: `stacks/cortex-consumer/consumer.js`.
- Dashboard root: `dashboard/`.
- Host root: `/opt/cortexos`.
- Secrets root: `/opt/cortexos/.secrets`.
- Dashboard secret env: `/opt/cortexos/secrets/dashboard.env`.
- Paperclip bridge: `stacks/cortex-paperclip-bridge/` (Express webhook receiver + JetStream status worker + alerts plugin). Postgres link table: `paperclip_ticket_link`.
- Paperclip adapter npm package: `packages/paperclip-adapter/` (`@cortexos/paperclip-adapter`).
- OS dispatcher: `scripts/os-detect.sh` + `scripts/pkg.sh`. OS prereq prompts: `prompts/os/*`.
- Paperclip operator prompts: `prompts/paperclip/*` (install, bridge, role-registration, governance, smoke, rollback, backfill, alerts).

## Completion checklist

- Search confirms no stale legacy names.
- Tests relevant to changed area pass.
- Markdown links resolve.
- New docs are linked from `docs/README.md`.
- Security and rollback notes exist for operational changes.
