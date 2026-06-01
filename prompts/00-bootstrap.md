# CortexOS Interactive Installer

> Guided setup for the complete CortexOS stack on Ubuntu 24.04+

## Before You Start

Ensure you have:
- Ubuntu 24.04 LTS or newer
- SSH access to the target host
- A user account with sudo privileges

## Step 1: OS Prerequisites

```bash
# Update system
sudo apt update && sudo apt upgrade -y

# Install core dependencies
sudo apt install -y curl wget git vim jq unzip ca-certificates gnupg lsb-release \
    software-properties-common apt-transport-https openssl build-essential
```

## Step 2: Install Docker

```bash
# Install Docker
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker $USER

# Install Docker Compose
sudo curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
sudo chmod +x /usr/local/bin/docker-compose

# Verify
docker --version
docker compose version
```

## Step 3: Deploy Databases

**Question:** Do you want to deploy PostgreSQL, MySQL, MongoDB, and Redis? (yes/no)

If yes, create `/opt/cortexos/docker-compose.yml`:

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
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD}
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
      MYSQL_ROOT_PASSWORD: ${MYSQL_ROOT_PASSWORD}
      MYSQL_DATABASE: cortex
      MYSQL_USER: cortex
      MYSQL_PASSWORD: ${MYSQL_PASSWORD}
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
      MONGO_INITDB_ROOT_PASSWORD: ${MONGO_PASSWORD}
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

Deploy:
```bash
mkdir -p /opt/cortexos
cd /opt/cortexos
docker compose up -d
```

## Step 4: Deploy Monitoring Stack

**Question:** Do you want to deploy Prometheus, Grafana, Loki, and exporters? (yes/no)

If yes, add to your `docker-compose.yml`:

```yaml
  prometheus:
    image: prom/prometheus:latest
    container_name: cortex-prometheus
    restart: unless-stopped
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
    network_mode: host

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

## Step 5: Install 9Router (AI Gateway)

```bash
# Pull and start 9Router
docker run -d \
  --name 9router \
  --restart unless-stopped \
  -p 127.0.0.1:11434:11434 \
  -v 9router-data:/data \
  ghcr.io/openrouter/9router:latest

# Verify
curl -s http://127.0.0.1:11434/v1/models | jq '.data[].id'
```

## Step 6: Install Ollama

```bash
# Install
curl -fsSL https://ollama.com/install.sh | sh

# Enable and start
sudo systemctl enable ollama
sudo systemctl start ollama

# Pull useful models
ollama pull llama3.2
ollama pull nomic-embed-text
```

## Step 7: Install Caddy (Reverse Proxy)

```bash
# Install
sudo apt install -y caddy

# Configure (edit /etc/caddy/Caddyfile)
sudo nano /etc/caddy/Caddyfile
```

Example configuration:
```caddy
# Dashboard
:80 {
    reverse_proxy localhost:3000
}

# Grafana
grafana.yourdomain.com {
    reverse_proxy localhost:3001
}
```

```bash
sudo systemctl reload caddy
```

## Step 8: Install Tailscale

```bash
# Install
curl -fsSL https://tailscale.com/install.sh | sh

# Connect (you'll need to authenticate)
sudo tailscale up

# Get your tailnet IP
tailscale ip
```

## Step 9: Install Dashboard

**Question:** Do you want to install the CortexOS Dashboard? (yes/no)

If yes:

```bash
# Install Node.js
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo bash -
sudo apt install -y nodejs
npm install -g pnpm

# Clone repo (if not already)
git clone https://github.com/cortexos/cortexos.git /opt/cortexos
cd /opt/cortexos

# Build
pnpm install
pnpm run build

# Create systemd service
sudo nano /etc/systemd/system/cortex-dashboard.service
```

```ini
[Unit]
Description=CortexOS Dashboard
After=network.target

[Service]
Type=simple
User=cortexos
WorkingDirectory=/opt/cortexos/packages/dashboard
ExecStart=/usr/bin/node server.js
Environment=PORT=3000
Environment=HOSTNAME=0.0.0.0
Restart=always

[Install]
WantedBy=multi-user.target
```

```bash
sudo systemctl enable cortex-dashboard
sudo systemctl start cortex-dashboard
```

## Step 10: CLI Tools

**Question:** Do you want to install CLI AI tools? (yes/no)

### Claude Code
```bash
npm install -g @anthropic-ai/claude-code
```

### Qwen Code
```bash
# Follow instructions at https://qwen.ai
```

### Configure Qwen Code for 9Router
```bash
# Run the update skill
/qwen-code:update-9router
```

## Verification

Run this to verify everything is working:

```bash
echo "=== Docker Containers ==="
docker ps --format "table {{.Names}}\t{{.Status}}"

echo ""
echo "=== Systemd Services ==="
systemctl status caddy tailscaled ollama 2>/dev/null | grep -E "active|loaded"

echo ""
echo "=== Listening Ports ==="
ss -tlnp | grep -E ":(3000|5432|3306|6379|9090|3100|11434)"

echo ""
echo "=== AI Gateway ==="
curl -s http://127.0.0.1:11434/v1/models | jq '.data | length'
```

## Next Steps

1. Configure secrets in `/opt/cortexos/.secrets/`
2. Set up backups (see `docs/BACKUP.md`)
3. Review `docs/CONFIG.md` for dotfiles
4. Join Tailscale from other devices

## Troubleshooting

### Docker not starting
```bash
sudo systemctl enable docker
sudo systemctl start docker
sudo docker run hello-world
```

### Port already in use
```bash
sudo ss -tlnp | grep :PORT
sudo kill PROCESS_ID
```

### 9Router not responding
```bash
docker logs 9router
docker restart 9router
```

## Questions?

For help, see:
- `docs/INSTALL.md` - Detailed installation guide
- `docs/SERVICES.md` - Service documentation
- `docs/CONFIG.md` - CLI tool configuration
