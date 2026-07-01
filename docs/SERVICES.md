# Services Reference

> **Every service running on CortexOS, explained.**

---

## Databases

### PostgreSQL
| Property | Value |
|----------|--------|
| Container | `cortex-postgres` |
| Port | `5432` (local only) |
| Default User | `cortex` |
| Image | `postgres:16-alpine` |
| Purpose | Main relational database |

**Access:**
```bash
docker exec -it cortex-postgres psql -U cortex -d cortex
```

---

### MySQL
| Property | Value |
|----------|--------|
| Container | `cortex-mysql` |
| Port | `3306` (local only) |
| Default User | `cortex` |
| Image | `mysql:8` |
| Purpose | Web applications |

**Access:**
```bash
docker exec -it cortex-mysql mysql -u cortex -p cortex
```

---

### MongoDB
| Property | Value |
|----------|--------|
| Container | `cortex-mongodb` |
| Port | `27017` (local only) |
| Default User | `cortex` |
| Image | `mongo:7` |
| Purpose | Document storage |

**Access:**
```bash
docker exec -it cortex-mongodb mongosh -u cortex -p
```

---

### Redis
| Property | Value |
|----------|--------|
| Container | `cortex-redis` |
| Port | `6379` (local only) |
| Image | `redis:7-alpine` |
| Purpose | Cache, sessions, real-time |

**Access:**
```bash
docker exec -it cortex-redis redis-cli
```

---

## Monitoring

### Prometheus
| Property | Value |
|----------|--------|
| Container | `cortex-prometheus` |
| Port | `9090` (local only) |
| Image | `prom/prometheus` |
| Purpose | Metrics collection |

**Access:** http://localhost:9090 (via Caddy or local)

---

### Grafana
| Property | Value |
|----------|--------|
| Container | `cortex-grafana` |
| Port | `3001` |
| Image | `grafana/grafana` |
| Purpose | Dashboards and visualization |

**Access:** http://localhost:3001 (via Caddy)

**Default credentials:** admin / password from `GRAFANA_PASSWORD`

---

### Loki
| Property | Value |
|----------|--------|
| Container | `cortex-loki` |
| Port | `3100` (local only) |
| Image | `grafana/loki` |
| Purpose | Log aggregation |

**Access:** Local only, accessed via Grafana

---

### cAdvisor
| Property | Value |
|----------|--------|
| Container | `cortex-cadvisor` |
| Port | `8081` (local only) |
| Image | `gcr.io/cadvisor/cadvisor` |
| Purpose | Container monitoring |

**Access:** http://localhost:8081 (local only)

---

### Node Exporter
| Property | Value |
|----------|--------|
| Container | `cortex-node-exporter` |
| Port | `9100` (host) |
| Image | `prom/node-exporter` |
| Purpose | Host metrics |

**Access:** http://localhost:9100/metrics

---

## Admin Tools

### PHPMyAdmin
| Property | Value |
|----------|--------|
| Container | `cortex-phpmyadmin` |
| Port | `8082` |
| Image | `phpmyadmin:latest` |
| Purpose | MySQL web interface |

**Access:** http://localhost:8082 (via Caddy)

---

### Mongo Express
| Property | Value |
|----------|--------|
| Container | `cortex-mongo-express` |
| Port | `8083` |
| Image | `mongo-express:latest` |
| Purpose | MongoDB web interface |

**Access:** http://localhost:8083 (via Caddy)

---

## AI Services

### Ollama
| Property | Value |
|----------|--------|
| Service | `ollama.service` (systemd) |
| Port | `11434` |
| Purpose | Local AI models |

**Commands:**
```bash
ollama list              # List installed models
ollama pull llama3.2     # Install a model
ollama run llama3.2      # Run a model
```

---

## System Services

### Caddy
| Property | Value |
|----------|--------|
| Service | `caddy.service` (systemd) |
| Ports | `80`, `443` |
| Purpose | Reverse proxy, HTTPS |

**Config:** `/etc/caddy/Caddyfile`

**Reload:** `sudo systemctl reload caddy`

---

### Tailscale
| Property | Value |
|----------|--------|
| Service | `tailscaled.service` (systemd) |
| Purpose | VPN |

**Commands:**
```bash
tailscale status         # Check connection
tailscale up             # Connect
tailscale ip            # Get your IP
```

---

## Management Commands

### Check All Docker Containers
```bash
docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"
```

### Check All System Services
```bash
systemctl status 'cortex-*' --no-pager
```

### Check Ports
```bash
ss -tlnp | grep -E ":(3000|5432|3306|6379|9090)"
```

### Restart All Docker Services
```bash
docker restart $(docker ps -q)
```

### View All Logs
```bash
journalctl -u caddy -u tailscaled -u ollama --no-pager -n 50
```

---

## Quick Reference

| Service | Port | Access |
|---------|------|--------|
| Dashboard | 3000 | Via Caddy |
| Grafana | 3001 | Via Caddy |
| PostgreSQL | 5432 | Local only |
| MySQL | 3306 | Local only |
| MongoDB | 27017 | Local only |
| Redis | 6379 | Local only |
| Prometheus | 9090 | Local only |
| PHPMyAdmin | 8082 | Via Caddy |
| Mongo Express | 8083 | Via Caddy |
| Node Exporter | 9100 | Local only |
| cAdvisor | 8081 | Local only |
