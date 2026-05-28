# 26a - OpenTelemetry Collector

## Purpose

Run an OTLP receiver for traces, metrics, and logs. Metrics are exported for Prometheus scraping. Live container: `cortex-otel-collector`.

## Install mode

Docker.

## Prerequisites

- `11-docker.md` completed.
- `20-prometheus.md` completed — Prometheus scraping is configured.

## Ports

| Port | Protocol | Purpose |
| --- | --- | --- |
| 4317 | gRPC | OTLP traces/metrics/logs receiver |
| 4318 | HTTP | OTLP traces/metrics/logs receiver |
| 8889 | HTTP | Prometheus metrics export endpoint |

## Todo

- [ ] CHECKPOINT 1 confirmed — ports 4317, 4318, 8889 free
- [ ] Copy `stacks/otel/docker-compose.yml` and `stacks/otel/otel-config.yaml`
- [ ] `docker compose up -d --remove-orphans`
- [ ] CHECKPOINT 2 confirmed — collector metrics endpoint responds

## CHECKPOINT 1

**STOP — operator question:** Are ports 4317, 4318, and 8889 free?

```bash
ss -tlnp | grep -E '4317|4318|8889'
```

Expected: no output (all three ports free).

Type `confirmed` to proceed.

## Install

```bash
sudo install -d -m 0755 /opt/cortexos/stacks/otel
sudo cp -a stacks/otel/. /opt/cortexos/stacks/otel/
cd /opt/cortexos/stacks/otel
docker compose up -d --remove-orphans
```

## Verify

```bash
curl -fsS http://127.0.0.1:8889/metrics >/dev/null && echo OK
```

Expected: Prometheus metrics endpoint responds with HTTP 200.

## CHECKPOINT 2

**STOP — operator question:** Does `curl -fsS http://127.0.0.1:8889/metrics` return HTTP 200, and do your applications accept OTLP on `127.0.0.1:4317` (gRPC) and `127.0.0.1:4318` (HTTP)?

Type `confirmed` to proceed.

## Rollback

```bash
cd /opt/cortexos/stacks/otel
docker compose down
```

## Next

→ `prompts/tools/27-dockhand.md`
