# CortexOS Complete Guide

> **Everything you need to know about CortexOS, explained simply.**

---

## What is CortexOS? (Simple Explanation)

Imagine you have a **super powerful computer** in the cloud that:
- Can run AI models locally (not depending on OpenAI/Google)
- Has databases (like a file cabinet for data)
- Can run multiple services at once
- Has a web dashboard to control everything
- Can be accessed securely from anywhere

That's CortexOS!

---

## The Parts of CortexOS

### 1. The Server (Host)
Your server is the main computer running everything. It's like the "brain" of the operation.

**What it runs:**
- Ubuntu Linux (operating system)
- Docker (runs services in containers)
- System services (always-on background programs)

### 2. Databases (Data Storage)
Databases are organized storage for your data.

| Database | Best For | Simple Analogy |
|----------|----------|---------------|
| **PostgreSQL** | Structured data, complex queries | Filing cabinet with folders |
| **MySQL** | Web applications | Spreadsheet with formulas |
| **MongoDB** | Flexible/document storage | Free-form notebook |
| **Redis** | Fast cache, real-time data | Sticky notes |

### 3. AI Services
Instead of paying per API call, you run AI models locally.

| Service | What it does |
|---------|--------------|
| **9Router** | Gateway that routes AI requests to the best model |
| **Ollama** | Runs open-source AI models locally |
| **Hermes** | AI agent that can help with tasks |

### 4. Monitoring
Keeps an eye on system health.

| Service | What it monitors |
|---------|-----------------|
| **Prometheus** | Collects metrics (CPU, memory, disk) |
| **Grafana** | Shows dashboards and graphs |
| **Loki** | Stores and queries logs |
| **cAdvisor** | Container resource usage |

### 5. Reverse Proxy (Caddy)
Caddy automatically handles:
- SSL/TLS certificates (the lock icon 🔒)
- Routing requests to the right service
- Security

### 6. VPN (Tailscale)
Tailscale creates a **private network** so you can securely access your server from anywhere, even behind firewalls.

---

## How Services Communicate

```
┌─────────────────────────────────────────────────────────────┐
│                    YOU (Your Computer)                       │
└───────────────────────────┬─────────────────────────────────┘
                            │ SSH / Browser
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                    CORTEXOS SERVER                          │
│                                                             │
│  ┌─────────┐    ┌──────────────┐    ┌────────────────┐  │
│  │  Caddy  │───►│  Dashboard   │    │   Databases    │  │
│  │(Proxy)  │    │ (Next.js)    │    │ (Postgres,etc)│  │
│  └─────────┘    └──────────────┘    └────────────────┘  │
│                       │                                      │
│                       ▼                                      │
│              ┌─────────────────┐                            │
│              │    9Router      │                            │
│              │  (AI Gateway)   │                           │
│              └────────┬────────┘                            │
│                       │                                      │
│         ┌─────────────┼─────────────┐                      │
│         ▼             ▼             ▼                        │
│   ┌─────────┐  ┌──────────┐  ┌──────────┐               │
│   │ Claude  │  │   GPT    │  │  Gemini  │               │
│   │(remote) │  │(remote)  │  │(remote)  │               │
│   └─────────┘  └──────────┘  └──────────┘               │
└─────────────────────────────────────────────────────────────┘
```

---

## Accessing Services

### Web Services (use browser)

| Service | URL | Description |
|---------|-----|-------------|
| Dashboard | `https://cortexos.tailfd052e.ts.net` | Main control panel |
| Grafana | `https://cortexos.tailfd052e.ts.net:3001` | Monitoring dashboards |
| PHPMyAdmin | `https://cortexos.tailfd052e.ts.net:8082` | MySQL database editor |

### Terminal Access (use SSH)

```bash
ssh cortexos@cortexos.tailfd052e.ts.net
```

---

## Service Ports Reference

| Port | Service | Access |
|------|---------|--------|
| 80 | Caddy HTTP | Public |
| 443 | Caddy HTTPS | Public |
| 3000 | Dashboard/Grafana | Via Caddy |
| 5432 | PostgreSQL | Local only |
| 3306 | MySQL | Local only |
| 6379 | Redis | Local only |
| 9090 | Prometheus | Local only |
| 11434 | 9Router | Local + Docker |

---

## Common Tasks (Step by Step)

### 1. Check if a Service is Running

```bash
# Check Docker containers
docker ps

# Check systemd services
systemctl status service-name

# Example: Check if dashboard is running
systemctl status cortex-dashboard
```

### 2. Restart a Service

```bash
# Docker container
docker restart cortex-postgres

# Systemd service
sudo systemctl restart cortex-dashboard
```

### 3. View Logs

```bash
# Recent logs (last 50 lines)
journalctl -u cortex-dashboard -n 50

# Follow logs in real-time
journalctl -u cortex-dashboard -f
```

### 4. Access Database

```bash
# PostgreSQL
psql -h localhost -U cortex -d cortex

# MySQL
mysql -h localhost -u cortex -p cortex
```

---

## Security Model

### Who can access what?

| Access Level | What they can do |
|-------------|------------------|
| **Public** | See login page, health checks |
| **Authenticated** | Use dashboard features |
| **Admin** | Manage users, services, secrets |
| **Local Only** | Database access, service management |

### Important Security Rules:

1. **Never expose databases to public internet**
2. **Use Tailscale** for secure remote access
3. **Secrets stay encrypted** in SOPS files
4. **Audit everything** - all actions are logged

---

## Troubleshooting Basics

### Something isn't working?

**Step 1: Check if it's running**
```bash
docker ps | grep service-name
systemctl status service-name
```

**Step 2: Check logs**
```bash
journalctl -u service-name -n 50
docker logs container-name
```

**Step 3: Restart it**
```bash
sudo systemctl restart service-name
docker restart container-name
```

**Step 4: Check resources**
```bash
htop              # See CPU/memory usage
df -h             # Check disk space
```

---

## Learning Path

### Week 1: Basics
- [ ] Connect to server via SSH
- [ ] Use tmux for sessions
- [ ] Navigate files and folders
- [ ] Check running services

### Week 2: Services
- [ ] Access dashboard
- [ ] Check Grafana dashboards
- [ ] Understand what each service does

### Week 3: Development
- [ ] Set up development environment
- [ ] Clone and work with repositories
- [ ] Use AI tools (Claude Code, Qwen Code)

### Week 4: Operations
- [ ] Monitor services
- [ ] Read and understand logs
- [ ] Basic troubleshooting
- [ ] Backup procedures

---

## Glossary

| Term | Definition |
|------|------------|
| **SSH** | Secure Shell - encrypted way to connect to remote servers |
| **Docker** | Platform to run applications in isolated containers |
| **Container** | Lightweight, isolated environment for running services |
| **Systemd** | Linux service manager that keeps services running |
| **Port** | Number that identifies a specific service on a computer |
| **Proxy** | Server that forwards requests to other servers |
| **SSL/TLS** | Encryption for secure web connections |
| **API** | Application Programming Interface - how programs talk to each other |
| **Agent** | AI program that can take actions and complete tasks |

---

## Get Help

| Need help with... | Where to look |
|-------------------|---------------|
| Setup/Installation | [INSTALL.md](INSTALL.md) |
| Configuration | [CONFIG.md](CONFIG.md) |
| Services | [SERVICES.md](SERVICES.md) |
| tmux | [TMUX-GUIDE.md](TMUX-GUIDE.md) |
| Specific service | Ask your team lead |
