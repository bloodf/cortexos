# Changelog

All notable changes to CortexOS are documented here.

## [1.0.0] - 2026-05-14

### Added

- Production-ready single-host CortexOS release.
- Module 13 — credentials export: `templates/scripts/export-credentials.sh` harvests live VPS credentials into `.secrets/credentials.md`.
- Dashboard `/admin/credentials/import` endpoint and page — paste `.secrets/credentials.md` to seed the encrypted credential store (AES-256-GCM, upsert-by-slug).
- Parameterized PostgreSQL function `cortex_set_service_urls(base_url)` (migration 004) replaces hardcoded service URLs.
- Systemd unit template (`__CORTEX_*__` placeholders) rendered at deploy time by `dashboard/deploy.sh`.
- Public docs set under `docs/`: ARCHITECTURE, SETUP_GUIDE, CREDENTIALS, DASHBOARD, AGENT_FACTORY, TROUBLESHOOTING.
- NATS event bus and cortex-consumer orchestration daemon.
- Slack thread source-of-truth workflow for agent operations.
- Husky-as-CI local hook model for repo validation and event publishing.
- OpenClaw agent factory role templates and dispatch pattern.
- Next.js dashboard for services, processes, storage, agents, and terminal access.
- Runbooks for CI, escalation, approvals, pipeline, sandboxing, and incidents.
- GitHub issue and pull request templates.
- Security policy and contributor code of conduct.

### Changed

- Architecture docs consolidated into root `ARCHITECTURE.md`.
- Setup docs updated for public V1.0.0 release.
- Dashboard seed data sanitized for open-source distribution.

### Removed

- Internal migration notes and point-in-time audit snapshots.
- Default seeded admin credentials.
- Personal hostnames, private LAN IPs, usernames, and chat IDs from tracked release files.
