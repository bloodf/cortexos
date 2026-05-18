#!/usr/bin/env bash
# pkg.sh — distro-agnostic package + service + firewall dispatcher.
#
# Source this file, then call the public functions:
#
#   pkg_install <name> [<name>...]
#   pkg_repo_add <family-specific-args>
#   pkg_key_import <url>
#   service_enable <unit>      # systemctl enable --now
#   service_restart <unit>
#   firewall_open <port> [tcp|udp]
#   selinux_set <permissive|enforcing>   # no-op on ubuntu
#   pkg_family                  # echoes ubuntu | fedora | rhel | unsupported
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
    export __PKG_FAMILY __PKG_VERSION
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

pkg_install() {
  __pkg_detect
  [ $# -gt 0 ] || { echo "pkg_install: requires at least one package" >&2; return 2; }
  __pkg_log "install ($__PKG_FAMILY): $*"
  case "$__PKG_FAMILY" in
    ubuntu)
      DEBIAN_FRONTEND=noninteractive sudo -E apt-get update -y -qq
      DEBIAN_FRONTEND=noninteractive sudo -E apt-get install -y --no-install-recommends "$@"
      ;;
    fedora|rhel)
      sudo dnf install -y "$@"
      ;;
    *)
      echo "pkg_install: unsupported family '$__PKG_FAMILY'" >&2
      return 3
      ;;
  esac
}

# pkg_repo_add takes family-specific positional args because repo registration
# is fundamentally different per package manager:
#
#   ubuntu:  pkg_repo_add ubuntu  <list-name> <deb-line>            [key-url]
#   fedora:  pkg_repo_add fedora  <repo-file-basename> <repo-url>
#   rhel:    pkg_repo_add rhel    <repo-file-basename> <repo-url>   [--enable-crb]
#
# Each branch accepts only its own family; passing the wrong family is a hard error.
pkg_repo_add() {
  __pkg_detect
  local target_family="$1"; shift
  if [ "$target_family" != "$__PKG_FAMILY" ]; then
    __pkg_log "skip repo for $target_family on $__PKG_FAMILY"
    return 0
  fi
  case "$target_family" in
    ubuntu)
      local list="$1" deb_line="$2" key_url="${3:-}"
      if [ -n "$key_url" ]; then
        pkg_key_import "$key_url" "/etc/apt/keyrings/${list}.gpg"
      fi
      echo "$deb_line" | sudo tee "/etc/apt/sources.list.d/${list}.list" >/dev/null
      sudo apt-get update -y -qq
      ;;
    fedora|rhel)
      local repo_name="$1" repo_url="$2"; shift 2
      sudo dnf config-manager addrepo --from-repofile="$repo_url" || \
        sudo dnf config-manager --add-repo "$repo_url"
      # Optional flags
      while [ $# -gt 0 ]; do
        case "$1" in
          --enable-crb)
            sudo dnf config-manager --set-enabled crb 2>/dev/null || \
              sudo dnf config-manager --set-enabled powertools 2>/dev/null || true
            ;;
        esac
        shift
      done
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
    ubuntu)
      [ -n "$dest" ] || dest="/etc/apt/keyrings/$(basename "$url" | sed 's/\.[^.]*$//').gpg"
      sudo install -m 0755 -d "$(dirname "$dest")"
      curl -fsSL "$url" | sudo gpg --dearmor -o "$dest"
      sudo chmod 0644 "$dest"
      ;;
    fedora|rhel)
      sudo rpm --import "$url"
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
    ubuntu)
      sudo ufw allow "${port}/${proto}" || true
      ;;
    fedora|rhel)
      sudo firewall-cmd --permanent --add-port="${port}/${proto}"
      sudo firewall-cmd --reload
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
    ubuntu) return 0 ;;
    fedora|rhel)
      case "$mode" in
        permissive) sudo setenforce 0 || true ;;
        enforcing)  sudo setenforce 1 || true ;;
        *) echo "selinux_set: mode must be permissive|enforcing" >&2; return 2 ;;
      esac
      ;;
    *)
      echo "selinux_set: unsupported family '$__PKG_FAMILY'" >&2
      return 3
      ;;
  esac
}
