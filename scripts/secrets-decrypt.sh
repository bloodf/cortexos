#!/usr/bin/env bash
# secrets-decrypt.sh — decrypt every templates/.secrets/*.enc.yaml to
# /opt/cortexos/.secrets/<base>.env (KEY=value, one per line), chmod 600,
# owner = ${CORTEX_USER:-cortex}.
#
# Requires: sops (>=3.8) and one of yq (mikefarah) or python3 with PyYAML.
# Reads SOPS_AGE_KEY_FILE from environment (default /opt/cortexos/.age/host.key).
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SRC_DIR="${SECRETS_SRC_DIR:-${REPO_ROOT}/templates/.secrets}"
DEST_DIR="${SECRETS_DEST_DIR:-/opt/cortexos/.secrets}"
AGE_KEY_FILE="${SOPS_AGE_KEY_FILE:-/opt/cortexos/.age/host.key}"
CORTEX_USER="${CORTEX_USER:-cortex}"

log() { printf '[secrets-decrypt] %s\n' "$*" >&2; }
die() { log "ERROR: $*"; exit 1; }

command -v sops >/dev/null 2>&1 || die "sops not installed. Run prompts/tools/12a-sops-bootstrap.md first."
if command -v yq >/dev/null 2>&1; then
  CONV="yq"
elif command -v python3 >/dev/null 2>&1; then
  CONV="python3"
else
  die "need yq or python3 to convert YAML -> env."
fi

[[ -f "$AGE_KEY_FILE" ]] || die "age key file not found: $AGE_KEY_FILE"
export SOPS_AGE_KEY_FILE="$AGE_KEY_FILE"

mkdir -p "$DEST_DIR"
chmod 0700 "$DEST_DIR"

shopt -s nullglob
files=("$SRC_DIR"/*.enc.yaml)
[[ ${#files[@]} -gt 0 ]] || die "no encrypted files in $SRC_DIR"

yaml_to_env() {
  # stdin: flat YAML doc. stdout: KEY=value lines (values quoted with double quotes,
  # internal " escaped). Skips sops metadata block.
  if [[ "$CONV" == "yq" ]]; then
    yq -r 'to_entries | map(select(.key != "sops")) | .[] | "\(.key)=\"\(.value | tostring | gsub("\""; "\\\""))\""'
  else
    python3 - <<'PY'
import sys, yaml
doc = yaml.safe_load(sys.stdin) or {}
for k, v in doc.items():
    if k == "sops":
        continue
    s = "" if v is None else str(v)
    s = s.replace("\\", "\\\\").replace('"', '\\"')
    print(f'{k}="{s}"')
PY
  fi
}

for f in "${files[@]}"; do
  base="$(basename "$f" .enc.yaml)"
  out="$DEST_DIR/${base}.env"
  tmp="$(mktemp)"
  trap 'rm -f "$tmp"' EXIT
  log "decrypt $f -> $out"
  sops -d "$f" | yaml_to_env > "$tmp"
  install -m 0600 "$tmp" "$out"
  rm -f "$tmp"
  trap - EXIT
  if [[ $EUID -eq 0 ]] && id "$CORTEX_USER" >/dev/null 2>&1; then
    chown "${CORTEX_USER}:${CORTEX_USER}" "$out"
  fi
done

log "done. wrote ${#files[@]} env file(s) to $DEST_DIR"
