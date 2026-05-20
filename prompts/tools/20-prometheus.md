# Prometheus (native)

## Purpose

Run Prometheus as a native systemd service scraping CortexOS metrics.

## Prerequisites

- `13-tailscale-serve.md` completed.

## Sudo gate

```bash
sudo -v
```

## Todo

- [ ] CHECKPOINT 1 confirmed — port 9090 is free
- [ ] Install Prometheus package or binary
- [ ] Install `templates/monitoring/prometheus.yml`
- [ ] Install `templates/systemd/prometheus.service`
- [ ] Confirm `curl http://127.0.0.1:9090/-/healthy` succeeds
- [ ] CHECKPOINT 2 confirmed

## CHECKPOINT 1

**STOP — operator question:** Does `ss -tlnp | grep 9090` print no output (port 9090 free)?

Type `confirmed` to proceed.

## Install

```bash
pkg_install prometheus || true
sudo useradd --system --no-create-home --shell /usr/sbin/nologin prometheus 2>/dev/null || true
sudo install -d -o prometheus -g prometheus -m 0755 /etc/prometheus /var/lib/prometheus
sudo install -m 0644 templates/monitoring/prometheus.yml /etc/prometheus/prometheus.yml
sudo install -m 0644 templates/systemd/prometheus.service /etc/systemd/system/prometheus.service
sudo systemctl daemon-reload
sudo systemctl enable --now prometheus
```

## Verify

```bash
curl -fsS http://127.0.0.1:9090/-/healthy
curl -sS "https://${CORTEX_DOMAIN}:9090/-/healthy"
```

Expected: `Prometheus Server is Healthy.`

## CHECKPOINT 2

**STOP — operator question:** Does `curl -sS "https://${CORTEX_DOMAIN}:9090/-/healthy"` print `Prometheus Server is Healthy.`?

Type `confirmed` to proceed.

## Next

→ `prompts/tools/21-loki.md`
