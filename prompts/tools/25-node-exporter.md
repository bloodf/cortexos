# Node Exporter (native)

## Purpose

Run Prometheus Node Exporter as a native service exposing host-level metrics to Prometheus.

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

- [ ] CHECKPOINT 1 confirmed — port 9100 is free
- [ ] Install node-exporter package
- [ ] Bind node-exporter on `127.0.0.1:9100`
- [ ] Confirm local metrics include `node_cpu_seconds_total`
- [ ] Query Prometheus targets API and confirm node job is `up`
- [ ] CHECKPOINT 2 confirmed

## CHECKPOINT 1

**STOP — operator question:** Does `ss -tlnp | grep 9100` print no output (port 9100 free)?

Type `confirmed` to proceed.

## Install

```bash
pkg_install prometheus-node-exporter
sudo install -d -m 0755 /etc/systemd/system/prometheus-node-exporter.service.d
sudo tee /etc/systemd/system/prometheus-node-exporter.service.d/cortexos.conf <<'EOF'
[Service]
ExecStart=
ExecStart=/usr/bin/prometheus-node-exporter --web.listen-address=127.0.0.1:9100
EOF
sudo systemctl daemon-reload
sudo systemctl enable --now prometheus-node-exporter
sudo systemctl restart prometheus-node-exporter
```

## Verify

```bash
curl -fsS http://127.0.0.1:9100/metrics | grep -m1 node_cpu_seconds_total
curl -fsS "http://127.0.0.1:9090/api/v1/targets" \
  | jq -r '.data.activeTargets[] | select(.labels.job=="node" or .labels.job=="node-exporter") | .health'
```

Expected: metric line, then `up`.

## CHECKPOINT 2

**STOP — operator question:** Did the local metrics probe print `node_cpu_seconds_total` and did Prometheus report node target `up`?

Type `confirmed` to proceed.

## Next

→ `prompts/tools/26-cockpit.md`
