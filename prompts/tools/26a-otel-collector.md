# OpenTelemetry Collector

## Chat Input Gate

This prompt follows `prompts/CHAT-INPUT-CONTRACT.md`. Do not assume any
operator-specific environment variables are already defined. Before using a
value such as a host, user, domain, token, password, project path, profile name,
or service URL, ask a **STOP — input question**, wait for the operator's answer,
and then substitute that answer into the commands you produce.

## Purpose

Run an OTLP receiver for traces, metrics, and logs. Metrics are exported for Prometheus scraping.

## Install mode

Docker.

## Prerequisites

- `11-docker.md` completed.
- `20-prometheus.md` completed.

## Todo

- [ ] CHECKPOINT 1 confirmed — ports 4317, 4318, 8889 free
- [ ] Copy `stacks/otel/docker-compose.yml` and `stacks/otel/otel-config.yaml`
- [ ] Start the stack with `docker compose up -d`
- [ ] Confirm collector metrics endpoint responds

## CHECKPOINT 1

**STOP — operator question:** Are ports 4317, 4318, and 8889 free?

Type `confirmed` to proceed.

## Install

```bash
cd /opt/cortexos/stacks/otel
docker compose up -d
```

## Verify

```bash
curl -fsS http://127.0.0.1:8889/metrics >/dev/null
```

Expected: Prometheus metrics endpoint responds.

## CHECKPOINT 2

**STOP — operator question:** Does the collector accept OTLP traffic on `127.0.0.1:4317` and `127.0.0.1:4318`?

Type `confirmed` to proceed.

## Next

→ `prompts/tools/26b-webmin.md`
