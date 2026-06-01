# Troubleshooting Guide

> **Having issues?** Start here to find solutions.

---

## Quick Diagnostic Checklist

Before diving into specific problems, run this:

```bash
# 1. Are containers running?
docker ps

# 2. Are systemd services running?
systemctl list-units --type=service --state=running | grep cortex

# 3. Are ports listening?
ss -tlnp | grep -E ":(3000|5432|3306|6379|9090|11434)"

# 4. Check system resources
df -h           # Disk space
free -h          # Memory
htop             # CPU usage (q to quit)
```

---

## Docker Issues

### "docker: command not found"

```bash
# Check if Docker is installed
which docker
docker --version

# If not installed:
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker $USER
# Log out and back in for group change to take effect
```

### "Permission denied while trying to connect to the Docker daemon"

```bash
# Add yourself to docker group
sudo usermod -aG docker $USER

# Or use sudo
sudo docker ps
```

### Container won't start

```bash
# See why it failed
docker logs container-name

# Check if port is already in use
ss -tlnp | grep PORT

# Restart container
docker restart container-name
```

### "Port already in use"

```bash
# Find what's using the port
sudo lsof -i :PORT

# Kill it (if safe)
sudo kill PROCESS_ID

# Or use a different port
```

---

## System Services Issues

### Service won't start

```bash
# See why it failed
systemctl status service-name
journalctl -u service-name -n 50

# Common issues:
# - Missing environment file
# - Port already in use
# - Permission denied
```

### "Unit not found"

```bash
# Reload systemd
sudo systemctl daemon-reload

# Try again
sudo systemctl start service-name
```

### Service keeps restarting (flapping)

```bash
# Check why it's failing
journalctl -u service-name -n 100 --no-pager

# Common causes:
# - Configuration error
# - Dependency not running
# - Out of memory
```

---

## Network Issues

### Can't connect to server

```bash
# From your local machine:
ping cortexos.tailfd052e.ts.net

# Check SSH
ssh -v cortexos@cortexos.tailfd052e.ts.net
```

### Tailscale not connecting

```bash
# Check Tailscale status
tailscale status

# Reconnect
sudo tailscale up

# Check logs
journalctl -u tailscaled -n 50
```

### Port not responding

```bash
# Check if port is listening
ss -tlnp | grep PORT

# Check firewall
sudo ufw status

# Test locally
curl -v http://localhost:PORT
```

---

## Database Issues

### Can't connect to PostgreSQL

```bash
# Check if running
docker ps | grep postgres

# Check logs
docker logs cortex-postgres

# Connect manually
psql -h localhost -U cortex -d cortex
```

### Can't connect to MySQL

```bash
# Check if running
docker ps | grep mysql

# Check logs
docker logs cortex-mysql

# Connect manually
mysql -h localhost -u cortex -p cortex
```

### Database is slow

```bash
# Check connection count
docker exec cortex-postgres psql -U cortex -c "SELECT count(*) FROM pg_stat_activity;"

# Check running queries
docker exec cortex-postgres psql -U cortex -c "SELECT pid, now() - query_start AS duration, query FROM pg_stat_activity WHERE state != 'idle' ORDER BY duration DESC;"
```

---

## AI / 9Router Issues

### 9Router not responding

```bash
# Check if container is running
docker ps | grep 9router

# Check logs
docker logs 9router

# Test API
curl -s http://127.0.0.1:11434/v1/models | jq '.data | length'
```

### Model not available

```bash
# List available models
curl -s http://127.0.0.1:11434/v1/models | jq '.data[].id'

# Check 9Router configuration
cat /opt/cortexos/.secrets/9router.env
```

### Ollama not responding

```bash
# Check if running
systemctl status ollama

# Check logs
journalctl -u ollama -n 50

# Test API
curl http://localhost:11434/api/tags
```

---

## Disk / Memory Issues

### "No space left on device"

```bash
# Check disk usage
df -h

# Find large directories
du -sh /* 2>/dev/null | sort -rh | head -10

# Common culprits:
# - Docker logs
# - Old backups
# - Package caches
```

### Out of memory

```bash
# Check memory
free -h

# Check what's using memory
ps aux --sort=-%mem | head -10

# Docker memory
docker stats --no-stream
```

---

## SSH Issues

### "Connection refused"

```bash
# Check if SSH is running
systemctl status sshd

# Check firewall
sudo ufw status
```

### "Connection timed out"

```bash
# Check if server is reachable
ping SERVER_IP

# Check Tailscale
tailscale status
```

### "Permission denied (publickey)"

```bash
# Check SSH key is added
ssh-add -l

# Add key if missing
ssh-add ~/.ssh/id_ed25519

# Or use password temporarily
ssh -o PreferredAuthentications=password cortexos@SERVER
```

---

## Recovery Procedures

### Full restart of all services

```bash
# Docker services
docker compose -f /opt/cortexos/docker-compose.yml restart

# Or individually
docker restart $(docker ps -q)

# System services
sudo systemctl restart caddy tailscaled
```

### Factory reset (DANGER!)

```bash
# Stop everything
docker compose -f /opt/cortexos/docker-compose.yml down

# Remove volumes (DELetes all data!)
docker compose -f /opt/cortexos/docker-compose.yml down -v

# Remove containers and rebuild
docker compose -f /opt/cortexos/docker-compose.yml up -d
```

---

## Getting More Help

### Save diagnostic info

```bash
# Create a diagnostic bundle
mkdir ~/diagnostics
date > ~/diagnostics/date.txt
docker ps > ~/diagnostics/docker-ps.txt
systemctl status 'cortex-*' > ~/diagnostics/services.txt
journalctl -n 100 > ~/diagnostics/journal.txt
ss -tlnp > ~/diagnostics/ports.txt
tar -czf ~/diagnostics.tar.gz ~/diagnostics/
```

### Common Solutions

| Problem | Quick Fix |
|---------|-----------|
| Service down | `sudo systemctl restart service-name` |
| Container stuck | `docker restart container-name` |
| Can't SSH | `sudo systemctl restart sshd` |
| Port conflict | Find and kill conflicting process |
| Out of disk | `docker system prune -a` |
| Out of memory | Restart heavy services |

---

## Emergency Contacts

| Issue | Who to contact |
|-------|----------------|
| Server completely down | @heitor |
| Database corruption | @heitor |
| Security incident | @heitor (urgent) |
| Access issues | @heitor |
