# Security

The rebuild security model is documented in `PLAN.md`.

Current accepted risks are explicit there: trusted LAN/tailnet dashboard access,
network-trust AgentGateway, shared Incus bridge trust, local-only backups, and
Hermes latest-upstream auto-update.

Active controls:

- Host-owned env files, never secret values in git.
- Per-project database users, buckets, queues, and credentials.
- Dashboard helper command audit to Postgres and journald.
- Backup/restore gate before destructive cleanup.
- Protected Hermes identity inventory and validation.
