# CortexOS Docs

The rebuild plan in `../PLAN.md` is canonical.

## Core Reference

- [ARCHITECTURE.md](ARCHITECTURE.md) — system architecture overview (see also `../ARCHITECTURE.md`)
- [AUDIT.md](AUDIT.md) — hash-chained audit log requirements and append contract
- [CREDENTIALS.md](CREDENTIALS.md) — machine/project identity policy for agents
- [DASHBOARD.md](DASHBOARD.md) — LAN/tailnet control console, audited root-helper socket
- [OBSERVABILITY.md](OBSERVABILITY.md) — Prometheus, Grafana, Loki monitoring stack
- [POSTGRES-LAYOUT.md](POSTGRES-LAYOUT.md) — host PostgreSQL service layout and database ownership
- [SANDBOX.md](SANDBOX.md) — gVisor sandbox runner contract for untrusted tool execution
- [SECRETS.md](SECRETS.md) — SOPS+age secret pipeline, env file placement, rotation policy
- [SECRETS-ROTATION.md](SECRETS-ROTATION.md) — step-by-step secret rotation procedures
- [SECURITY.md](SECURITY.md) — current security model and accepted risks
- [SECURITY-CHECKLIST.md](SECURITY-CHECKLIST.md) — pre-deploy security checklist
- [SERVER-DEV.md](SERVER-DEV.md) — host-side dashboard pull→build→restart loop and gastown Incus base-image build
- [SERVICES.md](SERVICES.md) — host service placement summary (`manifests/rebuild/service-placement.tsv`)
- [SETUP_GUIDE.md](SETUP_GUIDE.md) — rebuild script quick reference
- [SUPPLY-CHAIN.md](SUPPLY-CHAIN.md) — signed image and SBOM/SLSA provenance rules
- [TMUX.md](TMUX.md) — beginner-friendly tmux guide: prefix model, full keybinding table, the 17 plugins, persistence, and how the conf avoids plugin key conflicts
- [TROUBLESHOOTING.md](TROUBLESHOOTING.md) — first-step troubleshooting checklist
- [PROJECT-BOTS.md](PROJECT-BOTS.md) — project automation identity conventions
- [A2A.md](A2A.md) — agent-to-agent handoff, review, and escalation conventions

## Rebuild Session Artifacts

- [rebuild/RECONCILIATION.md](rebuild/RECONCILIATION.md) — three-way audit: repo vs host vs plan, OSS-readiness findings
- [rebuild/current-host-inventory.md](rebuild/current-host-inventory.md) — read-only live host inventory captured pre-rebuild
- [rebuild/handoff-2026-05-28-incus-base-image.md](rebuild/handoff-2026-05-28-incus-base-image.md) — operator session notes, Incus base image phase
- [rebuild/handoff-2026-05-28-phase7-hermes-move.md](rebuild/handoff-2026-05-28-phase7-hermes-move.md) — operator session notes, Phase 7 Hermes profile move
- [rebuild/handoff-2026-05-28-phase8-retired-infra-removal.md](rebuild/handoff-2026-05-28-phase8-retired-infra-removal.md) — operator session notes, Phase 8 retired infra removal
- [rebuild/handoff-2026-05-28-phase9-final-validation.md](rebuild/handoff-2026-05-28-phase9-final-validation.md) — operator session notes, Phase 9 final validation (COMPLETE)
