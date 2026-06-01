# CortexOS Ubuntu Setup Guide

This guide sets up a complete CortexOS server from scratch on Ubuntu 24.04+.

## Prerequisites

- Ubuntu 24.04 LTS or newer
- Root or sudo access
- SSH access from operator laptop

## Step 1: Initial System Setup

### Update System
```bash
sudo apt update && sudo apt upgrade -y
```

### Install Core Dependencies
```bash
sudo apt install -y \
    curl \
    wget \
    git \
    vim \
    jq \
    unzip \
    ca-certificates \
    gnupg \
    lsb-release \
    software-properties-common \
    apt-transport-https \
    ca-certificates \
    openssl
```

### Create CortexOS User
```bash
sudo adduser cortexos
sudo usermod -aG sudo,docker,systemd-journal cortexos
```

## Step 2: Docker & Docker Compose

### Install Docker
```bash
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker cortexos
sudo systemctl enable docker
```

### Install Docker Compose
```bash
sudo curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
sudo chmod +x /usr/local/bin/docker-compose
```

### Verify
```bash
docker --version
docker-compose --version
```

## Step 3: Install AI Gateway (9Router)

### Pull & Start 9Router
```bash
docker run -d \
  --name 9router \
  --restart unless-stopped \
  -p 127.0.0.1:11434:11434 \
  -v 9router-data:/data \
  ghcr.io/openrouter/9router:latest
```

### Verify
```bash
curl -s http://127.0.0.1:11434/v1/models | jq '.data[].id'
```

## Step 4: Install Ollama

### Install
```bash
curl -fsSL https://ollama.com/install.sh | sh
```

### Configure Service
```bash
sudo systemctl enable ollama
sudo systemctl start ollama
```

### Pull Models
```bash
ollama pull llama3.2
ollama pull codellama
```

## Step 5: Database Stack (Docker)

### Create Docker Compose File
```bash
sudo mkdir -p /opt/cortexos
sudo chown cortexos:cortexos /opt/cortexos
cd /opt/cortexos
```

Create `docker-compose.yml`:
```yaml
version: '3.8'

services:
  postgres:
    image: postgres:16-alpine
    container_name: cortex-postgres
    restart: unless-stopped
    environment:
      POSTGRES_DB: cortex
      POSTGRES_USER: cortex
      POSTGRES_PASSWORD_FILE: /run/secrets/postgres_password
    volumes:
      - postgres_data:/var/lib/postgresql/data
    ports:
      - "127.0.0.1:5432:5432"
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U cortex"]
      interval: 10s
      timeout: 5s
      retries: 5

  mysql:
    image: mysql:8
    container_name: cortex-mysql
    restart: unless-stopped
    environment:
      MYSQL_ROOT_PASSWORD_FILE: /run/secrets/mysql_root_password
      MYSQL_DATABASE: cortex
      MYSQL_USER: cortex
      MYSQL_PASSWORD_FILE: /run/secrets/mysql_password
    volumes:
      - mysql_data:/var/lib/mysql
    ports:
      - "127.0.0.1:3306:3306"
    healthcheck:
      test: ["CMD", "mysqladmin", "ping", "-h", "localhost"]
      interval: 10s
      timeout: 5s
      retries: 5

  mongodb:
    image: mongo:7
    container_name: cortex-mongodb
    restart: unless-stopped
    environment:
      MONGO_INITDB_ROOT_USERNAME: cortex
      MONGO_INITDB_ROOT_PASSWORD_FILE: /run/secrets/mongo_password
    volumes:
      - mongodb_data:/data/db
    ports:
      - "127.0.0.1:27017:27017"

  redis:
    image: redis:7-alpine
    container_name: cortex-redis
    restart: unless-stopped
    command: redis-server --appendonly yes
    volumes:
      - redis_data:/data
    ports:
      - "127.0.0.1:6379:6379"
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 10s
      timeout: 5s
      retries: 5

volumes:
  postgres_data:
  mysql_data:
  mongodb_data:
  redis_data:
```

### Start Databases
```bash
docker compose up -d
```

## Step 6: Monitoring Stack

Add to `docker-compose.yml`:

```yaml
  prometheus:
    image: prom/prometheus:latest
    container_name: cortex-prometheus
    restart: unless-stopped
    command:
      - '--config.file=/etc/prometheus/prometheus.yml'
      - '--storage.tsdb.path=/prometheus'
    volumes:
      - ./prometheus.yml:/etc/prometheus/prometheus.yml
      - prometheus_data:/prometheus
    ports:
      - "127.0.0.1:9090:9090"

  grafana:
    image: grafana/grafana:latest
    container_name: cortex-grafana
    restart: unless-stopped
    environment:
      GF_SECURITY_ADMIN_PASSWORD: ${GRAFANA_PASSWORD}
    volumes:
      - grafana_data:/var/lib/grafana
    ports:
      - "127.0.0.1:3001:3000"

  loki:
    image: grafana/loki:latest
    container_name: cortex-loki
    restart: unless-stopped
    volumes:
      - loki_data:/loki
    ports:
      - "127.0.0.1:3100:3100"

  node-exporter:
    image: prom/node-exporter:latest
    container_name: cortex-node-exporter
    restart: unless-stopped
    command:
      - '--path.procfs=/host/proc'
      - '--path.sysfs=/host/sys'
      - '--collector.filesystem.mount-points-exclude=^/(sys|proc|dev|host|etc)($$|/)'
    volumes:
      - /proc:/host/proc:ro
      - /sys:/host/sys:ro
      - /:/rootfs:ro
    ports:
      - "127.0.0.1:9100:9100"

  cadvisor:
    image: gcr.io/cadvisor/cadvisor:latest
    container_name: cortex-cadvisor
    restart: unless-stopped
    volumes:
      - /:/rootfs:ro
      - /var/run:/var/run:ro
      - /sys:/sys:ro
      - /var/lib/docker/:/var/lib/docker:ro
    ports:
      - "127.0.0.1:8081:8080"
```

## Step 7: Caddy Reverse Proxy

### Install
```bash
sudo apt install -y caddy
```

### Configure
```bash
sudo nano /etc/caddy/Caddyfile
```

Example:
```caddy
# Dashboard
dashboard.yourdomain.com {
    reverse_proxy localhost:3000
}

# Grafana
grafana.yourdomain.com {
    reverse_proxy localhost:3001
}

# Prometheus
prometheus.yourdomain.com {
    reverse_proxy localhost:9090
}

# PHPMyAdmin
phpmyadmin.yourdomain.com {
    reverse_proxy localhost:8082
}
```

```bash
sudo systemctl reload caddy
```

## Step 8: Tailscale

### Install
```bash
curl -fsSL https://tailscale.com/install.sh | sh
```

### Connect
```bash
sudo tailscale up --accept-routes
```

## Step 9: Dashboard (Next.js)

### Install Node.js
```bash
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo bash -
sudo apt install -y nodejs
npm install -g pnpm
```

### Clone & Setup
```bash
cd /opt/cortexos
pnpm install
pnpm build
```

### Run as Service
```bash
sudo nano /etc/systemd/system/cortex-dashboard.service
```

```ini
[Unit]
Description=CortexOS Dashboard
After=network.target

[Service]
Type=simple
User=cortexos
WorkingDirectory=/opt/cortexos
ExecStart=/usr/bin/pnpm start
Restart=always

[Install]
WantedBy=multi-user.target
```

```bash
sudo systemctl enable cortex-dashboard
sudo systemctl start cortex-dashboard
```

## Step 10: CLI Tools (Claude Code, Qwen Code)

### Claude Code
```bash
npm install -g @anthropic-ai/claude-code
```

### Qwen Code
```bash
curl -fsSL https://qwen.ai/install.sh | sh
```

## Verification

### Check All Services
```bash
# Docker
docker ps | grep cortex

# Systemd
systemctl status caddy tailscaled cortex-dashboard ollama

# Ports
ss -tlnp | grep -E ":(3000|5432|3306|6379|9090|3100)"
```

### Test AI Gateway
```bash
curl -s http://127.0.0.1:11434/v1/models | jq '.data | length'
```

## Next Steps

1. Configure secrets in `/opt/cortexos/.secrets/`
2. Set up SOPS encryption
3. Configure backups
4. Review `docs/CONFIG.md` for dotfiles
5. See `docs/SERVICES.md` for service details
