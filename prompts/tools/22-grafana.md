# Grafana (native)

## Purpose

Run Grafana as a native systemd service, provision Prometheus and Loki datasources, and import the CortexOS dashboard template.

## Prerequisites

- `20-prometheus.md` and `21-loki.md` completed.

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

- [ ] CHECKPOINT 1 confirmed — port 3000 is free
- [ ] Install Grafana from official apt repository
- [ ] Configure root serving on tailnet port `3000`
- [ ] Provision Prometheus and Loki datasources
- [ ] Write `/opt/cortexos/.secrets/grafana.env` (mode 0600) with `GRAFANA_ADMIN_PASSWORD`
- [ ] `systemctl enable --now grafana-server`
- [ ] Import `templates/grafana/cortex-v1.json` via API
- [ ] Confirm `https://${CORTEX_DOMAIN}:3000/login` returns HTTP 200
- [ ] CHECKPOINT 2 confirmed

## CHECKPOINT 1

**STOP — operator question:** Does `ss -tlnp | grep 3000` print no output (port 3000 free)?

Type `confirmed` to proceed.

## Install

```bash
sudo install -d -m 0755 /etc/apt/keyrings
curl -fsSL https://apt.grafana.com/gpg.key | sudo gpg --dearmor -o /etc/apt/keyrings/grafana.gpg
echo "deb [signed-by=/etc/apt/keyrings/grafana.gpg] https://apt.grafana.com stable main" \
  | sudo tee /etc/apt/sources.list.d/grafana.list
sudo apt-get update
pkg_install grafana
```

## Configure

```bash
sudo tee /opt/cortexos/.secrets/grafana.env <<EOF
GRAFANA_ADMIN_PASSWORD=${GRAFANA_ADMIN_PASSWORD}
EOF
sudo chmod 600 /opt/cortexos/.secrets/grafana.env

sudo install -d -m 0755 /etc/grafana/provisioning/datasources
sudo tee /etc/grafana/provisioning/datasources/cortex.yml <<'EOF'
apiVersion: 1
datasources:
  - name: Prometheus
    type: prometheus
    url: http://127.0.0.1:9090
    isDefault: true
  - name: Loki
    type: loki
    url: http://127.0.0.1:3100
EOF

sudo tee /etc/grafana/grafana.ini.d/cortexos.ini >/dev/null <<EOF
[server]
http_addr = 127.0.0.1
http_port = 3000
root_url = https://${CORTEX_DOMAIN}:3000/
serve_from_sub_path = false

[security]
admin_password = ${GRAFANA_ADMIN_PASSWORD}

[users]
allow_sign_up = false
EOF

sudo systemctl daemon-reload
sudo systemctl enable --now grafana-server
```

If your Grafana package does not load `/etc/grafana/grafana.ini.d/*.ini`, merge the same stanzas into `/etc/grafana/grafana.ini` and restart `grafana-server`.

Import CortexOS Grafana dashboard:

```bash
jq -n --argjson dashboard "$(cat templates/grafana/cortex-v1.json)" '{dashboard: $dashboard, overwrite: true, folderId: 0}' \
  | curl -fsS -X POST "http://admin:${GRAFANA_ADMIN_PASSWORD}@127.0.0.1:3000/api/dashboards/import" \
      -H "Content-Type: application/json" \
      -d @-
```

## Verify

```bash
curl -s -o /dev/null -w "%{http_code}\n" http://127.0.0.1:3000/login
curl -sS "https://${CORTEX_DOMAIN}:3000/login" -o /dev/null -w "%{http_code}\n"
```

Expected: `200` on both.

## CHECKPOINT 2

**STOP — operator question:** Does `curl -sS "https://${CORTEX_DOMAIN}:3000/login" -o /dev/null -w "%{http_code}"` print `200`?

Type `confirmed` to proceed.

## CHECKPOINT 3

**STOP — operator question:** In the Grafana UI, do both the `Prometheus` and `Loki` datasources display a green "Data source is working" tick?

Type `confirmed` to proceed.

## Next

→ `prompts/tools/23-fluent-bit.md`
