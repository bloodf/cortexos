#!/usr/bin/env bash
# secrets-rotate.sh KEY [NEW_VALUE]
# Rotates KEY across every templates/.secrets/*.enc.yaml that contains it.
# If NEW_VALUE omitted, generates with `openssl rand -hex 32`.
# Re-encrypts each touched file with `sops -e -i`.
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SRC_DIR="${SECRETS_SRC_DIR:-${REPO_ROOT}/templates/.secrets}"
AGE_KEY_FILE="${SOPS_AGE_KEY_FILE:-/opt/cortexos/.age/host.key}"

log() { printf '[secrets-rotate] %s\n' "$*" >&2; }
die() { log "ERROR: $*"; exit 1; }

[[ $# -ge 1 ]] || die "usage: $0 KEY [NEW_VALUE]"
KEY="$1"; shift
NEW_VAL="${1:-$(openssl rand -hex 32)}"

command -v sops >/dev/null 2>&1 || die "sops not installed."
command -v yq   >/dev/null 2>&1 || die "yq required for in-place YAML edits."
[[ -f "$AGE_KEY_FILE" ]] || die "age key file not found: $AGE_KEY_FILE"
export SOPS_AGE_KEY_FILE="$AGE_KEY_FILE"

shopt -s nullglob
files=("$SRC_DIR"/*.enc.yaml)
[[ ${#files[@]} -gt 0 ]] || die "no .enc.yaml under $SRC_DIR"

changed=()
for f in "${files[@]}"; do
  plain="$(sops -d "$f")"
  if ! printf '%s' "$plain" | yq -e ".${KEY}" >/dev/null 2>&1; then
    continue
  fi
  log "rotating $KEY in $f"
  tmp="$(mktemp)"
  printf '%s' "$plain" | yq ".${KEY} = \"${NEW_VAL}\"" > "$tmp"
  # Replace encrypted file in-place: encrypt the new plaintext on top of old.
  cp "$tmp" "$f"
  sops -e -i "$f"
  rm -f "$tmp"
  changed+=("$f")
done

log "rotated $KEY in ${#changed[@]} file(s):"
for f in "${changed[@]}"; do log "  - $f"; done
[[ ${#changed[@]} -gt 0 ]] || log "WARNING: $KEY not found in any file"
