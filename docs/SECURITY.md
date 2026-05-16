# CortexOS Security Model

> Threat model, controls, operational hardening, and secure development expectations.

## Contents

- [Threat model](#threat-model)
- [Control matrix](#control-matrix)
- [Secrets](#secrets)
- [Agents](#agents)
- [Network](#network)
- [Audit](#audit)
- [Checklist](#checklist)
- [Related docs](#related-docs)

## Threat model

CortexOS assumes operator controls VPS, GitHub repository, Slack workspace, and Tailscale account. Primary risks: credential leakage, unauthorized dashboard access, path traversal in env browser, malicious NATS event injection, and over-scoped agent actions.

## Control matrix

| Risk | Control |
|---|---|
| Secret disclosure | `.secrets/`, encryption, masking, reveal confirmation |
| Path traversal | Normalized allowlist checks and tests |
| Event forgery | HMAC for approvals and schema validation |
| Agent overreach | Role scopes, dispatch rules, approval gates |
| Public exposure | Caddy TLS, auth, Tailscale-first access |
| Undetected action | Dashboard audit log and Slack narrative |

## Secrets

Secrets belong in `/opt/cortexos/.secrets` or `/opt/cortexos/secrets`. Dashboard encrypts imported values with AES-256-GCM. Never paste real values into issues, docs, or screenshots.

## Agents

Agents should receive minimum necessary context. Privileged file reads, writes, restarts, and credential reveals require explicit approval or confirmation token.

## Network

Prefer Tailscale for operator access. Public routes should be limited to dashboard and intended web UIs. Internal service ports should stay bound to Docker network or host firewall rules.

## Audit

Audit events should include actor, action, target, timestamp, and result. Sensitive values must be redacted. Slack should receive high-signal summaries for human awareness.

## Checklist

- [ ] `.secrets/` gitignored and permission restricted.
- [ ] Dashboard admin password changed after install.
- [ ] `CORTEX_MASTER_KEY` backed up securely.
- [ ] HMAC secrets rotated before production.
- [ ] Caddy and Tailscale routes verified.
- [ ] Tests cover path allowlist and confirmation flows.

## Related docs

- [Documentation index](README.md)
- [Architecture](ARCHITECTURE.md)
- [Security](SECURITY.md)
