# CortexOS — Pre-install Requirements

These items MUST be installed and configured on the target VPS **before**
you start the install process (`SETUP.md` or `prompts/00-bootstrap.md`).
The install agent assumes everything below is present and working. It
will NOT install or auth them for you.

---

## 1. Operating system

Supported host distros (Debian family only):

- Ubuntu 24.04 LTS
- Ubuntu 25.x (latest stable)
- Debian 13 Trixie (latest stable)

Minimum hardware: 4 cores, 16 GB RAM, 100 GB disk. Recommended:
8 cores, 32 GB RAM, 200 GB disk.

A non-root sudo user (e.g. `cortexos`). SSH access from your laptop.

---

## 2. Node.js 24.x

CortexOS runtime (dashboard, NATS consumer, paperclip bridge, sandbox
runner) targets Node 24. Install on the VPS before setup:

```bash
curl -fsSL https://deb.nodesource.com/setup_24.x | sudo -E bash -
sudo apt-get install -y nodejs
node -v   # v24.x
npm -v
```

Why pre-install? The Docker images bundle their own Node, but the
operator-side scripts (`scripts/secrets-decrypt.sh`, smoke tests,
`scripts/migrate.js` in standalone mode) all need a host Node 24.

---

## 3. An AI coding agent (operator runs setup prompts through this)

`SETUP.md` and `prompts/tools/*` are written as prompts that an AI
coding agent executes. Pick **one** of:

- **Claude Code** — `npm install -g @anthropic-ai/claude-code`
- **Codex CLI** — `sudo npm install -g @openai/codex` then `codex login`
  (or `export OPENAI_API_KEY=sk-…`)
- **Cursor agent** / **OpenCode** / equivalent

The CLI must be authenticated and able to read/write files in the
working directory (the cloned repo) and run shell commands.

Quick verify:

```bash
claude --version    # or: codex --version
```

---

## 4. Tailscale (configured, joined to your tailnet)

Tailscale provides the encrypted mesh between operator laptop, VPS, and
any sibling hosts. **Install AND auth the VPS into your tailnet before
running setup.**

```bash
curl -fsSL https://tailscale.com/install.sh | sh
sudo systemctl enable --now tailscaled
sudo tailscale up \
  --hostname="cortex" \
  --advertise-tags=tag:cortex \
  --ssh
# follow the printed URL in your browser to sign in
```

Verify:

```bash
tailscale status
tailscale ip -4    # 100.x.x.x
```

The VPS must appear online in your Tailscale admin console and be
reachable from your laptop over the tailnet before you start `SETUP.md`.

`prompts/tools/12-tailscale.md` exists as a fallback inside the install
flow, but pre-configuring Tailscale is strongly preferred — it lets the
laptop bootstrap reach the VPS over the tailnet from the very first
command.

---

## 5. Repository cloned on the VPS

The setup agent operates against the working tree it is invoked from.
It does NOT clone or fetch — the operator clones once, manually:

```bash
sudo install -d -o "$USER" -g "$USER" /opt/cortexos
git clone https://github.com/bloodf/cortexos.git /opt/cortexos
cd /opt/cortexos
```

---

## 6. Local CLI tools the setup agent expects to find

The agent invokes these from the operator shell. Install them up-front
on the VPS (Ubuntu/Debian commands shown):

```bash
sudo apt-get update
sudo apt-get install -y \
  git curl jq age ufw ca-certificates gnupg lsb-release
# sops + cosign + syft (supply chain + secrets)
SOPS_VERSION=v3.10.1
curl -fsSL "https://github.com/getsops/sops/releases/download/${SOPS_VERSION}/sops-${SOPS_VERSION}.linux.amd64" \
  -o /tmp/sops && sudo install -m 0755 /tmp/sops /usr/local/bin/sops
COSIGN_VERSION=v2.4.1
curl -fsSL "https://github.com/sigstore/cosign/releases/download/${COSIGN_VERSION}/cosign-linux-amd64" \
  -o /tmp/cosign && sudo install -m 0755 /tmp/cosign /usr/local/bin/cosign
curl -fsSL https://raw.githubusercontent.com/anchore/syft/main/install.sh | sudo sh -s -- -b /usr/local/bin
type gh >/dev/null 2>&1 || sudo apt-get install -y gh
```

---

## 7. Tailscale MagicDNS + HTTPS (default — no public domain needed)

CortexOS publishes the dashboard over the tailnet using **Tailscale
Serve** with auto-issued Let's Encrypt certs against your `*.ts.net`
zone. Enable both toggles in your Tailscale admin console before
running setup:

- **Admin → DNS → MagicDNS**: on
- **Admin → DNS → HTTPS Certificates**: on (provision certs)

Your `CORTEX_DOMAIN` is then the node's MagicDNS FQDN
(`tailscale status` → the `<host>.<tailnet>.ts.net` line). No public
DNS record, no ports 80/443 exposed, no Let's Encrypt account needed.

## 8. Optional but recommended

- **A public domain** with DNS pointing to the VPS — only if you want
  the dashboard reachable from the open internet. The Tailscale path
  above is preferred for homelab installs (zero public surface).
- **A GitHub account with `gh` logged in** (`gh auth login`) — only
  required once a tagged release exists for `bloodf/cortexos`; the
  preflight prompt now skips artifact verification when none exists.

---

## What you do NOT need at setup time

- Telegram / Slack / Discord / WhatsApp tokens — these go in only when
  each integration is enabled via its own prompt under
  `prompts/integrations/`.
- A Tailscale auth key — the install uses interactive `tailscale up`
  browser login.
- Paperclip credentials — wired up later via `prompts/paperclip/*`.

Once items 1–6 are in place, open `SETUP.md` (or `prompts/00-bootstrap.md`
if you prefer the laptop-driven push install) and follow the questionnaire.
