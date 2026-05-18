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
| Stolen Paperclip webhook secret | Rotation runbook, `chmod 600` on env file, Tailscale-only ingress |
| Replayed Paperclip runId | `UNIQUE(paperclip_run_id)` on `paperclip_ticket_link` (migration 005) |
| Approval-deadlock | Bridge timeboxes approvals (default 2 h) and emits `cortex.alerts.warning.approval-timeout` |

## Paperclip integration threats

The Paperclip bridge widens the trust surface in three directions; each
has an explicit control:

| Threat | Surface | Control |
|---|---|---|
| Stolen `PAPERCLIP_WEBHOOK_SECRET` | Inbound HTTP webhook | 90-day rotation, Tailscale-only ingress, `chmod 600`, `crypto.timingSafeEqual` on length-equal buffers. Rotation procedure in [PAPERCLIP.md](PAPERCLIP.md#secret-rotation). |
| Replayed Paperclip `runId` | Bridge → consumer | `paperclip_ticket_link.paperclip_run_id UNIQUE`; replay returns `202` but no duplicate row. Smoke step 18 enforces. |
| Approval-deadlock on destructive op | Governance gate | Bridge enforces `PAPERCLIP_APPROVAL_TIMEOUT_SEC` (default 2 h); on expiry, issue moves to `cancelled` with reason `approval_timeout` and alert fires. Smoke step 21 enforces. |
| Bridge auth length-leak | `timingSafeEqual` impl. | Smoke steps 15–17 cover wrong / missing / length-mismatch bearer; each MUST return 401 in constant time. |
| Stolen per-agent key | `paperclip-keys.json` | File `chmod 600`, owned by `cortex`, gitignored. Rotate via `scripts/paperclip-register-roles.ts --rotate <role>`. |

## Secrets

Secrets belong in `/opt/cortexos/.secrets` or `/opt/cortexos/secrets`. Dashboard encrypts imported values with AES-256-GCM. Never paste real values into issues, docs, or screenshots.

## Agents

Agents should receive minimum necessary context. Privileged file reads, writes, restarts, and credential reveals require explicit approval or confirmation token.

## Network

Prefer Tailscale for operator access. Public routes should be limited to dashboard and intended web UIs. Internal service ports should stay bound to Docker network or host firewall rules.

## Audit

Audit events should include actor, action, target, timestamp, and result. Sensitive values must be redacted. Slack should receive high-signal summaries for human awareness.

### Audit immutability (V9)

CortexOS keeps an append-only, hash-chained audit log in a TimescaleDB
hypertable (`audit_log`). Every paperclip state transition and bridge
inbound/outbound emit appends one row via the `@cortexos/audit` package:

```
payload_hash = SHA-256( JCS(payload) )
chain_hash   = SHA-256( prev_hash || payload_hash )
```

The genesis row uses `prev_hash = 0×64`. Writers serialise on a
row-level `FOR UPDATE` lock against the current chain tip, so concurrent
appends never branch the chain.

Chain heads are anchored hourly into the public Sigstore Rekor
transparency log (`scripts/audit-anchor-cron.sh` → `cortex-audit anchor`).
Any post-hoc tampering with rows that precede an anchor is detectable
externally by comparing the row's `chain_hash` against the matching Rekor
`hashedrekord` entry.

`append()` failures must **never** block the originating operation;
instead they raise `cortex.alerts.error.audit-append-failed` and the
production path continues. Gaps surface as `prev_hash_mismatch` results
from `verifyChain` / the `/audit` viewer badge. See `docs/AUDIT.md` for
the full hash-chain semantics, Rekor anchoring details, and
tamper-detection runbook.

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
