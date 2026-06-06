# CortexOS

> **Your own AI infrastructure, on your own server.**

CortexOS is a complete, self-hosted platform that gives you AI models, databases, monitoring, and a web dashboard — all running on a single Ubuntu server you control.

---

## 🎯 What You Get

| Feature | What It Means For You |
|---------|----------------------|
| 🤖 **AI Gateway** | Access Claude, GPT, Gemini, and local models through one simple API |
| 🧠 **AI Memory** | Your AI remembers conversations and builds knowledge over time |
| 💾 **Databases** | PostgreSQL, Redis, MongoDB, MySQL — ready to use |
| 📊 **Monitoring** | See CPU, memory, disk, and logs in beautiful dashboards |
| 🌐 **Web Dashboard** | Control everything from your browser |
| 🔒 **Secure VPN** | Access your server safely from anywhere |
| 🏗️ **Developer Tools** | Code sandbox, file manager, terminal — all built in |

---

## 🚀 Quick Start

### The Easy Way (Recommended)

1. **Rent a server** — Ubuntu 24.04, 4GB RAM, 50GB disk (from Hetzner, DigitalOcean, etc.)
2. **Connect via SSH** — `ssh root@your-server-ip`
3. **Clone this repo**:
   ```bash
   cd /opt && git clone https://github.com/bloodf/cortexos.git && cd cortexos
   ```
4. **Follow the AI installer** — copy prompts from `prompts/tools/_order.md` into Claude, ChatGPT, or any AI assistant

📖 [**Beginner's Install Guide →**](docs/INSTALL-WITH-AI.md)

### The Manual Way

Already comfortable with Linux? See the operator install guide:

📖 [**Manual Install Guide →**](docs/INSTALL.md)

---

## 📚 Documentation

| I want to... | Go here |
|-------------|---------|
| **Understand what CortexOS is** | [`docs/GUIDE.md`](docs/GUIDE.md) |
| **Install for the first time** | [`docs/INSTALL-WITH-AI.md`](docs/INSTALL-WITH-AI.md) |
| **See all tools included** | [`docs/TOOLS.md`](docs/TOOLS.md) |
| **Learn how the AI installer works** | [`docs/ARCHITECT.md`](docs/ARCHITECT.md) |
| **Set up AI models** | [`docs/AI-SETUP.md`](docs/AI-SETUP.md) |
| **Configure secrets** | [`docs/SECRETS.md`](docs/SECRETS.md) |
| **Fix a problem** | [`docs/TROUBLESHOOTING.md`](docs/TROUBLESHOOTING.md) |
| **Browse all docs** | [`docs/README.md`](docs/README.md) |

---

## 🏗️ Architecture

```
┌─────────────────────────────────────────┐
│           YOUR SERVER                    │
│                                          │
│  ┌──────────────┐  ┌──────────────┐    │
│  │   Caddy      │  │  Dashboard   │    │
│  │  (Web Proxy) │  │  (Control)   │    │
│  └──────┬───────┘  └──────────────┘    │
│         │                                │
│  ┌──────┴───────────────────────┐       │
│  │      Docker Services         │       │
│  │  ┌─────┐ ┌─────┐ ┌─────┐   │       │
│  │  │ Postgres │ Redis │ Mongo │   │       │
│  │  └─────┘ └─────┘ └─────┘   │       │
│  │  ┌─────┐ ┌─────┐ ┌─────┐   │       │
│  │  │Prometheus│ Grafana │ Loki │   │       │
│  │  └─────┘ └─────┘ └─────┘   │       │
│  └──────────────────────────────┘       │
│                                          │
│  ┌──────────────────────────────┐       │
│  │      AI Stack                │       │
│  │  9Router → Models → Memory   │       │
│  └──────────────────────────────┘       │
└─────────────────────────────────────────┘
```

---

## 🛠️ For Developers

- **Contributing:** See [`CONTRIBUTING.md`](CONTRIBUTING.md)
- **Agent Instructions:** See [`AGENTS.md`](AGENTS.md) (for AI agents working on this repo)
- **Local Development:** `pnpm install && pnpm dev` in `packages/dashboard/`

---

## 🔐 Security

- Secrets are encrypted with [SOPS](https://github.com/getsops/sops) + age — never commit plaintext
- All web traffic goes through [Tailscale](https://tailscale.com) VPN
- Untrusted code runs in a [gVisor](https://gvisor.dev) sandbox
- See [`docs/SECRETS.md`](docs/SECRETS.md) and [`SECURITY.md`](SECURITY.md)

---

## 📝 License

See [`LICENSE`](LICENSE)

---

## 💬 Community

- **Issues:** [GitHub Issues](https://github.com/bloodf/cortexos/issues)
- **Discussions:** [GitHub Discussions](https://github.com/bloodf/cortexos/discussions)

---

> **Ready to build your own AI infrastructure?** Start with the [beginner's install guide](docs/INSTALL-WITH-AI.md).
