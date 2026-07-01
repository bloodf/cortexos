# The Architect — Your AI Installation Guide

## What is the Architect?

The Architect is not a program you download. It's a collection of step-by-step instructions (called **prompts**) that you copy into any AI assistant — Claude, ChatGPT, Gemini, or whatever you prefer.

The AI reads the prompt and tells you exactly what commands to type on your server.

Think of it like this: **it's like having an expert sysadmin looking over your shoulder, telling you what to type, one step at a time.**

You don't need to understand the commands. You just copy what the AI gives you, paste it into your server, and press Enter.

---

## How It Works

1. **You get a server** — rented from Hetzner, DigitalOcean, OVH, or any VPS provider.
2. **You connect to it** — via SSH (a secure way to remote-control your server).
3. **You clone the CortexOS repo** — this downloads all the prompts and configs.
4. **You open `prompts/tools/_order.md`** — this is your installation checklist.
5. **You copy each prompt** into your AI assistant.
6. **The AI tells you exactly what commands to run** on your server.
7. **You paste the commands and press Enter.**
8. **Repeat until done** — work through the checklist one item at a time.

That's it. No coding. No memorizing commands. Just copy, paste, and follow along.

---

## The Install Order

The file `prompts/tools/_order.md` lists every prompt in order. Here's what the journey looks like, simplified:

| Step | Prompt | What It Does |
|------|--------|--------------|
| 00 | `00-preflight` | Checks your server is ready (RAM, disk, OS version) |
| 09 | `09-tmux` | Installs a tool that keeps your sessions running even if you disconnect |
| 10 | `10-os-hardening` | Locks down security — firewall, automatic updates, fail2ban |
| 11 | `11-docker` | Installs Docker, the container engine that runs most CortexOS services |
| 13 | `13-caddy` | Sets up the web proxy that routes traffic to your apps |
| 14–25 | Databases & monitoring | PostgreSQL, Redis, MongoDB, MySQL, ClickHouse, MinIO, Grafana, etc. |
| 30+ | AI tools & dashboard | Langfuse, the CortexOS web dashboard, and more |

You don't have to install everything. Skip the tools you don't need.

---

## What Each Prompt Contains

Every prompt in `prompts/tools/` follows the same safe, clear structure:

- **A clear goal** — e.g., "Install PostgreSQL 16 with a dedicated database user"
- **Prerequisites to check first** — e.g., "Docker must be installed before running this prompt"
- **Step-by-step commands** — the exact commands to run, in order
- **Verification steps** — a command to run afterward to prove it worked
- **Abort gates** — clear warnings like: *"If this step fails, STOP and ask your AI for help before continuing"*

Everything is visible. Nothing is hidden. You can read the prompt yourself before running it.

---

## Before You Start

Make sure you have:

- **A server running Ubuntu 24.04** (older versions may work but aren't officially supported)
- **SSH access** — you can log in as `root` or a user with `sudo` privileges
- **An AI assistant** — Claude, ChatGPT, Gemini, or any LLM that can follow long instructions
- **(Optional) A domain name** — needed if you want HTTPS and a nice URL for your dashboard

> 💡 **Don't have a domain?** You can still install everything and access it by IP address. A domain just makes it prettier and enables automatic HTTPS certificates.

---

## Customizing Your Install

The Architect is flexible:

- **Skip tools you don't need** — Don't use MongoDB or MySQL? Skip `21-mongodb.md` and `22-mysql.md`.
- **Add your own prompts** — Write a new `.md` file in `prompts/tools/` and add it to `_order.md`.
- **Run only what you need** — If you only want the dashboard and PostgreSQL, just run those prompts.

The prompts are plain Markdown. You can edit them, fork them, or share them.

---

## Safety Features

The Architect is designed to be safe even for beginners:

- ✅ **Every prompt has verification steps** — you'll know immediately if something went wrong.
- 🛑 **Abort gates prevent partial installs** — if a critical step fails, the prompt tells you to stop and ask for help.
- 🔄 **You can re-run any prompt** — if something fails, fix the issue and run the prompt again. Most prompts are idempotent (safe to run multiple times).
- 👁️ **Nothing is hidden** — all commands are right there in the Markdown file. No black boxes, no obfuscated scripts.

> 🛡️ **You're in control.** The AI suggests. You decide whether to run it.
