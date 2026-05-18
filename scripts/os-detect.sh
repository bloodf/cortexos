#!/usr/bin/env bash
# os-detect.sh — emit "<family> <version> [<subfamily>]" for the host OS.
#
# Output is whitespace-separated on a single line:
#   "<family> <version> <subfamily>"
# where:
#   <family>    ∈ {ubuntu, fedora, rhel, unsupported}
#   <version>   = VERSION_ID from /etc/os-release (or "unknown")
#   <subfamily> = lowercased ID from /etc/os-release for finer dispatch:
#                   - rhel family: rhel | rocky | almalinux | centos
#                   - other families: same as <family> (ubuntu, fedora, ...)
#
# The third token is additive and back-compat: existing callers that do
# `awk '{print $1}'` (family) or `awk '{print $2}'` (version) keep working.
# New callers wanting subfamily-aware dispatch read the third token.
#
# RHEL family (RHEL, Rocky, AlmaLinux, CentOS Stream) normalizes <family> to
# "rhel"; <subfamily> preserves the original distro id.
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
  fedora)
    emit fedora "$ver" fedora
    ;;
  rhel|rocky|almalinux|centos)
    emit rhel "$ver" "$id_lower"
    ;;
  *)
    # Fall back to ID_LIKE family hint (e.g., derivatives).
    like_lower=$(printf '%s' "${ID_LIKE:-}" | tr '[:upper:]' '[:lower:]')
    case " $like_lower " in
      *" rhel "*|*" fedora "*) emit rhel "$ver" "$id_lower" ;;
      *" debian "*|*" ubuntu "*) emit ubuntu "$ver" "$id_lower" ;;
      *) emit unsupported "$ver" "$id_lower" ;;
    esac
    ;;
esac
