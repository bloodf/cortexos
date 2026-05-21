# Changelog

All notable changes to CortexOS are documented here.

## [1.0.0] - 2026-05-14

### Current Runtime

- All-in-one installer centered on Paperclip, Hermes profiles, Honcho memory,
  Ollama embeddings, and 9Router model routing.
- Dashboard migrations are collapsed to a clean current baseline for new
  installs.
- Agent templates use Paperclip issues/comments as the workflow surface and
  Hermes/Honcho for execution and memory.

### Added

- Production-ready single-host CortexOS release.
- Parameterized PostgreSQL function `cortex_set_service_urls(base_url)` for public service URLs.
- Public docs set under `docs/`.
- Next.js dashboard for services, processes, storage, agents, and terminal access.
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
