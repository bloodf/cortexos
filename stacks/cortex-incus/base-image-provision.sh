#!/usr/bin/env bash
set -Eeuo pipefail

export DEBIAN_FRONTEND=noninteractive
export NEEDRESTART_MODE=a

CORTEX_USER="${CORTEX_USER:-cortexos}"
CORTEX_HOME="/home/$CORTEX_USER"
CORTEX_STACK="/opt/cortexos-incus/stacks/cortex-incus"
CORTEX_MANIFESTS="/opt/cortexos-incus/manifests/rebuild"
UBUNTU_CODENAME="${UBUNTU_CODENAME:-resolute}"
NODE_MAJOR="${NODE_MAJOR:-24}"

log() {
  printf '[base-image] %s\n' "$*"
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

github_tarball_extract() {
  local url="$1"
  local target="$2"
  local user="${3:-}"
  local repo_path
  local branch
  local tmpdir

  repo_path="${url#https://github.com/}"
  repo_path="${repo_path%.git}"

  for branch in master main; do
    tmpdir="$(mktemp -d)"
    if curl -fsSL \
      --retry 4 \
      --retry-delay 2 \
      --retry-all-errors \
      --connect-timeout 15 \
      --max-time 90 \
      "https://codeload.github.com/$repo_path/tar.gz/refs/heads/$branch" \
      -o "$tmpdir/archive.tgz"; then
      rm -rf "$target"
      install -d -m 0755 "$target"
      tar -xzf "$tmpdir/archive.tgz" --strip-components=1 -C "$target"
      rm -rf "$tmpdir"
      if [ -n "$user" ]; then
        chown -R "$user:$user" "$target"
      fi
      return 0
    fi
    rm -rf "$tmpdir"
  done

  return 1
}

git_clone_retry() {
  local url="$1"
  local target="$2"
  local user="${3:-}"
  local attempt

  rm -rf "$target"
  for attempt in 1 2 3; do
    log "cloning $url to $target (attempt $attempt)"
    if [ -n "$user" ]; then
      if timeout 75s sudo -H -u "$user" env GIT_TERMINAL_PROMPT=0 \
        git -c http.lowSpeedLimit=1000 -c http.lowSpeedTime=60 \
        clone --depth 1 "$url" "$target"; then
        return 0
      fi
    elif timeout 75s env GIT_TERMINAL_PROMPT=0 \
      git -c http.lowSpeedLimit=1000 -c http.lowSpeedTime=60 \
      clone --depth 1 "$url" "$target"; then
      return 0
    fi
    rm -rf "$target"
    sleep $((attempt * 5))
  done

  log "falling back to GitHub codeload archive for $url"
  github_tarball_extract "$url" "$target" "$user"
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

npm_install_global_retry() {
  local package="$1"
  local attempt

  for attempt in 1 2 3; do
    log "installing npm package $package (attempt $attempt)"
    if timeout 420s npm install -g \
      --fetch-retries=5 \
      --fetch-retry-mintimeout=20000 \
      --fetch-retry-maxtimeout=120000 \
      --fetch-timeout=120000 \
      --prefer-online \
      "$package"; then
      return 0
    fi
    sleep $((attempt * 10))
  done

  return 1
}

run_installer_as_user() {
  local url="$1"
  local label="$2"
  local tmpfile
  local attempt

  for attempt in 1 2 3; do
    log "running $label installer (attempt $attempt)"
    tmpfile="$(mktemp)"
    if curl_retry "$url" -o "$tmpfile" &&
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

install_apt_repos() {
  install -d -m 0755 /etc/apt/keyrings
  printf 'Acquire::ForceIPv4 "true";\n' >/etc/apt/apt.conf.d/99force-ipv4

  if [ ! -f /etc/apt/sources.list.d/nodesource.list ]; then
    curl -fsSL https://deb.nodesource.com/gpgkey/nodesource-repo.gpg.key |
      gpg --dearmor -o /etc/apt/keyrings/nodesource.gpg
    chmod 0644 /etc/apt/keyrings/nodesource.gpg
    printf 'deb [signed-by=/etc/apt/keyrings/nodesource.gpg] https://deb.nodesource.com/node_%s.x nodistro main\n' "$NODE_MAJOR" \
      >/etc/apt/sources.list.d/nodesource.list
  fi

  if [ ! -f /etc/apt/sources.list.d/tailscale.list ]; then
    curl -fsSL "https://pkgs.tailscale.com/stable/ubuntu/$UBUNTU_CODENAME.noarmor.gpg" \
      >/usr/share/keyrings/tailscale-archive-keyring.gpg
    curl -fsSL "https://pkgs.tailscale.com/stable/ubuntu/$UBUNTU_CODENAME.tailscale-keyring.list" \
      >/etc/apt/sources.list.d/tailscale.list
  fi
}

install_policy_rc_d() {
  cat >/usr/sbin/policy-rc.d <<'POLICY'
#!/bin/sh
exit 101
POLICY
  chmod 0755 /usr/sbin/policy-rc.d
}

remove_policy_rc_d() {
  rm -f /usr/sbin/policy-rc.d
}

ensure_user() {
  if ! id -u "$CORTEX_USER" >/dev/null 2>&1; then
    useradd -m -s /usr/bin/zsh "$CORTEX_USER"
  fi
  usermod -aG sudo,adm,systemd-journal "$CORTEX_USER"
  install -d -m 0755 /etc/sudoers.d
  printf '%s ALL=(ALL) NOPASSWD:ALL\n' "$CORTEX_USER" >/etc/sudoers.d/90-cortexos
  chmod 0440 /etc/sudoers.d/90-cortexos
  chsh -s /usr/bin/zsh "$CORTEX_USER"
}

install_oh_my_zsh() {
  if [ ! -d "$CORTEX_HOME/.oh-my-zsh" ]; then
    git_clone_retry https://github.com/ohmyzsh/ohmyzsh.git "$CORTEX_HOME/.oh-my-zsh"
  fi

  zsh_custom="$CORTEX_HOME/.oh-my-zsh/custom"
  install -d -m 0755 "$zsh_custom/plugins"
  for spec in \
    zsh-users/zsh-autosuggestions \
    zsh-users/zsh-syntax-highlighting \
    zsh-users/zsh-completions; do
    name="${spec##*/}"
    target="$zsh_custom/plugins/$name"
    if [ ! -d "$target" ]; then
      git_clone_retry "https://github.com/$spec.git" "$target"
    fi
  done

  install -o "$CORTEX_USER" -g "$CORTEX_USER" -m 0644 "$CORTEX_STACK/zshrc" "$CORTEX_HOME/.zshrc"
  chown -R "$CORTEX_USER:$CORTEX_USER" "$CORTEX_HOME/.oh-my-zsh"
}

install_tmux_plugins() {
  install -d -o "$CORTEX_USER" -g "$CORTEX_USER" -m 0755 "$CORTEX_HOME/.tmux/plugins"
  while IFS= read -r plugin; do
    case "$plugin" in
      ""|\#*) continue ;;
    esac
    name="${plugin##*/}"
    target="$CORTEX_HOME/.tmux/plugins/$name"
    if [ ! -d "$target" ]; then
      git_clone_retry "https://github.com/$plugin.git" "$target" "$CORTEX_USER"
    fi
  done <"$CORTEX_MANIFESTS/tmux-plugins.txt"

  install -o "$CORTEX_USER" -g "$CORTEX_USER" -m 0644 "$CORTEX_STACK/tmux.conf" "$CORTEX_HOME/.tmux.conf"
  install -o root -g root -m 0755 "$CORTEX_STACK/cortex-tmux" /usr/local/bin/cortex-tmux

  if [ -d "$CORTEX_HOME/.tmux/plugins/tmux-mem-cpu-load" ]; then
    cmake -S "$CORTEX_HOME/.tmux/plugins/tmux-mem-cpu-load" \
      -B "$CORTEX_HOME/.tmux/plugins/tmux-mem-cpu-load/build"
    cmake --build "$CORTEX_HOME/.tmux/plugins/tmux-mem-cpu-load/build"
    install -m 0755 \
      "$CORTEX_HOME/.tmux/plugins/tmux-mem-cpu-load/build/tmux-mem-cpu-load" \
      /usr/local/bin/tmux-mem-cpu-load
  fi
}

install_ai_tools() {
  npm config set fund false
  npm config set audit false
  npm config set fetch-retries 5
  npm config set fetch-retry-mintimeout 20000
  npm config set fetch-retry-maxtimeout 120000
  npm config set fetch-timeout 120000

  npm_install_global_retry @openai/codex@latest
  npm_install_global_retry @anthropic-ai/claude-code@latest
  npm_install_global_retry @earendil-works/pi-coding-agent@latest
  npm_install_global_retry oh-pi@latest

  run_installer_as_user https://bun.sh/install bun
  # shellcheck disable=SC2016
  run_as_user 'export BUN_INSTALL="$HOME/.bun"; export PATH="$BUN_INSTALL/bin:$PATH"; for attempt in 1 2 3; do timeout 420s bun install -g @oh-my-pi/pi-coding-agent@latest && exit 0; sleep $((attempt * 10)); done; exit 1'

  run_installer_as_user https://cursor.com/install cursor
  run_installer_as_user https://raw.githubusercontent.com/NousResearch/hermes-agent/main/scripts/install.sh hermes
}

install_host_connectivity() {
  install -d -m 0755 /etc/cortexos
  install -o root -g root -m 0644 "$CORTEX_STACK/host-services.env" /etc/cortexos/host-services.env
  install -o root -g root -m 0755 "$CORTEX_STACK/cortex-host-health" /usr/local/bin/cortex-host-health
  install -o root -g root -m 0755 "$CORTEX_STACK/cortex-tailscale-up" /usr/local/bin/cortex-tailscale-up

  profile_file="$CORTEX_HOME/.profile"
  touch "$profile_file"
  if ! grep -q '/etc/cortexos/host-services.env' "$profile_file"; then
    cat >>"$profile_file" <<'PROFILE'

if [ -f /etc/cortexos/host-services.env ]; then
  . /etc/cortexos/host-services.env
fi
case ":$PATH:" in
  *":$HOME/.local/bin:"*) ;;
  *) PATH="$HOME/.local/bin:$PATH" ;;
esac
case ":$PATH:" in
  *":$HOME/.bun/bin:"*) ;;
  *) PATH="$HOME/.bun/bin:$PATH" ;;
esac
export PATH
PROFILE
  fi
  chown "$CORTEX_USER:$CORTEX_USER" "$profile_file"
}

validate_image_tools() {
  run_as_user 'source ~/.profile; command -v codex; codex --version'
  run_as_user 'source ~/.profile; command -v pi; pi --version || pi --help | head -5'
  run_as_user 'source ~/.profile; command -v omp; omp --version || omp --help | head -5 || true'
  run_as_user 'source ~/.profile; command -v oh-pi; oh-pi --version || oh-pi --help | head -5'
  run_as_user 'source ~/.profile; command -v claude; claude --version || true'
  run_as_user 'source ~/.profile; command -v cursor; command -v cursor-agent; cursor --version || true'
  run_as_user 'source ~/.profile; command -v hermes; hermes --version || hermes --help | head -5'
  run_as_user 'source ~/.profile; tmux -V; zsh --version; tailscale version | head -5'
  run_as_user 'source ~/.profile; cortex-host-health --local-only'
}

cleanup_image_identity() {
  remove_policy_rc_d
  rm -f /etc/ssh/ssh_host_*
  truncate -s 0 /etc/machine-id
  rm -f /var/lib/dbus/machine-id
  ln -s /etc/machine-id /var/lib/dbus/machine-id
}

log "installing base apt packages"
apt_get update
apt_get install -y ca-certificates curl wget gpg gnupg lsb-release sudo
install_apt_repos
apt_get update
install_policy_rc_d
trap remove_policy_rc_d EXIT
apt_get_install_retry \
  bash-completion bat build-essential cmake direnv dnsutils fd-find fzf gh git htop \
  iproute2 iputils-ping jq less nano ncdu netcat-openbsd nodejs openssh-client \
  openssh-server pkg-config pipx python3 python3-pip python3-venv ripgrep rsync \
  shellcheck sudo tailscale tmux tree unzip vim zsh
remove_policy_rc_d
trap - EXIT

ensure_user
install_oh_my_zsh
install_tmux_plugins
install_ai_tools
install_host_connectivity

systemctl enable ssh >/dev/null 2>&1 || systemctl enable ssh.service >/dev/null 2>&1 || true
systemctl enable tailscaled >/dev/null 2>&1 || true

validate_image_tools

apt_get clean
rm -rf /var/lib/apt/lists/* /opt/cortexos-incus
cleanup_image_identity

log "base image provisioning complete"
