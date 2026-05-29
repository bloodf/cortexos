# Security

## Reporting a Vulnerability

Report security vulnerabilities **privately** via
[GitHub Security Advisories](https://github.com/{owner}/cortexos/security/advisories/new)
on this repository. Do not open a public issue for security bugs.

We aim to acknowledge reports within 48 hours and provide a remediation timeline
within 7 days.

The rebuild security model is documented in `PLAN.md`.

Current accepted risks are explicit there: trusted LAN/tailnet dashboard access,
network-trust Obot MCP gateway, shared Incus bridge trust, local-only backups, and
Hermes latest-upstream auto-update.

Active controls:

- Host-owned env files, never secret values in git.
- Per-project database users, buckets, queues, and credentials.
- Dashboard helper command audit to Postgres and journald.
- Backup/restore gate before destructive cleanup.
- Protected Hermes identity inventory and validation.
