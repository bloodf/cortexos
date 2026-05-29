# Incus Project Instances — Own Tailnet Machines

Created: 2026-05-29  
Status: **PLANNING / READY TO EXECUTE**  
Related: `docs/rebuild/network-access-and-remaining-work.md`, `manifests/rebuild/projects.tsv`

## Operator requirement

Each **project Incus instance** must appear as its **own machine** in the Tailscale admin console. You reach project Hermes, SSH, and app ports on **that instance's tailnet identity** — not by hopping through the Cortex host (`cortexos.<tailnet>`).

| Machine role | Tailscale name (target) | What lives there |
|--------------|-------------------------|------------------|
| **Host** | `cortexos` | Dashboard, Obot, Grafana, Prometheus, Honcho, 9Router, host Hermes (`netbook`, `cortex`, `cieucpb`) |
| **Project** | `mementry` | Project Hermes + mementry app |
| **Project** | `celebrar-me` | Project Hermes + celebrar app |
| **Project** | `3guns` | Project Hermes + 3guns app |

Host Tailscale is for **shared infra only**. Project work uses the instance machine directly.

---

## Live host state (verified 2026-05-29)

| Instance | Bridge IP | `tailscaled` | `tailscale status` | `/dev/net/tun` |
|----------|-----------|--------------|--------------------|----------------|
| `mementry` | `10.222.222.175` | active | **Logged out** | present |
| `celebrar-me` | `10.222.222.86` | active | **Logged out** | present |
| `3guns` | `10.222.222.23` | active | **Logged out** | present |

Base image already includes `tailscale`, enabled `tailscaled`, and `/usr/local/bin/cortex-tailscale-up`.

**Gap:** instances were never joined (`tailscale up` + auth key).

---

## Target access pattern

```text
ssh cortexos@mementry
curl http://mementry:18697/health
```

You do **not** need `ssh cortexos@cortexos` for project services.

---

## Execution steps

### 1. Create Tailscale auth key(s)

Tailscale admin → Settings → Keys: reusable (not ephemeral) key for project instances.

Store on host: `/opt/cortexos/.secrets/tailscale/incus-projects.authkey`

### 2. Join each instance

```bash
AUTHKEY="$(sudo cat /opt/cortexos/.secrets/tailscale/incus-projects.authkey)"

for pair in "mementry:mementry" "celebrar-me:celebrar-me" "3guns:3guns"; do
  instance="${pair%%:*}"
  hostname="${pair##*:}"
  incus exec "$instance" -- sudo env TS_AUTHKEY="$AUTHKEY" cortex-tailscale-up "$hostname"
  incus exec "$instance" -- tailscale status
done
```

### 3. Verify in Tailscale admin

Three new machines: `mementry`, `celebrar-me`, `3guns` (separate from `cortexos`).

### 4. Verify Hermes via instance hostname

| Instance | Port |
|----------|------|
| mementry | 18697 |
| celebrar-me | 18696 |
| 3guns | 18695 |

---

## Do not

- Route project traffic through Caddy on the host.
- Reuse the host Tailscale identity inside instances.
