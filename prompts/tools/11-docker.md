# Docker (latest)

## Purpose

Install Docker Engine and Docker Compose plugin from the official Docker apt repository; configure the daemon for CortexOS stack management.

## Prerequisites

- `10-os-hardening.md` completed.
- UFW active.

## CHECKPOINT 1

Operator: confirm the host is running Ubuntu 22.04 or 24.04 and no prior Docker installation exists (run `docker --version 2>/dev/null || echo "not installed"`). Type "confirmed" to proceed.

## Install

```bash
sudo apt-get update -y
sudo apt-get install -y ca-certificates curl gnupg lsb-release

sudo install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | \
  sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg
sudo chmod a+r /etc/apt/keyrings/docker.gpg

echo \
  "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] \
  https://download.docker.com/linux/ubuntu $(lsb_release -cs) stable" | \
  sudo tee /etc/apt/sources.list.d/docker.list > /dev/null

sudo apt-get update -y
sudo apt-get install -y docker-ce docker-ce-cli containerd.io \
  docker-buildx-plugin docker-compose-plugin
```

## Configure

```bash
# Add current user to docker group
sudo usermod -aG docker $USER

# Daemon configuration
sudo tee /etc/docker/daemon.json <<'EOF'
{
  "log-driver": "json-file",
  "log-opts": { "max-size": "50m", "max-file": "3" },
  "live-restore": true
}
EOF

sudo systemctl enable docker
sudo systemctl restart docker
```

Create stack root:

```bash
sudo mkdir -p /opt/cortexos/stacks
sudo chown $USER:$USER /opt/cortexos/stacks
```

## Verify

```bash
docker version
docker compose version
docker run --rm hello-world
```

Expected: both version commands succeed; `hello-world` prints "Hello from Docker!".

## CHECKPOINT 2

Operator: confirm `docker run --rm hello-world` succeeded and your user can run Docker without sudo (log out and back in if needed). Type "confirmed" to proceed.

## Next

→ `prompts/tools/12-tailscale.md`
