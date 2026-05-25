# Floci

## Chat Input Gate

This prompt follows `prompts/CHAT-INPUT-CONTRACT.md`. Do not assume any
operator-specific environment variables are already defined. Before using a
value such as a host, user, domain, token, password, project path, profile name,
or service URL, ask a **STOP — input question**, wait for the operator's answer,
and then substitute that answer into the commands you produce.

## Purpose

Run LocalStack as Floci for local AWS-compatible service emulation.

## Install mode

Docker.

## Prerequisites

- `11-docker.md` completed.

## Todo

- [ ] CHECKPOINT 1 confirmed — port 4566 free
- [ ] Copy `stacks/floci/docker-compose.yml`
- [ ] Start the stack with `docker compose up -d --remove-orphans`
- [ ] Confirm `SERVICES` is unset so LocalStack/Floci enables all free-tier services
- [ ] Confirm LocalStack health endpoint responds with many available services

## CHECKPOINT 1

**STOP — operator question:** Does `ss -tlnp | grep 4566` print no output (port 4566 free)?

Type `confirmed` to proceed.

## Install

```bash
cd /opt/cortexos/stacks/floci
docker compose up -d --remove-orphans
```

## Verify

```bash
docker compose config | grep -q 'SERVICES:' && { echo 'SERVICES must be unset'; exit 1; }
curl -fsS http://127.0.0.1:4566/_localstack/health
```

Expected: JSON health document with the free-tier LocalStack/Floci services available. Do not set `SERVICES=s3,lambda,...`; that restricts all other services.

## CHECKPOINT 2

**STOP — operator question:** Does `https://${CORTEX_DOMAIN}:4566/_localstack/health` return LocalStack health JSON from a tailnet device?

Type `confirmed` to proceed.

## Next

→ `prompts/tools/31-9router.md`
