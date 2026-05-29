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

## Todo

- [ ] CHECKPOINT 1 confirmed — Loki `/ready` returns `ready`
- [ ] Write `/opt/cortexos/stacks/monitoring/fluent-bit/fluent-bit.conf` (systemd input → loki output)
- [ ] Append `fluent-bit` service to monitoring compose
- [ ] `docker compose up -d fluent-bit`
- [ ] Sleep 15s, then query Loki `{service="fluent-bit"}` and confirm result count > 0
- [ ] CHECKPOINT 2 confirmed — Loki query returns > 0 streams and compose logs show no errors

## CHECKPOINT 1

**STOP — operator question:** Does `curl -s http://localhost:3100/ready` print `ready` (not `Ingester not ready`, not connection refused)?

Type `confirmed` to proceed.

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
    container_name: cortex-fluent-bit
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

**STOP — operator question:** Did the Loki LogQL `{service="fluent-bit"}` query (above) print an integer **> 0** (not `0`, proving Fluent Bit records reached Loki)?

Type `confirmed` to proceed.

## CHECKPOINT 3

**STOP — operator question:** Does `docker compose -p monitoring logs fluent-bit --tail 20` show **no `[error]` lines** (only `[info]` / `flush OK`)?

> Grafana dashboard confirmation belongs to `22-grafana.md` and the
> consolidated pass in `99-final-validation.md`. Per
> [prompts/CHECKPOINT-PATTERN.md](../CHECKPOINT-PATTERN.md), this spoke
> verifies only the Fluent Bit → Loki ingest contract via the Loki HTTP
> API.

Type `confirmed` to proceed.

## Next

→ `prompts/tools/24-cadvisor.md`
