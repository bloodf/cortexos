---
name: incus-project-create
description: Create a new Incus container instance for a project with AI agent setup, GitHub integration, Hermes profile, and Tailscale VPN.
source: auto-skill
extracted_at: '2026-06-01T02:35:00.000Z'
---

# incus-project-create

## What this skill does

Provisions a new Incus container, wires it into Tailscale, clones a
GitHub repo, and (optionally) stands up a Hermes AI agent profile
with Telegram bot integration.

## Usage

The canonical implementation lives in the bash script — invoke it
on the host, then read this doc for the parameter reference and the
7-step overview:

```bash
sudo bash scripts/incus-create-project.sh
```

The script is interactive; it will prompt for the same parameters
listed below.

## Parameters (read by the script via `read -p`)

- `PROJECT_NAME` — Name for the project/instance (e.g. `myproject`)
- `BASE_IMAGE` — Base image (default: `cortexos-base:latest`)
- `GITHUB_REPO` — GitHub repository (`owner/repo`, optional)
- `GITHUB_TOKEN` — GitHub personal access token (for private repos)
- `SETUP_HERMES` — Whether to setup Hermes (`yes` / `no`, default `yes`)
- `SETUP_TELEGRAM` — Whether to setup Telegram (`yes` / `no`, default `no`)
- `TELEGRAM_BOT_TOKEN` — Telegram bot token (if Telegram enabled)
- `TELEGRAM_CHAT_ID` — Telegram allowed chat ID (if Telegram enabled)

## 7-step overview (matches the script)

1. **Create Incus instance** — `incus launch` from the base image
   with `raw.lxc` for `/dev/net/tun` (Tailscale) and
   `security.nesting=true` (Docker-in-Incus).
2. **Configure SSH** — push the operator's `~/.ssh/id_ed25519` and
   `id_rsa` (whichever exists) into the instance, lock down to
   `cortexos` user.
3. **Install Tailscale** — official `tailscale.com/install.sh`,
   `systemctl enable --now tailscaled`, `tailscale up
   --accept-routes --hostname=<PROJECT_NAME>`.
4. **GitHub setup** — `ssh-keyscan github.com` into known_hosts,
   then `git clone git@github.com:<REPO>.git`. If the clone fails
   the script prints the instance's public key so the operator can
   add it to GitHub manually.
5. **Hermes setup** — write `/opt/cortexos/hermes/profiles/<NAME>/
   config.yaml` (openai-compatible model, honcho memory workspace), then
   install a `hermes-gateway-<NAME>.service` systemd unit. The
   per-profile port is 8932 and the public path is
   `/hermes/<NAME>/v1`.
6. **Telegram setup (optional)** — appends a `telegram:` block to
   the Hermes config with `allow_from` + `allow_admin_from` set to
   the operator's chat ID.
7. **Verify** — `incus list`, `tailscale status`, and
   `systemctl status hermes-gateway-<NAME>` are all printed so the
   operator can spot failures at a glance.

## Notes

- Instance must have internet access for Tailscale + GitHub.
- The SSH key pushed in step 2 must be added to the operator's
  GitHub account for step 4 to clone a private repo.
- The Hermes binary must be available at `/usr/local/bin/hermes`
  on the host before this script runs (install it via
  `prompts/tools/` first — see the install order in
  `prompts/tools/_order.md`).
- The configured OpenAI-compatible chat endpoint must be reachable from
  the instance (the host reverse-proxies via Tailscale + Caddy if needed).
- The script is the single source of truth for the procedure; this
  doc is intentionally a pointer. If the script and this doc ever
  disagree, the script wins — fix the doc.
