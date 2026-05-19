# Loki (native)

## Purpose

Run Grafana Loki as a native systemd service to aggregate logs from Fluent Bit and make them queryable in Grafana.

## Prerequisites

- `20-prometheus.md` completed.

## Distro selection

```bash
source scripts/pkg.sh
echo "OS family: $(pkg_family) $(pkg_version)"
: "${CORTEX_OS_FAMILY:?run prompts/os/00-os-selection.md first}"
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

Expected: `ready`.

## CHECKPOINT 2

**STOP — operator question:** Did `curl -s http://127.0.0.1:3100/ready` print `ready` AND `curl -sS "https://${CORTEX_DOMAIN}/loki/ready"` also print `ready`?

Type `confirmed` to proceed.

## Next

→ `prompts/tools/22-grafana.md`
