# Fluent Bit (latest)

## Purpose

Run Fluent Bit as a Docker container to collect Docker container logs and systemd journal logs, then forward them to Loki.

## Prerequisites

- `21-loki.md` completed (Loki reachable at `localhost:3100`).
- `11-docker.md` completed.

## Distro selection

```bash
source scripts/pkg.sh
echo "OS family: $(pkg_family) $(pkg_version)"
: "${CORTEX_OS_FAMILY:?run prompts/os/00-os-selection.md first}"
```

## CHECKPOINT 1

Operator: confirm Loki is running (`curl -s http://localhost:3100/ready` returns `ready`). Type "confirmed" to proceed.

## Install

```bash
mkdir -p /opt/cortexos/stacks/monitoring/fluent-bit

tee /opt/cortexos/stacks/monitoring/fluent-bit/fluent-bit.conf <<'EOF'
[SERVICE]
    Flush        5
    Daemon       Off
    Log_Level    warn

[INPUT]
    Name         systemd
    Tag          host.*
    Systemd_Filter _SYSTEMD_UNIT=docker.service
    Read_From_Tail On

[INPUT]
    Name         forward
    Listen       0.0.0.0
    Port         24224

[OUTPUT]
    Name         loki
    Match        *
    Host         loki
    Port         3100
    Labels       job=fluent-bit
EOF
```

Append Fluent Bit to monitoring compose:

```bash
cat >> /opt/cortexos/stacks/monitoring/docker-compose.yml <<'EOF'

  fluent-bit:
    image: fluent/fluent-bit
    restart: unless-stopped
    ports:
      - "127.0.0.1:24224:24224"
    volumes:
      - ./fluent-bit/fluent-bit.conf:/fluent-bit/etc/fluent-bit.conf:ro
      - /run/log/journal:/run/log/journal:ro
      - /etc/machine-id:/etc/machine-id:ro
    depends_on:
      - loki
EOF
```

```bash
cd /opt/cortexos/stacks/monitoring
docker compose up -d fluent-bit
```

## Verify

```bash
docker compose -p monitoring logs fluent-bit --tail 20
```

Expected: no errors, Loki output plugin reports `flush OK`.

Then query Loki's HTTP API directly to prove Fluent Bit is actually
shipping records (no Grafana required — Loki is owned by `21-loki.md`,
not by Grafana):

```bash
# Give Fluent Bit a moment to flush its first batch
sleep 15

# Loki LogQL: count of streams labelled service="fluent-bit" in the
# last 5 minutes. Expect > 0.
curl -fsS --get \
  --data-urlencode 'query={service="fluent-bit"}' \
  "http://127.0.0.1:3100/loki/api/v1/query" \
  | jq '.data.result | length'
```

Expected: a number `> 0`. `0` means Fluent Bit is up but no records have
reached Loki yet — re-run after `sleep 30` before treating it as a
failure.

## CHECKPOINT 2

Operator: confirm the Loki query above returns `> 0` and `docker compose
-p monitoring logs fluent-bit` shows no errors. Type "confirmed" to proceed.

> Grafana dashboard confirmation belongs to `22-grafana.md` and the
> consolidated pass in `99-final-validation.md`. Per
> [prompts/CHECKPOINT-PATTERN.md](../CHECKPOINT-PATTERN.md), this spoke
> verifies only the Fluent Bit → Loki ingest contract via the Loki HTTP
> API.

## Next

→ `prompts/tools/24-cadvisor.md`
