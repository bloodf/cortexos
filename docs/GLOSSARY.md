# Glossary - Technical Terms Explained

> **This guide explains technical terms in plain English.**

---

## A

### API (Application Programming Interface)
**Plain English:** How two computer programs talk to each other.

**Example:** When you click "Login" on a website, the website talks to the server via API.

---

### Agent
**Plain English:** An AI program that can take actions and complete tasks on its own.

**Example:** Hermes can browse the web, write code, and send messages.

---

## B

### Backup
**Plain English:** A copy of your data stored somewhere safe.

**Example:** Copying your database once a day to another location.

---

## C

### Caddy
**Plain English:** A web server that automatically handles HTTPS (the lock icon) and routes traffic.

**Example:** When you visit `yourdomain.com`, Caddy sends you to the Dashboard.

---

### Container
**Plain English:** A self-contained box that has everything a program needs to run.

**Example:** Docker containers are like shipping containers for software.

---

### Cron
**Plain English:** A scheduler that runs tasks automatically at specific times.

**Example:** "Run backup script every day at 3 AM."

---

## D

### Database
**Plain English:** Organized storage for data, like a very smart filing cabinet.

**Example:** Store user accounts, blog posts, or application data.

---

### Docker
**Plain English:** Software that runs programs in isolated containers.

**Example:** Instead of installing PostgreSQL directly, you run it in a Docker container.

---

## E

### Encryption
**Plain English:** Scrambling data so only authorized people can read it.

**Example:** HTTPS encrypts your passwords when you log in.

---

## G

### Git
**Plain English:** A system that tracks changes to code and helps multiple people collaborate.

**Example:** Like "Track Changes" in Word, but for code.

---

### Grafana
**Plain English:** A tool that shows data as pretty graphs and dashboards.

**Example:** See CPU usage over the past week as a colorful chart.

---

## H

### Hermes
**Plain English:** Your AI coding assistant that can browse the web, write code, and help with tasks.

**Example:** A tireless developer that works 24/7.

---

## I

### Incus
**Plain English:** A tool for running multiple isolated systems on one server.

**Example:** Like Docker, but for entire operating systems.

---

### IP Address
**Plain English:** A unique address for each computer on a network.

**Example:** `192.168.1.1` or `100.109.20.9`

---

## L

### Log
**Plain English:** A diary of events that happened on a system.

**Example:** "At 3:00 PM, user logged in. At 3:05 PM, database was queried."

---

## M

### Memory (RAM)
**Plain English:** Fast temporary storage for data the computer is actively using.

**Example:** Like a desk - quick to access, but clears when you leave.

---

### MongoDB
**Plain English:** A database that stores data as flexible documents (like JSON).

**Example:** Good for storing user profiles with varying fields.

---

### MySQL
**Plain English:** A popular database for web applications.

**Example:** Powers many WordPress sites and web apps.

---

## N

### Network
**Plain English:** Connected computers that can talk to each other.

**Example:** Your home WiFi is a network.

---

## O

### Ollama
**Plain English:** Software that runs AI models locally on your server.

**Example:** Run Llama or other open-source AI models without paying per request.

---

## P

### Port
**Plain English:** A numbered door on a computer where network traffic enters/exits.

**Example:** Port 80 is for HTTP, port 443 is for HTTPS.

---

### PostgreSQL
**Plain English:** A powerful open-source database good for complex data.

**Example:** Store financial data with complex relationships.

---

### Prometheus
**Plain English:** A tool that collects and stores metrics (numbers) over time.

**Example:** Collect CPU percentage every 10 seconds.

---

### Proxy
**Plain English:** A middleman that forwards requests between you and a service.

**Example:** Caddy proxies requests to the right service.

---

## R

### Redis
**Plain English:** A super-fast database for temporary data.

**Example:** Store user sessions for quick access.

---

### Repository (Repo)
**Plain English:** A folder that Git tracks, containing your code.

**Example:** `github.com/cortexos/cortexos` is a repository.

---

## S

### SSH
**Plain English:** Secure way to connect to another computer remotely.

**Example:** `ssh cortexos@server.com` connects you to the server.

---

### SSL/TLS
**Plain English:** Technology that encrypts web traffic (the lock icon 🔒).

**Example:** Makes passwords safe when you log in.

---

### System Service
**Plain English:** A program that runs in the background automatically.

**Example:** `caddy` service runs and handles web traffic 24/7.

---

## T

### Tailscale
**Plain English:** VPN service that creates a secure network between your devices.

**Example:** Access your server from anywhere like you're on the same network.

---

### Terminal
**Plain English:** Text-based interface to control your computer.

**Example:** Where you type commands like `ls`, `cd`, `docker ps`.

---

### tmux
**Plain English:** Terminal multiplexer - multiple terminal sessions in one window.

**Example:** Have 5 terminal windows without opening 5 terminal apps.

---

### Troubleshooting
**Plain English:** Finding and fixing problems.

**Example:** "My service won't start" → Troubleshooting.

---

## V

### VPN
**Plain English:** Virtual Private Network - a secure tunnel through the internet.

**Example:** Tailscale creates a VPN so you can securely access your server.

---

## Z

### ZFS
**Plain English:** An advanced filesystem with built-in snapshots and data protection.

**Example:** Like a super-powered hard drive with automatic backups.

---

## Quick Reference Table

| Term | What it Does | Where You'll See It |
|------|--------------|-------------------|
| Docker | Run services in containers | `docker ps` |
| Caddy | Web proxy + HTTPS | Your websites work |
| Hermes | AI coding assistant | Your AI helper |
| PostgreSQL | Database | Store data |
| Prometheus | Collect metrics | System monitoring |
| Grafana | Show graphs | Dashboards |
| Tailscale | VPN | Secure access |
| tmux | Terminal sessions | Keep sessions alive |

---

## Still Confused?

Ask your team lead, or start with [GETTING-STARTED.md](GETTING-STARTED.md).
