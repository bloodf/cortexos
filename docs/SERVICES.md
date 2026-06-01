# CortexOS Services Inventory

Complete list of services running on the CortexOS host.

## Docker Compose Stack

### Databases
| Service | Internal Port | External Port | Image | Status |
|---------|---------------|---------------|-------|--------|
| PostgreSQL | 5432 | 127.0.0.1:5432 | postgres:16 | healthy |
| MySQL | 3306 | 127.0.0.1:3306 | mysql:8 | healthy |
| MongoDB | 27017 | 127.0.0.1:27017 | mongo:7 | healthy |
| Redis | 6379 | 127.0.0.1:6379 | redis:7-alpine | healthy |

### Monitoring Stack
| Service | Internal Port | External Port | Image | Status |
|---------|---------------|---------------|-------|--------|
| Prometheus | 9090 | 127.0.0.1:9090 | prom/prometheus | running |
| Grafana | 3000 | 100.109.20.9:3000 | grafana/grafana | running |
| Loki | 3100 | 127.0.0.1:3100 | grafana/loki | running |
| cAdvisor | 8080 | 127.0.0.1:8081 | gcr.io/cadvisor | healthy |
| Node Exporter | 9100 | host network | prom/node-exporter | running |
| Fluent Bit | 24224 | 127.0.0.1:24224 | fluent/fluent-bit | running |

### Exporters
| Service | Port | Target | Status |
|---------|------|--------|--------|
| pg-exporter | 9187 | PostgreSQL | running |
| mysql-exporter | 9104 | MySQL | running |
| redis-exporter | 9121 | Redis | running |

### Application Services
| Service | Internal Port | External Port | Image | Status |
|---------|---------------|---------------|-------|--------|
| Dashboard | 3000 | 100.109.20.9:3000 | cortex-dashboard | healthy |
| Obot MCP | 8080 | 100.109.20.9:8090 | cortex-obot | running |
| Sandbox Runner | 8091 | 127.0.0.1:8091 | cortex-sandbox-runner | healthy |
| Kernel Browser | 3000 | 127.0.0.1:3333 | cortex-kernel-browser | running |
| PHPMyAdmin | 80 | 100.109.20.9:8082 | phpmyadmin | running |
| Mongo Express | 8081 | 100.109.20.9:8083 | mongo-express | running |

### AI Services
| Service | Port | Network | Status |
|---------|------|---------|--------|
| 9Router | 11434 | bridge+host | running |
| Ollama | 8080 | host | running |

### External Services
| Service | Port | Network | Status |
|---------|------|---------|--------|
| SMS1 Obot MCP | 8099 | bridge | running |
| SMS1 Obot Server | 8080 | bridge | running |

## Systemd Services

### Core Infrastructure
| Service | Status | Description |
|---------|--------|-------------|
| caddy | active | Reverse proxy with TLS |
| tailscaled | active | Tailscale VPN agent |

### AI Stack
| Service | Status | Description |
|---------|--------|-------------|
| 9router.service | active | 9Router AI Gateway |
| 9router-docker-proxy.service | active | Docker network bridge |
| ollama.service | active | Ollama LLM service |
| hermes-gateway-cortex.service | active | Hermes messaging integration |
| honcho-mcp.service | active | Honcho MCP Worker |

### Application
| Service | Status | Description |
|---------|--------|-------------|
| cortex-dashboard.service | active | Next.js dashboard |
| cortex-mail-guardian.service | active | IMAP listener |

## Network Configuration

### External Interfaces
- **Tailscale**: `100.109.20.9` (tailnet IP)
- **Docker bridge**: `172.17.0.1`

### Listening Addresses
```
127.0.0.1:3306     MySQL
127.0.0.1:5432     PostgreSQL
127.0.0.1:6379     Redis
127.0.0.1:8090-91  Obot, Sandbox
127.0.0.1:9090     Prometheus
127.0.0.1:3100     Loki
100.109.20.9:3000  Dashboard, Grafana
100.109.20.9:443   Caddy TLS
100.109.20.9:8090  Obot
100.109.20.9:8081-83  PHPMyAdmin, Mongo Express
```

## Container Names

All containers prefixed with `cortex-`:
```
cortex-kernel-browser
cortex-redis
cortex-prometheus
cortex-grafana
cortex-dashboard
cortex-sandbox-runner
cortex-mysql-exporter
cortex-cadvisor
cortex-redis-exporter
cortex-pg-exporter
cortex-fluent-bit
cortex-loki
cortex-node-exporter
cortex-obot
cortex-mysql
cortex-phpmyadmin
cortex-mongo-express
```

## Health Checks

All services auto-restart via Docker healthcheck or systemd.

### Verify Status
```bash
# Docker containers
docker ps --format "table {{.Names}}\t{{.Status}}" | grep cortex

# Systemd services
systemctl status 'cortex-*' '9router*' 'ollama*' 'honcho*' 'hermes*' 'caddy*'

# All listening ports
ss -tlnp | grep -E ":(3000|5432|3306|27017|6379|9090|3100)"
```

## Adding New Services

1. Add to `docker-compose.yml` in `/opt/cortexos`
2. Use `cortex-` prefix for container names
3. Bind to `127.0.0.1` for internal services
4. Add healthcheck configuration
5. Document in this file
