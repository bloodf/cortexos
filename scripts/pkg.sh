#!/usr/bin/env bash
# pkg.sh — distro-agnostic package + service + firewall dispatcher.
#
# Supported families: ubuntu (Ubuntu 24.04 / 25.x), debian (Debian 13 Trixie).
#
# Source this file, then call the public functions:
#
#   pkg_install <name> [<name>...]
#   pkg_repo_add <family-specific-args>
#   pkg_key_import <url>
#   service_enable <unit>      # systemctl enable --now
#   service_restart <unit>
#   firewall_open <port> [tcp|udp]
#   selinux_set <permissive|enforcing>   # no-op on ubuntu/debian
#   pkg_family                  # echoes ubuntu | debian | unsupported
#   pkg_subfamily               # echoes ubuntu | debian | <derivative-id>
#
# All functions return non-zero on failure. Quiet by default; set PKG_DEBUG=1
# for verbose tracing.

set -eu

# Resolve our own dir so we can find os-detect.sh next to us.
__pkg_self_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

__pkg_detect() {
  if [ -z "${__PKG_FAMILY:-}" ]; then
    local line
    line=$("${__pkg_self_dir}/os-detect.sh")
    __PKG_FAMILY=$(printf '%s' "$line" | awk '{print $1}')
    __PKG_VERSION=$(printf '%s' "$line" | awk '{print $2}')
    __PKG_SUBFAMILY=$(printf '%s' "$line" | awk '{print $3}')
    [ -n "$__PKG_SUBFAMILY" ] || __PKG_SUBFAMILY="$__PKG_FAMILY"
    export __PKG_FAMILY __PKG_VERSION __PKG_SUBFAMILY
  fi
}

__pkg_log() {
  [ "${PKG_DEBUG:-0}" = "1" ] && printf '[pkg.sh] %s\n' "$*" >&2 || true
}

pkg_family() {
  __pkg_detect
  printf '%s\n' "$__PKG_FAMILY"
}

pkg_version() {
  __pkg_detect
  printf '%s\n' "$__PKG_VERSION"
}

pkg_subfamily() {
  __pkg_detect
  printf '%s\n' "$__PKG_SUBFAMILY"
}

# pkg_module_enable <module:stream>
#
# No-op on debian-family hosts (apt has no module streams). Returns 0.
pkg_module_enable() {
  __pkg_detect
  case "$__PKG_FAMILY" in
    ubuntu|debian) return 0 ;;
    *)
      echo "pkg_module_enable: unsupported family '$__PKG_FAMILY'" >&2
      return 3
      ;;
  esac
}

pkg_install() {
  __pkg_detect
  [ $# -gt 0 ] || { echo "pkg_install: requires at least one package" >&2; return 2; }
  __pkg_log "install ($__PKG_FAMILY): $*"
  case "$__PKG_FAMILY" in
    ubuntu|debian)
      DEBIAN_FRONTEND=noninteractive sudo -E apt-get update -y -qq
      DEBIAN_FRONTEND=noninteractive sudo -E apt-get install -y --no-install-recommends "$@"
      ;;
    *)
      echo "pkg_install: unsupported family '$__PKG_FAMILY'" >&2
      return 3
      ;;
  esac
}

# pkg_repo_add takes family-specific positional args:
#
#   ubuntu:  pkg_repo_add ubuntu  <list-name> <deb-line>            [key-url]
#   debian:  pkg_repo_add debian  <list-name> <deb-line>            [key-url]
#
# Each branch accepts only its own family; passing a different family is a no-op.
pkg_repo_add() {
  __pkg_detect
  local target_family="$1"; shift
  if [ "$target_family" != "$__PKG_FAMILY" ]; then
    __pkg_log "skip repo for $target_family on $__PKG_FAMILY"
    return 0
  fi
  case "$target_family" in
    ubuntu|debian)
      local list="$1" deb_line="$2" key_url="${3:-}"
      if [ -n "$key_url" ]; then
        pkg_key_import "$key_url" "/etc/apt/keyrings/${list}.gpg"
      fi
      echo "$deb_line" | sudo tee "/etc/apt/sources.list.d/${list}.list" >/dev/null
      sudo apt-get update -y -qq
      ;;
    *)
      echo "pkg_repo_add: unsupported family '$target_family'" >&2
      return 3
      ;;
  esac
}

pkg_key_import() {
  __pkg_detect
  local url="$1" dest="${2:-}"
  case "$__PKG_FAMILY" in
    ubuntu|debian)
      [ -n "$dest" ] || dest="/etc/apt/keyrings/$(basename "$url" | sed 's/\.[^.]*$//').gpg"
      sudo install -m 0755 -d "$(dirname "$dest")"
      curl -fsSL "$url" | sudo gpg --dearmor -o "$dest"
      sudo chmod 0644 "$dest"
      ;;
    *)
      echo "pkg_key_import: unsupported family '$__PKG_FAMILY'" >&2
      return 3
      ;;
  esac
}

service_enable() {
  local unit="$1"
  __pkg_log "service_enable $unit"
  sudo systemctl daemon-reload
  sudo systemctl enable --now "$unit"
}

service_restart() {
  local unit="$1"
  sudo systemctl restart "$unit"
}

firewall_open() {
  __pkg_detect
  local port="$1" proto="${2:-tcp}"
  case "$__PKG_FAMILY" in
    ubuntu|debian)
      sudo ufw allow "${port}/${proto}" || true
      ;;
    *)
      echo "firewall_open: unsupported family '$__PKG_FAMILY'" >&2
      return 3
      ;;
  esac
}

selinux_set() {
  __pkg_detect
  local mode="$1"
  case "$__PKG_FAMILY" in
    ubuntu|debian) return 0 ;;
    *)
      echo "selinux_set: unsupported family '$__PKG_FAMILY'" >&2
      return 3
      ;;
  esac
}
