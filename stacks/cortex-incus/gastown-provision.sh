#!/usr/bin/env bash
set -Eeuo pipefail

# gastown-provision.sh — additive layer on top of base-image-provision.sh.
#
# Installs Steve Yegge's gastown multi-agent CLI (https://github.com/steveyegge/gastown)
# and its build/runtime dependencies (Go, beads, Dolt) into a CortexOS base builder
# container. This runs AFTER base-image-provision.sh inside the same builder so the
# resulting published image (cortexos-gastown-base) is a strict superset of cortexos-base.
#
# Keep this script separate from base-image-provision.sh so the default base image stays
# lean and gastown remains an opt-in variant (INCUS_BASE_VARIANT=gastown).

export DEBIAN_FRONTEND=noninteractive
export NEEDRESTART_MODE=a

# --- Pinned versions ---------------------------------------------------------
# Re-verify these against upstream periodically; they drift:
#   Go    -> https://go.dev/dl/                          (linux tarball)
#   Dolt  -> https://github.com/dolthub/dolt/releases    (release tag)
#   beads -> https://github.com/steveyegge/beads         (install.sh is unpinned upstream)
# Source of truth at authoring time: gastown Dockerfile (main) pins
#   GO_VERSION=1.25.8, DOLT_VERSION=2.0.7. gastown README requires
#   Go 1.25+, Dolt 2.0.7+, beads (bd) 0.55.4+.
GO_VERSION="${GO_VERSION:-1.25.8}"
DOLT_VERSION="${DOLT_VERSION:-2.0.7}"
GASTOWN_REF="${GASTOWN_REF:-main}"

CORTEX_USER="${CORTEX_USER:-cortexos}"
CORTEX_HOME="/home/$CORTEX_USER"
GASTOWN_SRC="${GASTOWN_SRC:-/opt/gastown}"
GASTOWN_DOLT_DATA="${GASTOWN_DOLT_DATA:-/gt/.dolt-data}"
GO_ROOT="/usr/local/go"

log() {
  printf '[gastown] %s\n' "$*"
}

run_as_user() {
  sudo -H -u "$CORTEX_USER" bash -lc "$*"
}

apt_get() {
  apt-get \
    -o Acquire::ForceIPv4=true \
    -o Acquire::Retries=5 \
    -o Acquire::http::Timeout=30 \
    "$@"
}

apt_get_install_retry() {
  local attempt
  for attempt in 1 2 3; do
    log "apt install attempt $attempt: $*"
    if apt_get install -y "$@"; then
      return 0
    fi
    log "apt install attempt $attempt failed, retrying in $((attempt * 5))s..."
    sleep $((attempt * 5))
    apt_get update || true
  done
  return 1
}

curl_retry() {
  curl -fsSL \
    --retry 5 \
    --retry-delay 3 \
    --retry-all-errors \
    --connect-timeout 20 \
    --max-time 240 \
    "$@"
}

git_clone_retry() {
  local url="$1"
  local target="$2"
  local ref="${3:-}"
  local attempt

  rm -rf "$target"
  for attempt in 1 2 3; do
    log "cloning $url to $target (attempt $attempt)"
    if timeout 120s env GIT_TERMINAL_PROMPT=0 \
      git -c http.lowSpeedLimit=1000 -c http.lowSpeedTime=60 \
      clone --depth 1 ${ref:+--branch "$ref"} "$url" "$target"; then
      return 0
    fi
    rm -rf "$target"
    sleep $((attempt * 5))
  done
  return 1
}

map_arch() {
  # Map dpkg/uname arch to Go/Dolt release naming.
  local arch
  arch="$(dpkg --print-architecture 2>/dev/null || uname -m)"
  case "$arch" in
    amd64|x86_64) printf 'amd64' ;;
    arm64|aarch64) printf 'arm64' ;;
    *) log "unsupported architecture: $arch"; return 1 ;;
  esac
}

install_build_deps() {
  log "installing gastown build dependencies"
  apt_get update
  # gastown Dockerfile apt set: build-essential git sqlite3 tmux curl ripgrep zsh gh
  # netcat-openbsd tini vim. Most already present from base; install the gastown extras
  # idempotently (apt is a no-op for already-installed packages).
  apt_get_install_retry build-essential git curl ca-certificates sqlite3 tini
}

install_go() {
  local arch tarball url
  if [ -x "$GO_ROOT/bin/go" ] && "$GO_ROOT/bin/go" version 2>/dev/null | grep -q "go${GO_VERSION}"; then
    log "Go ${GO_VERSION} already installed"
    return 0
  fi
  arch="$(map_arch)"
  tarball="go${GO_VERSION}.linux-${arch}.tar.gz"
  url="https://go.dev/dl/${tarball}"
  log "installing Go ${GO_VERSION} (${arch}) from ${url}"
  local tmp
  tmp="$(mktemp -d)"
  curl_retry "$url" -o "$tmp/$tarball"
  rm -rf "$GO_ROOT"
  tar -C /usr/local -xzf "$tmp/$tarball"
  rm -rf "$tmp"
  "$GO_ROOT/bin/go" version
}

install_dolt() {
  local arch tarball url tmp
  if command -v dolt >/dev/null 2>&1 && dolt version 2>/dev/null | grep -q "$DOLT_VERSION"; then
    log "Dolt ${DOLT_VERSION} already installed"
    return 0
  fi
  arch="$(map_arch)"
  # Install Dolt from the pinned release tarball directly (the upstream install.sh
  # always grabs latest; pin here for reproducibility).
  tarball="dolt-linux-${arch}.tar.gz"
  url="https://github.com/dolthub/dolt/releases/download/v${DOLT_VERSION}/${tarball}"
  log "installing Dolt ${DOLT_VERSION} (${arch}) from ${url}"
  tmp="$(mktemp -d)"
  curl_retry "$url" -o "$tmp/$tarball"
  tar -C "$tmp" -xzf "$tmp/$tarball"
  # Tarball layout: dolt-linux-<arch>/bin/dolt
  install -m 0755 "$tmp/dolt-linux-${arch}/bin/dolt" /usr/local/bin/dolt
  rm -rf "$tmp"
  dolt version
}

install_beads() {
  # beads (bd) — gastown task/issue backend. Upstream install.sh is unpinned; it
  # installs into the invoking user's PATH. Run it as the cortexos user so bd lands
  # under that user's local bin, matching how gastown expects to find it.
  local attempt tmpfile
  if run_as_user 'command -v bd >/dev/null 2>&1'; then
    log "beads (bd) already installed for $CORTEX_USER"
    return 0
  fi
  for attempt in 1 2 3; do
    log "installing beads (bd) (attempt $attempt)"
    tmpfile="$(mktemp)"
    if curl_retry "https://raw.githubusercontent.com/steveyegge/beads/main/scripts/install.sh" -o "$tmpfile" &&
      chmod +r "$tmpfile" &&
      sudo -H -u "$CORTEX_USER" bash "$tmpfile"; then
      rm -f "$tmpfile"
      return 0
    fi
    rm -f "$tmpfile"
    sleep $((attempt * 10))
  done
  return 1
}

build_gastown() {
  log "cloning gastown ($GASTOWN_REF)"
  git_clone_retry "https://github.com/steveyegge/gastown.git" "$GASTOWN_SRC" "$GASTOWN_REF"
  chown -R "$CORTEX_USER:$CORTEX_USER" "$GASTOWN_SRC"

  log "building gastown (gt)"
  # Build as the cortexos user with Go on PATH and a user-scoped GOPATH/GOCACHE so the
  # module cache does not pollute root. `make build` emits ./gt (plus gt-proxy-*) in
  # the repo root.
  run_as_user "export PATH=\"$GO_ROOT/bin:\$HOME/go/bin:\$PATH\"; export GOPATH=\"\$HOME/go\"; cd \"$GASTOWN_SRC\" && make build"

  # Publish the gt binaries to a global PATH location so every shell (and the smoke
  # validation) finds them without sourcing user profile Go paths.
  install -m 0755 "$GASTOWN_SRC/gt" /usr/local/bin/gt
  if [ -x "$GASTOWN_SRC/gt-proxy-server" ]; then
    install -m 0755 "$GASTOWN_SRC/gt-proxy-server" /usr/local/bin/gt-proxy-server
  fi
  if [ -x "$GASTOWN_SRC/gt-proxy-client" ]; then
    install -m 0755 "$GASTOWN_SRC/gt-proxy-client" /usr/local/bin/gt-proxy-client
  fi
}

setup_dolt_data_dir() {
  log "preparing Dolt data dir $GASTOWN_DOLT_DATA"
  install -d -o "$CORTEX_USER" -g "$CORTEX_USER" -m 0755 "$GASTOWN_DOLT_DATA"
}

install_go_env() {
  # Expose Go + gastown paths in the cortexos profile so interactive shells inside the
  # published image can rebuild/extend gastown and run gt directly.
  local profile_file="$CORTEX_HOME/.profile"
  touch "$profile_file"
  if ! grep -q '/usr/local/go/bin' "$profile_file"; then
    cat >>"$profile_file" <<'PROFILE'

# gastown / Go toolchain
case ":$PATH:" in
  *":/usr/local/go/bin:"*) ;;
  *) PATH="/usr/local/go/bin:$PATH" ;;
esac
case ":$PATH:" in
  *":$HOME/go/bin:"*) ;;
  *) PATH="$HOME/go/bin:$PATH" ;;
esac
export PATH
export GOPATH="$HOME/go"
export GASTOWN_DOLT_DATA="/gt/.dolt-data"
PROFILE
  fi
  chown "$CORTEX_USER:$CORTEX_USER" "$profile_file"
}

validate_gastown() {
  run_as_user 'source ~/.profile; command -v go; go version'
  run_as_user 'source ~/.profile; command -v dolt; dolt version | head -3'
  run_as_user 'source ~/.profile; command -v bd; bd --version || bd --help | head -3 || true'
  run_as_user 'source ~/.profile; command -v gt; gt --version || gt --help | head -5 || true'
  run_as_user 'source ~/.profile; test -d "/gt/.dolt-data" && echo "dolt-data dir present"'
}

cleanup_gastown_build() {
  # Drop the cloned source + Go module/build caches to keep the image lean. The
  # installed binaries (gt, dolt, go) remain under /usr/local.
  log "cleaning up gastown build artifacts"
  rm -rf "$GASTOWN_SRC"
  rm -rf "$CORTEX_HOME/go/pkg" "$CORTEX_HOME/.cache/go-build" 2>/dev/null || true
  apt_get clean
  rm -rf /var/lib/apt/lists/*
}

if ! id -u "$CORTEX_USER" >/dev/null 2>&1; then
  log "expected base user $CORTEX_USER to exist (run base-image-provision.sh first)"
  exit 1
fi

install_build_deps
install_go
install_dolt
install_beads
install_go_env
build_gastown
setup_dolt_data_dir
validate_gastown
cleanup_gastown_build

log "gastown provisioning complete"
