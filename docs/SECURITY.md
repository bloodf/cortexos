# Security

The current security model is defined by `../PLAN.md`.

Security invariants:

- No secret values in git.
- Host env files are owner-readable only.
- Project instances receive only required service credentials.
- Dashboard shell execution is audited.
- Backups are verified before cleanup.
- Protected Hermes profiles are inventoried before any host rebuild step.
