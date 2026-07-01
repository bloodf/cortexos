# CortexOS Guide - Understanding Your AI Infrastructure

> **This guide explains what CortexOS is, how it works, and what everything does.**

---

## What is CortexOS? (Simple Explanation)

Think of CortexOS like a **powerful computer in the cloud** that:

- 🤖 Runs AI models and agents for you
- 💾 Stores data in databases
- 🌐 Serves web applications
- 📊 Monitors everything
- 🔒 Keeps everything secure

Instead of paying for multiple services, you run everything on your own server.

---

## The Main Parts

### 1. 🖥️ The Server (Host)

Your server is the main computer running everything. It's always on and connected to the internet.

```
┌─────────────────────────────────────┐
│           YOUR SERVER               │
│                                     │
│  ┌──────────┐  ┌──────────┐        │
│  │  Docker  │  │  System  │        │
│  │ Services │  │ Services │        │
│  └──────────┘  └──────────┘        │
│                                     │
│  ┌─────────────────────────────┐   │
│  │      AI Services            │   │
│  │   (Ollama)                  │   │
│  └─────────────────────────────┘   │
│                                     │
│  ┌─────────────────────────────┐   │
│  │      Databases              │   │
│  │  (Postgres, MySQL, etc)     │   │
│  └─────────────────────────────┘   │
└─────────────────────────────────────┘
```

### 2. 🐳 Docker (Services in Boxes)

Docker is like **shipping containers** for software. Each service runs in its own isolated "box" so they don't interfere with each other.

**Benefits:**
- Easy to start/stop
- Won't break other services
- Can have different versions of software
- Easy to update

### 3. 💾 Databases

Databases are organized storage for your data.

| Database | Best For | Simple Analogy |
|----------|----------|---------------|
| **PostgreSQL** | Complex queries, structured data | Filing cabinet with folders |
| **MySQL** | Web applications, websites | Spreadsheet |
| **MongoDB** | Flexible/document storage | Free-form notebook |
| **Redis** | Fast cache, real-time data | Sticky notes |

### 4. 🤖 AI Services

Instead of paying per API call, you can run AI models locally with Ollama.

### 5. 🤖 Hermes (AI Agent)

Hermes is like having a **coding assistant** that:
- Can browse the web
- Can read and write code
- Can use your tools
- Remembers conversations
- Works 24/7

### 6. 📊 Monitoring

Monitoring keeps watch over everything.

| Tool | What it Does |
|------|--------------|
| **Prometheus** | Collects numbers (CPU, memory, disk) |
| **Grafana** | Shows pretty graphs and dashboards |
| **Loki** | Stores logs (like a diary of events) |
| **cAdvisor** | Watches Docker containers |

### 7. 🌐 Caddy (Web Traffic Cop)

Caddy does automatically:
- 🔒 Handles HTTPS (the lock icon)
- 📍 Routes requests to the right service
- ⚡ Caches for speed
- 🛡️ Basic security

### 8. 🔒 Tailscale (Private Network)

Tailscale creates a **secure tunnel** between your devices so you can access your server from anywhere safely.

---

## How It All Works Together

### When You Visit a Web Page

```
1. You type "yourdomain.com" in browser
          │
          ▼
2. DNS points to your server's IP
          │
          ▼
3. Caddy receives the request
          │
          ▼
4. Caddy routes to Dashboard (TanStack Start)
          │
          ▼
5. Dashboard might query PostgreSQL
          │
          ▼
6. You see the result in your browser
```

### When Hermes Does a Task

```
1. Hermes receives a task (e.g., "write code")
          │
          ▼
2. Checks memory (Honcho) for context
          │
          ▼
3. Asks the configured AI provider for assistance
          │
          ▼
4. Gets response and executes code
          │
          ▼
5. Saves results to database
          │
          ▼
6. Updates memory (Honcho)
          │
          ▼
7. Reports back to you
```

---

## Common Terms Explained

| Term | Plain English |
|------|---------------|
| **SSH** | Encrypted way to talk to your server remotely |
| **Terminal** | Text-based way to run commands |
| **tmux** | Multiple terminal windows in one |
| **Docker** | Software in isolated boxes |
| **Container** | One of those isolated boxes |
| **Port** | Door number for a service |
| **Proxy** | Traffic director |
| **VPN** | Private tunnel through the internet |
| **API** | How programs talk to each other |

---

## Who Can Access What?

| Access Level | What They Can Do |
|-------------|------------------|
| **Public** | Visit login page, health checks |
| **Logged In** | Use dashboard features |
| **Admin** | Manage users, services, settings |
| **Local Only** | Access databases, terminal |

---

## Quick Reference: Services & Ports

| Service | Port | Who Can Access |
|---------|------|----------------|
| Dashboard | 3000 | Via Caddy |
| Grafana | 3001 | Via Caddy |
| PostgreSQL | 5432 | Local only |
| MySQL | 3306 | Local only |
| Redis | 6379 | Local only |
| Prometheus | 9090 | Local only |

---

## Want to Learn More?

| Topic | Read This |
|-------|-----------|
| How to use tmux | [TMUX-GUIDE.md](TMUX-GUIDE.md) |
| Setting up new tools | [CONFIG.md](CONFIG.md) |
| Installing on new server | [INSTALL.md](INSTALL.md) |
| Troubleshooting problems | [TROUBLESHOOTING.md](TROUBLESHOOTING.md) |
| All services explained | [SERVICES.md](SERVICES.md) |

---

## Architecture Diagram

```
                         INTERNET
                             │
                             ▼
┌─────────────────────────────────────────────────────────────┐
│                         CADDY                                │
│                    (Reverse Proxy)                           │
│         Routes traffic, handles HTTPS, security              │
└──────────────────────────┬──────────────────────────────────┘
                           │
         ┌─────────────────┼─────────────────┐
         │                 │                 │
         ▼                 ▼                 ▼
┌─────────────────┐ ┌──────────────┐ ┌─────────────────┐
│   DASHBOARD     │ │  DATABASE    │ │    AI STACK     │
│ (TanStack Start)│ │   ADMIN      │ │   (Ollama)      │
│                 │ │   TOOLS      │ │                 │
│                 │ │              │ │                 │
│                 │ │  PHPMyAdmin  │ │                 │
│                 │ │ MongoExpress │ │                 │
└─────────────────┘ └──────────────┘ └─────────────────┘

                         ┌─────────────────────────────────────┐
                         │          DATABASES                  │
                         │                                     │
                         │  ┌──────────┐  ┌──────────┐        │
                         │  │PostgreSQL│  │  MySQL   │        │
                         │  └──────────┘  └──────────┘        │
                         │  ┌──────────┐  ┌──────────┐        │
                         │  │ MongoDB  │  │  Redis   │        │
                         │  └──────────┘  └──────────┘        │
                         └─────────────────────────────────────┘

                         ┌─────────────────────────────────────┐
                         │         MONITORING                  │
                         │                                     │
                         │  ┌──────────┐  ┌──────────┐        │
                         │  │Prometheus│  │ Grafana  │        │
                         │  └──────────┘  └──────────┘        │
                         │  ┌──────────┐  ┌──────────┐        │
                         │  │   Loki   │  │ cAdvisor │        │
                         │  └──────────┘  └──────────┘        │
                         └─────────────────────────────────────┘
```
