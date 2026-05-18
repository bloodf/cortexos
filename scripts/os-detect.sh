#!/usr/bin/env bash
# os-detect.sh — emit "<family> <version> [<subfamily>]" for the host OS.
#
# Output is whitespace-separated on a single line:
#   "<family> <version> <subfamily>"
# where:
#   <family>    ∈ {ubuntu, debian, unsupported}
#   <version>   = VERSION_ID from /etc/os-release (or "unknown")
#   <subfamily> = lowercased ID from /etc/os-release for finer dispatch:
#                   - ubuntu family: ubuntu
#                   - debian family: debian
#                   - other: lowercased ID (when family is unsupported)
#
# The third token is additive and back-compat: existing callers that do
# `awk '{print $1}'` (family) or `awk '{print $2}'` (version) keep working.
# New callers wanting subfamily-aware dispatch read the third token.
#
# Supported distros: Ubuntu 24.04 LTS, Ubuntu 25.x, Debian 13 Trixie.
#
# `OSRELEASE` env override is honored so unit tests can point at fixtures.
#
# Exits 0 always. Callers parse stdout.

set -eu

OSRELEASE="${OSRELEASE:-/etc/os-release}"

emit() {
  # $1=family $2=version $3=subfamily
  printf '%s %s %s\n' "$1" "$2" "$3"
}

if [ ! -r "$OSRELEASE" ]; then
  emit unsupported unknown unknown
  exit 0
fi

# shellcheck disable=SC1090
. "$OSRELEASE"

id_lower=$(printf '%s' "${ID:-unknown}" | tr '[:upper:]' '[:lower:]')
ver="${VERSION_ID:-unknown}"

case "$id_lower" in
  ubuntu)
    emit ubuntu "$ver" ubuntu
    ;;
  debian)
    emit debian "$ver" debian
    ;;
  *)
    # Fall back to ID_LIKE family hint (e.g., derivatives).
    like_lower=$(printf '%s' "${ID_LIKE:-}" | tr '[:upper:]' '[:lower:]')
    case " $like_lower " in
      *" ubuntu "*) emit ubuntu "$ver" "$id_lower" ;;
      *" debian "*) emit ubuntu "$ver" "$id_lower" ;;
      *) emit unsupported "$ver" "$id_lower" ;;
    esac
    ;;
esac
