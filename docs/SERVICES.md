# CortexOS Services Inventory

> Canonical map of every service installed by the `prompts/tools/*` spokes:
> internal port, tailnet URL, default credentials (if any), and the
> spoke that installs it. Replace `${CORTEX_DOMAIN}` with the tailnet FQDN
> you set in `prompts/tools/12-tailscale.md`. All web access reaches the VPS
> over Tailscale (`100.64.0.0/10`) or LAN (`10.0.0.0/8`, `172.16.0.0/12`,
> `192.168.0.0/16`) only — the public internet is firewalled off (see
> `prompts/tools/10-os-hardening.md`).

## Conventions
- **Deployment mode**: how the service runs in production. `native` = systemd service on the host; `docker` = Docker Compose stack. Native-first means Docker is used only for databases, admin tools, isolation services, cAdvisor, Langfuse, and Watchtower.

- **Internal port**: bound to `127.0.0.1` (loopback) or to a Docker bridge.
  Never exposed publicly.
- **Public URL**: served by Tailscale Serve over HTTPS on the tailnet.
  The dashboard remains on `https://${CORTEX_DOMAIN}/`; each other Web UI
  uses its own tailnet port.
- **Default admin**: present only where the upstream ships a seeded user.
  Operators MUST rotate every default credential on first login.

## Web UIs (operator-facing)

| Service          | Spoke                                  | Internal port | Mode   | Public URL                                    | Default admin / password           |
|------------------|----------------------------------------|---------------|--------|-----------------------------------------------|------------------------------------|
| Cortex Dashboard | `70-dashboard.md`                      | 3080          | native | `https://${CORTEX_DOMAIN}/`                   | `admin` / `12345678` (rotate via `/admin/account`) |
| 9Router          | `31-9router.md`                        | 11434         | native | `https://${CORTEX_DOMAIN}:11434/dashboard`    | bearer = `NINEROUTER_API_KEY` (from `/opt/cortexos/.secrets/9router.env`) |
| Grafana          | `22-grafana.md`                        | 3000          | native | `https://${CORTEX_DOMAIN}:3000/`              | `admin` / `GRAFANA_ADMIN_PASSWORD` (from `/opt/cortexos/.secrets/grafana.env`) |
| Prometheus       | `20-prometheus.md`                     | 9090          | native | `https://${CORTEX_DOMAIN}:9090/`              | none (read-only)                   |
| Loki             | `21-loki.md`                           | 3100          | native | `https://${CORTEX_DOMAIN}:3100/`              | none (read-only API)               |
| cAdvisor         | `24-cadvisor.md`                       | 8081          | docker | `https://${CORTEX_DOMAIN}:8081/`              | none                               |
| NATS monitor     | `30-nats.md`                           | 8222          | native | `https://${CORTEX_DOMAIN}:8222/`              | none (read-only)                   |
| OpenViking Console | `32-openviking.md`                  | 8020          | native | `https://${CORTEX_DOMAIN}:8020/`              | root key in `openviking.env`       |
| Langfuse         | `55-langfuse.md`                       | 3001          | docker | `https://${CORTEX_DOMAIN}:3001/`              | first-admin bootstrap on first visit |

## Backend services (no UI)

| Service                | Spoke                              | Internal port | Mode   | Notes                                       |
|------------------------|------------------------------------|---------------|--------|---------------------------------------------|
| Tailscale Serve        | `13-tailscale-serve.md`                      | varies        | native | Publishes each loopback Web UI on its own tailnet HTTPS port. |
| PostgreSQL             | `14-postgresql.md`                 | 5432          | docker | `dashboard` DB role; password in `dashboard.env`. |
| Redis                  | `15-redis.md`                      | 6379          | docker | Loopback only; no auth required.            |
| MongoDB                | `16-mongodb.md`                    | 27017         | docker | Loopback only.                              |
| dnsmasq                | `17-dnsmasq.md`                    | 53            | native | Loopback DNS resolver.                      |
| node_exporter          | `25-node-exporter.md`              | 9100          | native | Prometheus scrape target.                   |
| fluent-bit             | `23-fluent-bit.md`                 | 24224         | native | Forwarder; loopback only.                   |
| NATS (JetStream)       | `30-nats.md`                       | 4222          | native | mTLS over loopback; bus for CortexOS events.|
| OpenViking             | `32-openviking.md`                 | 18790         | native | Memory backend; root API key in `openviking.env`. |
| Ollama                 | `32-openviking.md`                 | 11435         | native | Local LLM runtime; **not** port 11434 (9Router owns that). |
| LEANN                  | `33-leann.md`                      | 18791         | native | Vector store sidecar.                       |
| Kernel browser         | `34-kernel-browser.md`             | 7081          | native | Headless browser tool.                      |
| OpenClaw gateway       | `40-openclaw.md`                   | 18789         | native | Internal A2A surface.                       |
| AgentGateway           | `50-agentgateway.md`               | 18800         | native | MCP / tool invocation.                      |
| cortex-graph           | `45a-cortex-graph.md`              | 8090          | native | LangGraph sidecar (FastAPI).                |
| cortex-sandbox-runner  | `47a-cortex-sandbox.md`            | 8091          | docker | gVisor tool sandbox.                        |
| cortex-paperclip-bridge| `62-paperclip.md`                  | 8089          | native | Webhook receiver + JetStream worker.        |
| cortex-consumer        | `60-cortex-consumer.md`            | n/a (NATS)    | native | JetStream consumer daemon.                  |
| Foundry / weekly       | `47-openclaw-foundry.md`, `61-…`   | varies        | native | Scheduled jobs; no listener.                |

## Default-credential rotation checklist

Run after first bootstrap of each service:

1. **Cortex Dashboard** — log in at `https://${CORTEX_DOMAIN}/admin/login` with
   `admin` / `12345678`, then `/admin/account` → set new password
   (`POST /api/auth/password`). Lost password fallback:
   `sudo /opt/cortexos/packages/cortex-dashboard/scripts/change-admin-password.sh <new-pw>`.
2. **Grafana** — first login at `https://${CORTEX_DOMAIN}:3000/` with `admin` /
   `GRAFANA_ADMIN_PASSWORD`; Grafana forces a rotation flow on first sign-in.
3. **9Router** — admin token equals `NINEROUTER_API_KEY`. Rotate by editing
   `/opt/cortexos/.secrets/9router.env` then `systemctl restart 9router`;
   propagate to every downstream `.env` consuming `NINEROUTER_API_KEY`.
4. **Langfuse** — first visit triggers admin-bootstrap form; pick a strong
   password and seed the `cortexos` project key.
5. **OpenViking** — root API key in `/opt/cortexos/.secrets/openviking.env`;
   rotate via `openssl rand -hex 32` and restart `openviking.service`.

## Where credentials live

| File                                          | Owner          | Mode | Purpose                                  |
|-----------------------------------------------|----------------|------|------------------------------------------|
| `/opt/cortexos/.secrets/9router.env`          | `cortexos`     | 0600 | `NINEROUTER_API_KEY` (master)            |
| `/opt/cortexos/.secrets/dashboard.env`        | `cortexos`     | 0600 | DB password, `CORTEX_MASTER_KEY`, JWT    |
| `/opt/cortexos/.secrets/grafana.env`          | `cortexos`     | 0600 | `GRAFANA_ADMIN_PASSWORD`                 |
| `/opt/cortexos/.secrets/langfuse.env`         | `cortexos`     | 0600 | `LANGFUSE_PUBLIC_KEY` / `LANGFUSE_SECRET_KEY` |
| `/opt/cortexos/.secrets/openviking.env`       | `cortexos`     | 0600 | `OPENVIKING_ROOT_API_KEY`                |
| `/opt/cortexos/.secrets/openclaw.env`         | `cortexos`     | 0600 | OpenClaw tokens + channel creds          |
| `templates/.secrets/*.enc.yaml`               | repo           | 0644 | SOPS+age encrypted source of truth       |

SOPS+age is the single source of truth (`docs/SECRETS.md`). Plaintext files
on the VPS are recovered from the encrypted templates via
`scripts/secrets-decrypt.sh` — never edited in place.

## Firewall posture

`prompts/tools/10-os-hardening.md` enables `ufw` with `default deny incoming`
and `default allow outgoing`. Inbound is allowed **only** from:

- The Tailscale interface (`tailscale0`).
- Tailscale CGNAT block `100.64.0.0/10`.
- RFC1918 LAN ranges: `10.0.0.0/8`, `172.16.0.0/12`, `192.168.0.0/16`.

No public ingress is allowed. Tailscale Serve is reachable only over the
tailnet; without a Tailscale identity (operator laptop or LAN host) the VPS
rejects every connection at L3.
