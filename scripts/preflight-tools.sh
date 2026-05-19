#!/usr/bin/env bash
# preflight-tools.sh — VPS-side tool presence + minimum-version check.
#
# Runs ON THE VPS (dispatched from the laptop via bootstrap_run_remote).
# Verifies every binary CortexOS install requires is present at or above
# its minimum version. Prints a numbered remediation list when anything
# is missing and exits 2. Exits 0 when every required tool is present.
#
# Usage:
#   bash scripts/preflight-tools.sh
#   bash scripts/preflight-tools.sh --install-missing   # interactive
#
# This script never stores or transmits secrets. It only reads versions.

set -euo pipefail

REQUIRED_TOOLS=(node pnpm docker git sops age jq curl openssl gh tailscale ssh tar)

# Minimum versions (semver-style "major.minor.patch"; only major.minor matter
# for the comparison below). Empty string means "any version accepted".
declare -A MIN_VERSION=(
  [node]="22.0.0"
  [pnpm]="9.0.0"
  [docker]="24.0.0"
  [git]="2.30.0"
  [sops]="3.8.0"
  [age]="1.1.0"
  [jq]="1.6"
  [curl]="7.81.0"
  [openssl]="3.0.0"
  [gh]="2.40.0"
  [tailscale]="1.60.0"
  [ssh]=""
  [tar]=""
)

# Debian-family install hints. `<curl>` entries fetch upstream installers.
declare -A INSTALL_HINT=(
  [node]="curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash - && sudo apt-get install -y nodejs"
  [pnpm]="sudo npm install -g pnpm@latest"
  [docker]="curl -fsSL https://get.docker.com | sudo sh"
  [git]="sudo apt-get install -y git"
  [sops]="sudo apt-get install -y sops"
  [age]="sudo apt-get install -y age"
  [jq]="sudo apt-get install -y jq"
  [curl]="sudo apt-get install -y curl"
  [openssl]="sudo apt-get install -y openssl"
  [gh]="sudo apt-get install -y gh"
  [tailscale]="curl -fsSL https://tailscale.com/install.sh | sh"
  [ssh]="sudo apt-get install -y openssh-client"
  [tar]="sudo apt-get install -y tar"
)

# Apt package names for --install-missing (curl-installers handled separately).
declare -A APT_PKG=(
  [git]="git"
  [sops]="sops"
  [age]="age"
  [jq]="jq"
  [curl]="curl"
  [openssl]="openssl"
  [gh]="gh"
  [ssh]="openssh-client"
  [tar]="tar"
)

# tools that need a curl-installer rather than apt
CURL_INSTALL_TOOLS=(node docker tailscale)
# tools that need a special command path
SPECIAL_INSTALL_TOOLS=(pnpm)

log() { printf '[preflight] %s\n' "$*" >&2; }

# Extract a "major.minor.patch" (or partial) from arbitrary CLI version output.
extract_version() {
  printf '%s' "$1" \
    | grep -oE '[0-9]+(\.[0-9]+){1,2}' \
    | head -n1 \
    || true
}

probe_version() {
  local tool="$1" raw=""
  case "$tool" in
    node)       raw="$(node --version 2>/dev/null || true)" ;;
    pnpm)       raw="$(pnpm --version 2>/dev/null || true)" ;;
    docker)     raw="$(docker --version 2>/dev/null || true)" ;;
    git)        raw="$(git --version 2>/dev/null || true)" ;;
    sops)       raw="$(sops --version 2>/dev/null || true)" ;;
    age)        raw="$(age --version 2>/dev/null || true)" ;;
    jq)         raw="$(jq --version 2>/dev/null || true)" ;;
    curl)       raw="$(curl --version 2>/dev/null | head -n1 || true)" ;;
    openssl)    raw="$(openssl version 2>/dev/null || true)" ;;
    gh)         raw="$(gh --version 2>/dev/null | head -n1 || true)" ;;
    tailscale)  raw="$(tailscale version 2>/dev/null | head -n1 || true)" ;;
    ssh)        raw="$(ssh -V 2>&1 | head -n1 || true)" ;;
    tar)        raw="$(tar --version 2>/dev/null | head -n1 || true)" ;;
    *)          raw="" ;;
  esac
  extract_version "$raw"
}

# Returns 0 if $1 >= $2 (semver-ish dotted numeric compare). Empty min accepts.
version_ge() {
  local have="$1" need="$2"
  [ -z "$need" ] && return 0
  [ -z "$have" ] && return 1

  local IFS=.
  # shellcheck disable=SC2206
  local a=($have) b=($need)
  local i
  for i in 0 1 2; do
    local av="${a[$i]:-0}" bv="${b[$i]:-0}"
    if [ "$av" -gt "$bv" ] 2>/dev/null; then return 0; fi
    if [ "$av" -lt "$bv" ] 2>/dev/null; then return 1; fi
  done
  return 0
}

MISSING=()
TOO_OLD=()

for tool in "${REQUIRED_TOOLS[@]}"; do
  if ! command -v "$tool" >/dev/null 2>&1; then
    MISSING+=("$tool")
    continue
  fi
  have="$(probe_version "$tool")"
  need="${MIN_VERSION[$tool]:-}"
  if ! version_ge "$have" "$need"; then
    TOO_OLD+=("$tool (have ${have:-unknown}, need >= $need)")
    MISSING+=("$tool")
  fi
done

if [ "${#MISSING[@]}" -eq 0 ]; then
  log "all required tools present"
  exit 0
fi

# Report missing/too-old tools.
printf '\n[preflight] required tools missing or below minimum version:\n\n' >&2
i=1
for tool in "${MISSING[@]}"; do
  printf '  %d) %s\n' "$i" "$tool" >&2
  printf '       install: %s\n' "${INSTALL_HINT[$tool]:-(no hint — install manually)}" >&2
  i=$((i + 1))
done

if [ "${#TOO_OLD[@]}" -gt 0 ]; then
  printf '\n[preflight] version-too-old details:\n' >&2
  for line in "${TOO_OLD[@]}"; do
    printf '  - %s\n' "$line" >&2
  done
fi

# Optional auto-install path (interactive — never silent).
if [ "${1:-}" = "--install-missing" ]; then
  printf '\n[preflight] --install-missing requested.\n' >&2
  printf '[preflight] proceed with apt/curl-installer commands above? [y/N] ' >&2
  read -r answer
  case "$answer" in
    y|Y|yes|YES)
      apt_list=()
      for tool in "${MISSING[@]}"; do
        pkg="${APT_PKG[$tool]:-}"
        [ -n "$pkg" ] && apt_list+=("$pkg")
      done
      if [ "${#apt_list[@]}" -gt 0 ]; then
        log "apt-get install: ${apt_list[*]}"
        sudo apt-get update
        sudo apt-get install -y "${apt_list[@]}"
      fi
      for tool in "${MISSING[@]}"; do
        for special in "${CURL_INSTALL_TOOLS[@]}" "${SPECIAL_INSTALL_TOOLS[@]}"; do
          if [ "$tool" = "$special" ]; then
            log "running installer for $tool"
            bash -c "${INSTALL_HINT[$tool]}"
            break
          fi
        done
      done
      log "install attempt complete — re-run scripts/preflight-tools.sh to verify"
      exit 0
      ;;
    *)
      log "operator declined auto-install"
      exit 2
      ;;
  esac
fi

printf '\n[preflight] install the items above and re-run scripts/preflight-tools.sh.\n' >&2
printf '[preflight] or invoke: bash scripts/preflight-tools.sh --install-missing\n' >&2
exit 2
