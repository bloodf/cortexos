#!/usr/bin/env bash
# os-detect.sh — emit "<family> <version>" for the host OS.
#
# Output is whitespace-separated on a single line:
#   "<family> <version>"
# where:
#   <family>  ∈ {ubuntu, fedora, rhel, unsupported}
#   <version> = VERSION_ID from /etc/os-release (or "unknown")
#
# RHEL family (RHEL, Rocky, AlmaLinux, CentOS Stream) normalizes to "rhel".
# This is the single source of truth consumed by scripts/pkg.sh, all
# prompts/tools/*.md branches, and every CI distro-matrix job.
#
# Exits 0 always. Callers parse stdout.

set -eu

readonly OSRELEASE="/etc/os-release"

emit() {
  printf '%s %s\n' "$1" "$2"
}

if [ ! -r "$OSRELEASE" ]; then
  emit unsupported unknown
  exit 0
fi

# shellcheck disable=SC1090
. "$OSRELEASE"

id_lower=$(printf '%s' "${ID:-unknown}" | tr '[:upper:]' '[:lower:]')
ver="${VERSION_ID:-unknown}"

case "$id_lower" in
  ubuntu)
    emit ubuntu "$ver"
    ;;
  fedora)
    emit fedora "$ver"
    ;;
  rhel|rocky|almalinux|centos)
    emit rhel "$ver"
    ;;
  *)
    # Fall back to ID_LIKE family hint (e.g., derivatives).
    like_lower=$(printf '%s' "${ID_LIKE:-}" | tr '[:upper:]' '[:lower:]')
    case " $like_lower " in
      *" rhel "*|*" fedora "*) emit rhel "$ver" ;;
      *" debian "*|*" ubuntu "*) emit ubuntu "$ver" ;;
      *) emit unsupported "$ver" ;;
    esac
    ;;
esac
