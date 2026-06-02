#!/usr/bin/env bash
# cortex-qwen-hermes-9router.sh <container> [9router_api_key]
#
# Provisions an incus container to use the host 9router gateway:
#   - installs qwen CLI (if missing)
#   - installs the qwen config (all models + context windows) from the host template,
#     with the API key swapped to the provided/!env key
#   - points hermes at the gateway (tailscale) with cx/gpt-5.5 as default model
#   - restarts the container's hermes profile
#
# Key resolution: $2  ->  $NINEROUTER_API_KEY  ->  key embedded in host qwen template.
set -euo pipefail

C="${1:?usage: $0 <container> [9router_api_key]}"
GW="https://cortexos.tailfd052e.ts.net:11434/v1"
QTPL="/home/cortexos/.qwen/settings.json"                 # canonical qwen config
EDITOR="$(dirname "$0")/cortex-hermes-9router.py"
KEY="${2:-${NINEROUTER_API_KEY:-}}"

# key fallback: reuse whatever the host qwen template already carries
[ -z "$KEY" ] && KEY="$(python3 -c "import json;d=json.load(open('$QTPL'));print(d['env'][next(iter(d['env']))])")"

echo "==> [$C] ensure qwen installed"
sudo -n incus exec "$C" -- bash -lc 'command -v qwen >/dev/null 2>&1 || npm install -g @qwen-code/qwen-code@latest --no-audit --no-fund >/dev/null 2>&1; qwen --version'

echo "==> [$C] push qwen config (key injected at runtime)"
tmp="$(mktemp)"
python3 -c "import json;d=json.load(open('$QTPL'));k=next(iter(d['env']));d['env'][k]='$KEY';json.dump(d,open('$tmp','w'),indent=2)"
sudo -n incus file push "$tmp" "$C/home/cortexos/.qwen/settings.json" --create-dirs --uid 1001 --gid 1001 --mode 0600
rm -f "$tmp"
sudo -n incus exec "$C" -- chown -R 1001:1001 /home/cortexos/.qwen

echo "==> [$C] point hermes at 9router (cx/gpt-5.5)"
sudo -n incus file push "$EDITOR" "$C/tmp/cortex-hermes-9router.py" --mode 0755
sudo -n incus exec "$C" -- env NINEROUTER_API_KEY="$KEY" GW="$GW" python3 /tmp/cortex-hermes-9router.py
svc="$(sudo -n incus exec "$C" -- bash -lc 'systemctl list-units --type=service | grep -oE "hermes-profile@[^ .]+" | head -1')"
[ -n "$svc" ] && sudo -n incus exec "$C" -- systemctl restart "$svc"
echo "==> [$C] done (hermes=$svc)"
