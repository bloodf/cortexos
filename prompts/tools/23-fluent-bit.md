# Fluent Bit (latest)

## Purpose
Run Fluent Bit as a Docker container to collect Docker container logs and systemd journal logs, then forward them to Loki.

## Prerequisites
- `21-loki.md` completed (Loki reachable at `localhost:3100`).
- `11-docker.md` completed.

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

## CHECKPOINT 2
Operator: confirm Fluent Bit container is running without errors and logs appear in Grafana → Loki datasource. Type "confirmed" to proceed.

## Next
→ `prompts/tools/24-cadvisor.md`
