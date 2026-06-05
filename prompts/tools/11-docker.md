# Docker (latest)

## Purpose

Install Docker Engine and Docker Compose plugin from the official Docker apt repository; configure the daemon for CortexOS stack management.

## Prerequisites

- `10-os-hardening.md` completed.
- Host firewall active (ufw on Ubuntu/Debian).

## Distro selection

```bash
source scripts/pkg.sh
echo "OS family: $(pkg_family) $(pkg_version)"
: "${CORTEX_OS_FAMILY:?run prompts/os/00-os-selection.md first}"
```

## Sudo gate

This spoke runs `sudo`. Authenticate **now** so the rest of the steps don't pause for a password mid-flow:

```bash
sudo -v
```

CortexOS never stores your password — only the kernel's sudo timestamp is used. Re-run if it expires.

## Todo

- [ ] CHECKPOINT 1 confirmed — supported family/version, no prior Docker install
- [ ] Add Docker apt keyring + repo and `pkg_install docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin`
- [ ] `sudo usermod -aG docker $USER`
- [ ] Write `/etc/docker/daemon.json` (json-file logging, live-restore)
- [ ] `sudo systemctl enable docker` + `sudo systemctl restart docker`
- [ ] Create `/opt/cortexos/stacks` owned by `$USER`
- [ ] Confirm `docker run --rm hello-world` prints `Hello from Docker!`
- [ ] CHECKPOINT 2 confirmed — hello-world succeeded as non-root user

## CHECKPOINT 1

**STOP — operator question:** Does `docker --version 2>/dev/null` print nothing (no prior Docker install) on a host whose `pkg_family` is one of `ubuntu` / `debian`?

Type `confirmed` to proceed.

## Install

```bash
pkg_install ca-certificates curl gnupg lsb-release

sudo install -m 0755 -d /etc/apt/keyrings
DOCKER_REPO_PATH="$(. /etc/os-release && echo "$ID")"
curl -fsSL "https://download.docker.com/linux/${DOCKER_REPO_PATH}/gpg" | \
  sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg
sudo chmod a+r /etc/apt/keyrings/docker.gpg

echo \
  "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] \
  https://download.docker.com/linux/${DOCKER_REPO_PATH} $(lsb_release -cs) stable" | \
  sudo tee /etc/apt/sources.list.d/docker.list > /dev/null
sudo apt-get update -y -qq

pkg_install docker-ce docker-ce-cli containerd.io \
  docker-buildx-plugin docker-compose-plugin
```

Verify package install:

```bash
dpkg -s docker-ce >/dev/null
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

**STOP — operator question:** Did `docker run --rm hello-world` (run as `$USER`, no `sudo`) print `Hello from Docker!` (not `permission denied while trying to connect to the Docker daemon socket`)?

Type `confirmed` to proceed.

## Next

→ `prompts/tools/13-caddy.md`
