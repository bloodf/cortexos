# cAdvisor (latest)

## Purpose

Run cAdvisor as a Docker container to expose per-container CPU, memory, and I/O metrics for Prometheus to scrape.

## Prerequisites

- `20-prometheus.md` completed (Prometheus scrapes `host.docker.internal:8081/cadvisor/metrics`).

## Distro selection

```bash
source scripts/pkg.sh
echo "OS family: $(pkg_family) $(pkg_version)"
: "${CORTEX_OS_FAMILY:?run prompts/os/00-os-selection.md first}"
```

## Todo

- [ ] CHECKPOINT 1 confirmed — port 8081 is free (8080 owned by Caddy)
- [ ] Append `cadvisor` service to monitoring compose (host 8081 → container 8080, `--url_base_prefix=/cadvisor`)
- [ ] `docker compose up -d cadvisor`
- [ ] Confirm `curl http://localhost:8081/cadvisor/metrics | grep container_cpu_usage_seconds_total` prints metric lines
- [ ] Query `http://127.0.0.1:9090/prometheus/api/v1/targets` and confirm `cadvisor` health is `up`
- [ ] CHECKPOINT 2 confirmed — UI loads via tailnet AND Prometheus target `up`

## CHECKPOINT 1

**STOP — operator question:** Does `ss -tlnp | grep 8081` print no output (port 8081 free)? Note: cAdvisor binds 8081 because Caddy already owns 8080.

Type `confirmed` to proceed.

## Install

Append cAdvisor to monitoring compose:

```bash
cat >> /opt/cortexos/stacks/monitoring/docker-compose.yml <<'EOF'

  cadvisor:
    image: gcr.io/cadvisor/cadvisor
    restart: unless-stopped
    privileged: true
    # Sub-path mount: Caddy serves cAdvisor at /cadvisor/ and does NOT
    # strip the prefix, so cAdvisor must own the prefix.
    command:
      - --url_base_prefix=/cadvisor
    ports:
      # Host 8081 → container 8080. Port 8080 on the host is Caddy.
      - "127.0.0.1:8081:8080"
    volumes:
      - /:/rootfs:ro
      - /var/run:/var/run:ro
      - /sys:/sys:ro
      - /var/lib/docker:/var/lib/docker:ro
      - /dev/disk:/dev/disk:ro
    devices:
      - /dev/kmsg
EOF
```

```bash
cd /opt/cortexos/stacks/monitoring
docker compose up -d cadvisor
```

> Caddy forwards the `/cadvisor` prefix to this backend without
> stripping it. Do NOT change `--url_base_prefix` here without
> updating `prompts/tools/13-caddy.md` to match.

## Verify

```bash
# Local health probe — note the /cadvisor prefix and the 8081 host port:
curl -s http://localhost:8081/cadvisor/metrics | grep 'container_cpu_usage_seconds_total' | head -3

# Through the tailnet:
curl -sS "https://${CORTEX_DOMAIN}/cadvisor/" -o /dev/null -w "cadvisor: %{http_code}\n"
```

Expected: metric lines printed; tailnet probe returns `200`/`302`.

Then verify Prometheus has discovered this exporter and is scraping it
successfully. Prometheus is owned by `20-prometheus.md`, so query its
API directly:

```bash
# Prometheus is bound on host 127.0.0.1:9090 and served under
# --web.route-prefix=/prometheus (see 13-caddy.md and 20-prometheus.md).
# Query the local listener directly — no Caddy round-trip required.
curl -fsS "http://127.0.0.1:9090/prometheus/api/v1/targets" \
  | jq -r '.data.activeTargets[] | select(.labels.job=="cadvisor") | .health'
```

Expected: `up`. If Prometheus binds without the path prefix in some
local configurations, fall back to `http://127.0.0.1:9090/api/v1/targets`.

## CHECKPOINT 2

**STOP — operator question:** Did `curl -sS "https://${CORTEX_DOMAIN}/cadvisor/"` return HTTP `200` or `302` (not `502`, not `connection refused`)?

Type `confirmed` to proceed.

## CHECKPOINT 3

**STOP — operator question:** Did `curl -fsS "http://127.0.0.1:9090/prometheus/api/v1/targets" | jq -r '.data.activeTargets[] | select(.labels.job=="cadvisor") | .health'` print `up` (not `down`, not empty)?

> Per [prompts/CHECKPOINT-PATTERN.md](../CHECKPOINT-PATTERN.md), this
> spoke owns the cAdvisor container, its local listener, and the
> Prometheus target-up evidence for `job="cadvisor"`. The end-to-end
> Grafana dashboard view is verified in `99-final-validation.md`.

Type `confirmed` to proceed.

## Next

→ `prompts/tools/25-node-exporter.md`
