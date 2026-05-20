# 55 — Langfuse self-host + first-admin bootstrap (V8)

> Operator-facing install prompt. Run as the privileged operator on the
> CortexOS host. Requires `sops`, `age`, `docker compose`, the core
> Postgres stack (prompt `14-postgresql.md`), and the `cortex-net` Docker
> network (created by `11-docker.md`).

## Sudo gate

This spoke runs `sudo`. Authenticate **now** so the rest of the steps don't pause for a password mid-flow:

```bash
sudo -v
```

CortexOS never stores your password — only the kernel's sudo timestamp is used. Re-run if it expires.

## Todo

- [ ] Create `cortex-net` docker network + sync stack to `/opt/cortexos/stacks/cortex-langfuse/`
- [ ] Source `pkg.sh`; confirm `$CORTEX_OS_FAMILY` is set
- [ ] Create `langfuse` Postgres role + database
- [ ] Decrypt `langfuse.env` via SOPS (mode 0600)
- [ ] Generate `pk-lf-*` + `sk-lf-*` project keys and patch env
- [ ] `docker compose pull && docker compose up -d`
- [ ] Poll `/api/public/health` until 200
- [ ] Confirm first-admin login + `cortexos` project + pre-minted key listed
- [ ] Append LANGFUSE_HOST/PUBLIC/SECRET to consumer.env + paperclip.env + graph.env
- [ ] Restart cortex-consumer, cortex-paperclip-bridge, cortex-graph
- [ ] Trigger paperclip heartbeat; confirm trace appears in Langfuse Traces
- [ ] CHECKPOINT confirmed — all 4 containers `Up (healthy)`
- [ ] CHECKPOINT confirmed — /api/public/health returns 200
- [ ] CHECKPOINT confirmed — test trace visible in UI

## 0. Preconditions

```bash
docker network ls | grep -q cortex-net || docker network create cortex-net
test -d /opt/cortexos/stacks/cortex-langfuse || sudo mkdir -p /opt/cortexos/stacks/cortex-langfuse
sudo cp -a stacks/cortex-langfuse/. /opt/cortexos/stacks/cortex-langfuse/
```

Confirm host family + package dispatcher (per `prompts/os/00-os-selection.md`):

```bash
source /opt/cortexos/scripts/pkg.sh
echo "OS family: ${CORTEX_OS_FAMILY:?must be set by 00-os-selection.md}"
```

## 1. Provision Postgres database

```bash
sudo -u postgres psql <<'SQL'
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'langfuse') THEN
    CREATE ROLE langfuse LOGIN PASSWORD :'pw';
  END IF;
END$$;
SELECT 'role ready';
SQL
sudo -u postgres createdb -O langfuse langfuse || true
```

Replace `:pw` with the value of `LANGFUSE_DB_PASSWORD` from the decrypted
secrets bundle (next step).

### 1.1 Host reachability for containerised Postgres + Redis clients

Langfuse web/worker reach Postgres through the Docker host-gateway mapping. On
Ubuntu/Debian, ensure Postgres listens beyond loopback and UFW allows the
`cortex-net` subnet to reach `5432` (and `6379` if Langfuse reuses the local
Redis instance):

```bash
sudo -u postgres psql -At -c "show listen_addresses;"
# if still `localhost`, set `listen_addresses='*'` in postgresql.conf and restart

CORTEX_NET_SUBNET=$(docker network inspect cortex-net --format '{{(index .IPAM.Config 0).Subnet}}')
sudo ufw allow from "$CORTEX_NET_SUBNET" to any port 5432 proto tcp
sudo ufw allow from "$CORTEX_NET_SUBNET" to any port 6379 proto tcp
```

## 2. Decrypt secrets

```bash
bash /opt/cortexos/scripts/secrets-decrypt.sh langfuse
# → /opt/cortexos/.secrets/langfuse.env
chmod 0600 /opt/cortexos/.secrets/langfuse.env
```

Sanity check (no plaintext leaves the host):

```bash
grep -E '^LANGFUSE_(HOST|PUBLIC_KEY|SECRET_KEY|DATABASE_URL|NEXTAUTH_SECRET|SALT|ENCRYPTION_KEY)=' \
  /opt/cortexos/.secrets/langfuse.env | wc -l
# expect: 7

# Single-node ClickHouse deployments MUST disable clustered migrations.
grep -q '^CLICKHOUSE_CLUSTER_ENABLED=false' /opt/cortexos/.secrets/langfuse.env \
  || echo 'CLICKHOUSE_CLUSTER_ENABLED=false' | sudo tee -a /opt/cortexos/.secrets/langfuse.env
```

## 3. Generate project keys

Langfuse v3 accepts headless bootstrap; we pre-mint the `cortexos` project
key pair so downstream services can be wired before the UI is opened.

```bash
PUB="pk-lf-$(openssl rand -hex 12)"
SEC="sk-lf-$(openssl rand -hex 24)"
sudo sed -i \
  -e "s|^LANGFUSE_PUBLIC_KEY=.*|LANGFUSE_PUBLIC_KEY=${PUB}|" \
  -e "s|^LANGFUSE_SECRET_KEY=.*|LANGFUSE_SECRET_KEY=${SEC}|" \
  /opt/cortexos/.secrets/langfuse.env
```

Stash `${PUB}` and `${SEC}` in the operator password manager; do not commit
to git.

## 4. Bring the stack up

```bash
: "${CORTEX_DOMAIN:?export CORTEX_DOMAIN to your Tailscale MagicDNS FQDN}"
cd /opt/cortexos/stacks/cortex-langfuse
set -a; . /opt/cortexos/.secrets/langfuse.env; set +a
python3 - <<'PY'
from pathlib import Path
env = Path('/opt/cortexos/.secrets/langfuse.env').read_text().splitlines()
if not any(line.startswith('CORTEX_DOMAIN=') for line in env):
    env.append('CORTEX_DOMAIN=${CORTEX_DOMAIN}')
Path('.env').write_text("\n".join(env)+"\n")
PY
docker compose pull
docker compose up -d
```

Tailscale Serve publishes Langfuse directly at
`https://${CORTEX_DOMAIN}:3001/`. Langfuse v3 has no first-class sub-path
support, so it must run at the root of its own port.

Langfuse-web is bound to host port `3001` because Grafana already owns
`3000`; in-cluster service-to-service traffic still uses the container
port `3000` over the `cortex-net` docker network.

### 4.1 Wait for health

```bash
for i in 1 2 3 4 5 6 7 8 9 10; do
  curl -fsS http://${TAILSCALE_IP:-127.0.0.1}:3001/api/public/health && break
  sleep 10
done
```

ClickHouse migrations run on first `langfuse-web` boot and may take 60-120s
on a cold start.

## 5. Verify first-admin bootstrap

```bash
docker logs --since 5m cortex-langfuse-langfuse-web-1 \
  | grep -E "initialised|bootstrap" || true
```

Login at `https://${CORTEX_DOMAIN}:3001/` (or local probe
`http://127.0.0.1:3001/`) with
`LANGFUSE_INIT_USER_EMAIL` + `LANGFUSE_INIT_USER_PASSWORD`. Confirm the
`cortexos` org + project exist and the pre-minted key pair is listed under
**Project → Settings → API Keys**.

## 6. Wire downstream services

Append the project key triplet to every service that imports
`@cortexos/telemetry` (Node) or `cortex_telemetry` (Python):

```bash
for env in /opt/cortexos/.secrets/consumer.env \
           /opt/cortexos/.secrets/paperclip.env \
           /opt/cortexos/.secrets/graph.env; do
  test -f "$env" || continue
  grep -q '^LANGFUSE_HOST=' "$env" || cat >> "$env" <<EOF

# V8 — OpenLLMetry / Langfuse
LANGFUSE_HOST=http://langfuse-web:3000
LANGFUSE_PUBLIC_KEY=${PUB}
LANGFUSE_SECRET_KEY=${SEC}
EOF
done

systemctl restart cortex-consumer cortex-paperclip-bridge cortex-graph || true

# Services that do not share the `cortex-net` Docker network (for example a
# host-networked `cortex-graph`) must use a host-reachable Langfuse URL such as
# `http://${TAILSCALE_IP}:3001` instead of `http://langfuse-web:3000`.
```

## 7. Test trace

```bash
# Trigger a paperclip work event; observe a span land on Langfuse. The
# bridge exposes /paperclip/heartbeat at :8089 (see
# stacks/cortex-paperclip-bridge/server.js). Payload shape matches the
# real heartbeat handler: runId, agentId, cortexRole, context.{taskId,
# wakeReason, commentId?}.
curl -fsS -X POST http://127.0.0.1:8089/paperclip/heartbeat \
  -H "Authorization: Bearer ${PAPERCLIP_WEBHOOK_SECRET}" \
  -H "Content-Type: application/json" \
  -d '{"runId":"probe-1","agentId":"probe","cortexRole":"probe","context":{"taskId":"probe","wakeReason":"manual"}}'

# After ~5 s the trace appears under: Langfuse → Traces → cortex-consumer
```

## 8. Rollback

```bash
cd /opt/cortexos/stacks/cortex-langfuse
docker compose down
# Data persists in clickhouse-data + minio-data volumes; remove only on full
# tenant teardown:
#   docker volume rm cortex-langfuse_clickhouse-data \
#                    cortex-langfuse_clickhouse-logs \
#                    cortex-langfuse_minio-data
```

## 9. Checkpoint

- [ ] `docker compose ps` shows `langfuse-web`, `langfuse-worker`,
      `clickhouse`, `minio` all `Up (healthy)`.
- [ ] `/api/public/health` returns HTTP 200.
- [ ] First-admin login succeeds.
- [ ] `cortexos` project lists the pre-minted public key.
- [ ] Test trace visible in Langfuse Traces view.
- [ ] All three downstream services log `[telemetry] enabled service=…`.

## Related

- `stacks/cortex-langfuse/README.md`
- `docs/OBSERVABILITY-LLM.md`
- `packages/cortex-telemetry/README.md`
- `templates/.secrets/langfuse.enc.yaml`

## Next

→ `prompts/tools/60-cortex-consumer.md`
