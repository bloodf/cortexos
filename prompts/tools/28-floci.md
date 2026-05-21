# Floci

## Purpose

Run LocalStack as Floci for local AWS-compatible service emulation.

## Install mode

Docker.

## Prerequisites

- `11-docker.md` completed.

## Todo

- [ ] CHECKPOINT 1 confirmed — port 4566 free
- [ ] Copy `stacks/floci/docker-compose.yml`
- [ ] Start the stack with `docker compose up -d`
- [ ] Confirm LocalStack health endpoint responds

## CHECKPOINT 1

**STOP — operator question:** Does `ss -tlnp | grep 4566` print no output (port 4566 free)?

Type `confirmed` to proceed.

## Install

```bash
cd /opt/cortexos/stacks/floci
docker compose up -d
```

## Verify

```bash
curl -fsS http://127.0.0.1:4566/_localstack/health
```

Expected: JSON health document.

## CHECKPOINT 2

**STOP — operator question:** Does `https://${CORTEX_DOMAIN}:4566/_localstack/health` return LocalStack health JSON from a tailnet device?

Type `confirmed` to proceed.

## Next

→ `prompts/tools/31-9router.md`
