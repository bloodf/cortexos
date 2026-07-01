# Installing CortexOS - Operator Guide

> **Manual installation for experienced Linux users.**
>
> 🆕 **First time installing?** The [beginner guide](INSTALL-WITH-AI.md) is easier — it uses an AI assistant to walk you through every step.

---

## Prerequisites

### What You Need

| Item | Requirement |
|------|------------|
| Server | Ubuntu 24.04 LTS (or newer) |
| Resources | 4GB RAM, 50GB disk |
| Access | SSH with sudo privileges |
| Domain | (Optional) Domain name for HTTPS |

### Before You Start

1. ✅ SSH key copied to server
2. ✅ Domain pointing to server IP (if using HTTPS)
3. ✅ 30-60 minutes of time
4. ✅ Read [`ARCHITECT.md`](ARCHITECT.md) to understand the install system

---

## Prerequisites

### What You Need

| Item | Requirement |
|------|------------|
| Server | Ubuntu 24.04 LTS (or newer) |
| Resources | 4GB RAM, 50GB disk |
| Access | SSH with sudo privileges |
| Domain | (Optional) Domain name for HTTPS |

### Before You Start

1. ✅ SSH key copied to server
2. ✅ Domain pointing to server IP (if using HTTPS)
3. ✅ 30-60 minutes of time

---

## Step 1: Connect to Your Server

```bash
ssh cortexos@your-server-ip
```

If you don't have a user yet:

```bash
# Create user
sudo adduser cortexos
sudo usermod -aG sudo cortexos

# Copy your SSH key
ssh-copy-id cortexos@your-server-ip
```

---

## Step 2: Update System

```bash
sudo apt update && sudo apt upgrade -y
```

---

## Step 3: Install Core Dependencies

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
    openssl \
    build-essential
```

---

## Step 4: Install Docker

Docker runs all the services (databases, monitoring, etc.).

### Option A: Quick Install (Recommended)

```bash
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker $USER
```

### Option B: Manual Install

```bash
# Add Docker repo
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg

echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu $(lsb_release -cs) stable" | sudo tee /etc/apt/sources.list.d/docker.list

sudo apt update
sudo apt install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
```

### Verify Docker

```bash
docker --version
docker compose version
docker run hello-world
```

---

## Step 5: Install Docker Compose Stack

### Create project directory

```bash
sudo mkdir -p /opt/cortexos
sudo chown $USER:$USER /opt/cortexos
cd /opt/cortexos
```

### Create docker-compose.yml

```bash
nano docker-compose.yml
```

Paste this configuration:

```yaml
version: '3.8'

services:
  # =========================================
  # DATABASES
  # =========================================
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

  # =========================================
  # MONITORING
  # =========================================
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

  # =========================================
  # EXPORTERS
  # =========================================
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

  # =========================================
  # ADMIN TOOLS
  # =========================================
  phpmyadmin:
    image: phpmyadmin:latest
    container_name: cortex-phpmyadmin
    restart: unless-stopped
    environment:
      PMA_HOST: mysql
      PMA_USER: cortex
      PMA_PASSWORD: ${MYSQL_PASSWORD}
    ports:
      - "127.0.0.1:8082:80"

  mongo-express:
    image: mongo-express:latest
    container_name: cortex-mongo-express
    restart: unless-stopped
    environment:
      ME_CONFIG_MONGODB_SERVER: mongodb
      ME_CONFIG_MONGODB_ADMIN: true
    ports:
      - "127.0.0.1:8083:8081"

volumes:
  postgres_data:
  mysql_data:
  mongodb_data:
  redis_data:
  prometheus_data:
  grafana_data:
  loki_data:
```

### Create environment file

```bash
nano .env
```

Add your passwords:

```env
POSTGRES_PASSWORD=your-secure-postgres-password
MYSQL_ROOT_PASSWORD=your-secure-mysql-root-password
MYSQL_PASSWORD=your-secure-mysql-password
MONGO_PASSWORD=your-secure-mongo-password
GRAFANA_PASSWORD=your-secure-grafana-password
```

### Start the stack

```bash
docker compose up -d
```

### Verify databases

```bash
docker ps  # Should show all containers running
```

---

## Step 6: Install Ollama (Local AI)

Ollama runs open-source AI models locally.

```bash
curl -fsSL https://ollama.com/install.sh | sh
```

### Enable service

```bash
sudo systemctl enable ollama
sudo systemctl start ollama
```

### Pull models (optional)

```bash
ollama pull llama3.2
ollama pull nomic-embed-text
```

---

## Step 7: Install Caddy (Reverse Proxy)

Caddy handles HTTPS automatically.

```bash
sudo apt install -y caddy
```

### Configure

```bash
sudo nano /etc/caddy/Caddyfile
```

Example configuration:

```caddy
# Main domain - Dashboard
yourdomain.com {
    reverse_proxy localhost:3000
}

# Monitoring - Grafana
grafana.yourdomain.com {
    reverse_proxy localhost:3001
}

# Database Admin
phpmyadmin.yourdomain.com {
    reverse_proxy localhost:8082
}
```

```bash
sudo systemctl reload caddy
```

---

## Step 8: Install Tailscale (VPN)

Tailscale creates a secure network between your devices.

```bash
curl -fsSL https://tailscale.com/install.sh | sh
```

### Connect

```bash
sudo tailscale up
```

You'll get a URL to authenticate. After connecting:

```bash
tailscale status  # Shows your tailnet IP
```

---

## Step 9: Install Node.js (for Dashboard)

```bash
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo bash -
sudo apt install -y nodejs
npm install -g pnpm
```

---

## Step 10: Configure Your Tools

See [CONFIG.md](CONFIG.md) for:
- Shell setup (zsh, tmux)
- AI CLI tools (Claude Code, Qwen Code)
- SSH and Git configuration

---

## Step 11: Verify Everything

Run this to check all services:

```bash
#!/bin/bash
echo "=== Docker Containers ==="
docker ps --format "table {{.Names}}\t{{.Status}}"

echo ""
echo "=== System Services ==="
systemctl is-active caddy tailscaled ollama

echo ""
echo "=== AI Gateway ==="
curl -s http://127.0.0.1:11434/v1/models | jq '.data | length' | xargs -I{} echo "Models available: {}"

echo ""
echo "=== Database Connections ==="
docker exec cortex-postgres pg_isready && echo "PostgreSQL: OK"
docker exec cortex-mysql mysqladmin ping -h localhost && echo "MySQL: OK"
docker exec cortex-mongodb mongosh --eval "db.adminCommand('ping')" && echo "MongoDB: OK"
docker exec cortex-redis redis-cli ping && echo "Redis: OK"
```

---

## Troubleshooting

### Docker won't start

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

See [TROUBLESHOOTING.md](TROUBLESHOOTING.md) for more solutions.

---

## Next Steps

1. 📖 Read [GUIDE.md](GUIDE.md) - Understand what you built
2. 🔧 Set up your tools in [CONFIG.md](CONFIG.md)
3. 📊 Access monitoring dashboards
