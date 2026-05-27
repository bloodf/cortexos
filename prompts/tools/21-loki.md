# Loki (native)

## Chat Input Gate

This prompt follows `prompts/CHAT-INPUT-CONTRACT.md` and the prompt skeleton in `docs/SCRIPT-PROMPT-POLICY.md`. Ask required operator-specific values through a **STOP — input question** before emitting commands that use them.

## Purpose

Run Grafana Loki as a native systemd service to aggregate logs from Fluent Bit and make them queryable in Grafana.

Loki is API-only; it has no built-in web UI. Operators query Loki through Grafana Explore using the Loki datasource.

## Prerequisites

- `20-prometheus.md` completed.

## Distro selection

```bash
source scripts/pkg.sh
echo "OS family: $(pkg_family) $(pkg_version)"
# OS family is detected by scripts/pkg.sh; if detection is unsupported, stop and ask the operator before continuing.
```

## Sudo gate

```bash
sudo -v
```

## Todo

- [ ] CHECKPOINT 1 confirmed — port 3100 is free
- [ ] Install Loki binary or package
- [ ] Install `templates/monitoring/loki-config.yml` to `/etc/loki/loki-config.yml`
- [ ] Install `templates/systemd/loki.service`
- [ ] Confirm `curl http://127.0.0.1:3100/ready` prints `ready`
- [ ] CHECKPOINT 2 confirmed

## CHECKPOINT 1

**STOP — operator question:** Does `ss -tlnp | grep 3100` print no output (port 3100 free)?

Type `confirmed` to proceed.

## Install

```bash
sudo useradd --system --no-create-home --shell /usr/sbin/nologin loki 2>/dev/null || true
sudo install -d -o loki -g loki -m 0755 /etc/loki /var/lib/loki

if ! command -v loki >/dev/null 2>&1; then
  tmp=$(mktemp -d)
  curl -fsSL -o "$tmp/loki.zip" https://github.com/grafana/loki/releases/download/v3.5.7/loki-linux-amd64.zip
  unzip -o "$tmp/loki.zip" -d "$tmp"
  sudo install -m 0755 "$tmp/loki-linux-amd64" /usr/local/bin/loki
fi

sudo install -m 0644 templates/monitoring/loki-config.yml /etc/loki/loki-config.yml
sudo install -m 0644 templates/systemd/loki.service /etc/systemd/system/loki.service
sudo systemctl daemon-reload
sudo systemctl enable --now loki
```

## Verify

```bash
curl -fsS http://127.0.0.1:3100/ready
curl -sS "https://${CORTEX_DOMAIN}/loki/ready"
```

Expected: `ready`. Do not expect a Loki web UI on port `3100`; browser access is API endpoints only.

## CHECKPOINT 2

**STOP — operator question:** Did `curl -s http://127.0.0.1:3100/ready` print `ready` AND `curl -sS "https://${CORTEX_DOMAIN}/loki/ready"` also print `ready`?

Type `confirmed` to proceed.

## Next

→ `prompts/tools/22-grafana.md`
