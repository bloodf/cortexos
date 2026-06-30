# CortexOS Documentation

> **Everything you need to understand, install, and use CortexOS.**

---

## 🆕 New Here? Start Here!

| If you... | Read this |
|-----------|-----------|
| **Want to understand what CortexOS is** | [`GETTING-STARTED.md`](GETTING-STARTED.md) — a friendly introduction |
| **Want to install CortexOS** | [`INSTALL-WITH-AI.md`](INSTALL-WITH-AI.md) — step-by-step with an AI assistant |
| **Prefer manual installation** | [`INSTALL.md`](INSTALL.md) — for experienced Linux users |
| **Want to see all tools** | [`TOOLS.md`](TOOLS.md) — complete catalog with links |

---

## 🤖 Using the AI Installer (The Architect)

CortexOS is installed through an AI assistant that reads prompts and tells you what commands to run.

| Topic | Doc |
|-------|-----|
| **What is the Architect?** | [`ARCHITECT.md`](ARCHITECT.md) — how the AI installer works |
| **Install step-by-step** | [`INSTALL-WITH-AI.md`](INSTALL-WITH-AI.md) — beginner guide |
| **Install order checklist** | [`../prompts/tools/_order.md`](../prompts/tools/_order.md) — the master list |

---

## 🔧 What You Get — Tool Catalog

Every tool installed by CortexOS, with descriptions and external links:

👉 [`TOOLS.md`](TOOLS.md) — The Complete Tool Catalog

Categories:
- **Core Infrastructure** — tmux, Docker, Caddy, OS hardening
- **Databases** — PostgreSQL, Redis, MongoDB, MySQL
- **Observability** — Prometheus, Grafana, Loki, Fluent Bit
- **AI & Agents** — 9Router, Hermes, Memory OS
- **Developer Tools** — fzf, BoxBox
- **Admin UIs** — pgAdmin, RedisInsight, Mongo Express, phpMyAdmin

---

## 📖 Reference Documentation

| Doc | What It's For |
|-----|---------------|
| [`GUIDE.md`](GUIDE.md) | Complete overview of CortexOS architecture and concepts |
| [`GLOSSARY.md`](GLOSSARY.md) | Technical terms explained simply |
| [`CONFIG.md`](CONFIG.md) | How to configure tools and dotfiles |
| [`SERVICES.md`](SERVICES.md) | Every service: ports, credentials, how to access |
| [`AI-SETUP.md`](AI-SETUP.md) | Configure AI models and API keys |
| [`SECRETS.md`](SECRETS.md) | How to encrypt and manage secrets |
| [`APPS.md`](APPS.md) | App catalog (alternative view of tools) |

---

## 🛠️ For Developers

| Doc | What It's For |
|-----|---------------|
| [`TMUX-GUIDE.md`](TMUX-GUIDE.md) | Terminal session management |
| [`DOCKER-GUIDE.md`](DOCKER-GUIDE.md) | Working with Docker containers |
| [`CLI-TOOLS.md`](CLI-TOOLS.md) | Scripts and command-line tools |
| [`../CONTRIBUTING.md`](../CONTRIBUTING.md) | How to contribute to CortexOS |
| [`../AGENTS.md`](../AGENTS.md) | Instructions for AI agents working on this repo |

---

## 🆘 Troubleshooting

| Problem | Solution |
|---------|----------|
| Something isn't working | [`TROUBLESHOOTING.md`](TROUBLESHOOTING.md) |
| Can't connect to server | Check [`TROUBLESHOOTING.md#connection-issues`](TROUBLESHOOTING.md) |
| Service won't start | Check [`TROUBLESHOOTING.md#service-issues`](TROUBLESHOOTING.md) |

---

## 📋 Quick Commands

```bash
# Check all services
docker ps
systemctl status caddy tailscaled

# Restart a service
sudo systemctl restart cortex-dashboard

# View logs
journalctl -u cortex-dashboard -n 50

# Check disk and memory
df -h && free -h
```

---

## 🔗 External Resources

- **GitHub Repository:** https://github.com/bloodf/cortexos
- **Issues & Bug Reports:** https://github.com/bloodf/cortexos/issues
- **Security:** See [`../SECURITY.md`](../SECURITY.md)
- **License:** See [`../LICENSE`](../LICENSE)

---

> **Ready to start?** → [`GETTING-STARTED.md`](GETTING-STARTED.md)
