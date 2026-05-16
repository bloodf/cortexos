# Security Policy

> Vulnerability reporting, supported scope, severity model, and response expectations for CortexOS.

## Supported versions

| Version | Support |
|---|---|
| 1.x | Security fixes accepted |
| < 1.0 | Unsupported |

## In scope

- Dashboard authentication, authorization, sessions, and privileged routes.
- Credential encryption, import, masking, reveal, and rotation workflows.
- VPS file allowlists and path traversal protections.
- NATS approval signature verification and event routing.
- Agent dispatch boundaries, prompt escalation rules, and audit logging.
- Templates that could expose secrets or run unsafe commands.

## Out of scope

- Vulnerabilities in operator-managed third-party services unless caused by CortexOS templates.
- Social engineering against maintainers or users.
- Denial-of-service requiring unrealistic local access.
- Public disclosure before maintainers have reasonable remediation window.

## Severity model

| Severity | Examples | Target response |
|---|---|---|
| Critical | Remote code execution, secret exfiltration, auth bypass | 24 hours |
| High | Privilege escalation, persistent credential leak, approval forgery | 72 hours |
| Medium | Scoped data exposure, path validation bypass with constraints | 7 days |
| Low | Hardening gap, missing audit event, documentation ambiguity | 14 days |

## Reporting process

Send private report to maintainer. Include:

- Affected commit or version.
- Component and file paths.
- Reproduction steps.
- Impact assessment.
- Suggested fix, if known.

Do not include live secrets, production tokens, or private infrastructure identifiers. Use redacted proof when possible.

## Maintainer response

1. Acknowledge report.
2. Confirm scope and severity.
3. Prepare fix or mitigation.
4. Credit reporter unless anonymity requested.
5. Publish advisory when issue could affect users.

## PGP

PGP key placeholder: maintainers should publish current key fingerprint before requesting encrypted disclosure.

## Security hardening expectations

- Use `/opt/cortexos` or `CORTEX_ROOT`; never hardcode private paths outside documented roots.
- Keep `.secrets/` gitignored and permission restricted.
- Mask credential values by default.
- Require confirmation tokens for destructive or revealing actions.
- Log privileged actions to dashboard audit tables and Slack when appropriate.
