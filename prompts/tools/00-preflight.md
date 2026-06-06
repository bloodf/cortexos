# 00 - Preflight Checks

Run these checks before starting any CortexOS installation. Do not begin destructive work until every check passes.

## Required checks

```bash
# 1. OS family detected
source scripts/pkg.sh
echo "OS family: $(pkg_family) $(pkg_version)"

# 2. Non-root sudo user
if [ "$EUID" -eq 0 ]; then
    echo "ERROR: Do not run as root. Use a sudo-capable user."
    exit 1
fi
sudo -v

# 3. Required tools present
for cmd in curl wget git ssh docker; do
    if ! command -v "$cmd" >/dev/null 2>&1; then
        echo "WARNING: $cmd not found (may be installed by later prompts)"
    fi
done

# 4. Directory structure
sudo mkdir -p /opt/cortexos/{stacks,templates,prompts,logs,.secrets}
sudo chown "$(id -u):$(id -g)" /opt/cortexos
chmod 700 /opt/cortexos/.secrets

# 5. Tailscale check (optional but recommended)
if command -v tailscale >/dev/null 2>&1; then
    tailscale status --json | head -c 200
    echo ""
fi
```

## CHECKPOINT 1

**STOP — operator question:** Are you connected as a non-root sudo user, is `/opt/cortexos` writable, and does `$(pkg_family)` return `ubuntu` or `debian`?

Type `confirmed` to proceed.

## Next

→ `prompts/tools/10-os-hardening.md`
