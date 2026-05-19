# OpenViking (latest)

## Purpose

Install OpenViking as the canonical long-term memory backend for OpenClaw. OpenViking is the single source of truth for agent memory; Hindsight is retired.

## Prerequisites

- `14-postgresql.md` completed (OpenViking stores memory in PostgreSQL).
- `31-9router.md` completed (OpenViking calls AI through 9Router).
- `30-nats.md` completed.

## Distro selection

```bash
source scripts/pkg.sh
echo "OS family: $(pkg_family) $(pkg_version)"
: "${CORTEX_OS_FAMILY:?run prompts/os/00-os-selection.md first}"
```


## Todo

- [ ] CHECKPOINT 1 confirmed
- [ ] Install
- [ ] Configure
- [ ] Verify
- [ ] CHECKPOINT 2 confirmed
## CHECKPOINT 1

**STOP — operator question:** PostgreSQL is running and the `cortex_dashboard` database is accessible?

Type `confirmed` to proceed.
## Install

```bash
git clone https://github.com/openviking/openviking /opt/cortexos/stacks/openviking
cd /opt/cortexos/stacks/openviking
npm install
```

## Configure

Write `/opt/cortexos/.secrets/openviking.env`:

```bash
sudo tee /opt/cortexos/.secrets/openviking.env <<EOF
DATABASE_URL=postgresql://dashboard:{DASHBOARD_DB_PASSWORD}@127.0.0.1:5432/cortex_dashboard
NINEROUTER_BASE_URL=http://127.0.0.1:11434
NINEROUTER_API_KEY={9ROUTER_API_KEY}
NATS_URL=nats://127.0.0.1:4222
OPENVIKING_PORT=18790
EOF
sudo chmod 600 /opt/cortexos/.secrets/openviking.env
```

Apply OpenViking schema migrations:

```bash
cd /opt/cortexos/stacks/openviking
npm run migrate
```

Write systemd unit:

```bash
sudo tee /etc/systemd/system/openviking.service <<'EOF'
[Unit]
Description=OpenViking memory backend
After=postgresql.service nats.service

[Service]
Type=simple
WorkingDirectory=/opt/cortexos/stacks/openviking
EnvironmentFile=/opt/cortexos/.secrets/openviking.env
ExecStart=/usr/bin/node index.js
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
EOF

sudo systemctl daemon-reload
sudo systemctl enable openviking
sudo systemctl start openviking
```

## Verify

```bash
curl -s http://localhost:18790/health
```

Expected: `{"status":"ok"}` or similar health response.

## CHECKPOINT 2

**STOP — operator question:** OpenViking health endpoint returns OK?

Type `confirmed` to proceed.
## Next

→ `prompts/tools/33-leann.md`
