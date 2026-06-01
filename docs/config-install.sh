#!/bin/bash
# CortexOS Dotfiles Installer
# Run on a fresh Ubuntu machine to replicate the CortexOS setup

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

log() { echo -e "${GREEN}[+]${NC} $1"; }
warn() { echo -e "${YELLOW}[!]${NC} $1"; }
error() { echo -e "${RED}[✗]${NC} $1"; }

# Check if running as root
if [[ $EUID -eq 0 ]]; then
   warn "Running as root. Some operations may need sudo."
fi

# Detect OS
detect_os() {
    if [[ -f /etc/os-release ]]; then
        . /etc/os-release
        OS=$ID
        VER=$VERSION_ID
    else
        error "Cannot detect OS"
        exit 1
    fi
    log "Detected: $OS $VER"
}

# Install system dependencies
install_deps() {
    log "Installing system dependencies..."
    sudo apt update
    sudo apt install -y curl wget git vim jq unzip ca-certificates gnupg lsb-release \
        software-properties-common apt-transport-https openssl build-essential
}

# Install Oh-My-Zsh
install_omz() {
    log "Installing Oh-My-Zsh..."
    if [[ -d "$HOME/.oh-my-zsh" ]]; then
        warn "Oh-My-Zsh already installed"
    else
        sh -c "$(curl -fsSL https://raw.github.com/ohmyzsh/ohmyzsh/master/tools/install.sh)" "" --unattended
    fi
}

# Install zsh plugins
install_zsh_plugins() {
    log "Installing zsh plugins..."
    local plugins_dir="${ZSH_CUSTOM:-$HOME/.oh-my-zsh/custom}/plugins"

    [[ ! -d "$plugins_dir/zsh-autosuggestions" ]] && \
        git clone https://github.com/zsh-users/zsh-autosuggestions "$plugins_dir/zsh-autosuggestions"

    [[ ! -d "$plugins_dir/zsh-syntax-highlighting" ]] && \
        git clone https://github.com/zsh-users/zsh-syntax-highlighting.git "$plugins_dir/zsh-syntax-highlighting"

    [[ ! -d "$plugins_dir/zsh-completions" ]] && \
        git clone https://github.com/zsh-users/zsh-completions "$plugins_dir/zsh-completions"
}

# Install tmux
install_tmux() {
    log "Installing tmux..."
    if ! command -v tmux &> /dev/null; then
        sudo apt install -y tmux
    fi
}

# Install TPM
install_tpm() {
    log "Installing tmux plugin manager..."
    [[ ! -d "$HOME/.tmux/plugins/tpm" ]] && \
        git clone https://github.com/tmux-plugins/tpm ~/.tmux/plugins/tpm
}

# Install Docker
install_docker() {
    log "Installing Docker..."
    if ! command -v docker &> /dev/null; then
        curl -fsSL https://get.docker.com | sh
        sudo usermod -aG docker $USER
    fi
}

# Install Node.js and pnpm
install_nodejs() {
    log "Installing Node.js and pnpm..."
    if ! command -v node &> /dev/null; then
        curl -fsSL https://deb.nodesource.com/setup_22.x | sudo bash -
        sudo apt install -y nodejs
    fi

    if ! command -v pnpm &> /dev/null; then
        npm install -g pnpm
    fi
}

# Create .zshrc
install_zshrc() {
    log "Installing .zshrc..."
    cat > "$HOME/.zshrc" << 'EOF'
# Path to Oh My Zsh
export ZSH="$HOME/.oh-my-zsh"
ZSH_THEME="robbyrussell"
plugins=(git docker docker-compose systemd ufw zsh-autosuggestions zsh-syntax-highlighting zsh-completions)
source $ZSH/oh-my-zsh.sh

# Environment
export EDITOR=vim
export VISUAL=vim
export LANG=en_US.UTF-8
export LC_ALL=en_US.UTF-8

# XDG
export XDG_CONFIG_HOME="$HOME/.config"
export XDG_DATA_HOME="$HOME/.local/share"
export XDG_CACHE_HOME="$HOME/.cache"

# Paths
typeset -U path PATH
path=(
  $HOME/.local/bin
  $HOME/bin
  /usr/local/bin
  $path
)

# Docker
export DOCKER_CONFIG="${DOCKER_CONFIG:-$HOME/.docker}"

# Aliases
alias ll='ls -lah'
alias gs='git status'
alias ga='git add'
alias gc='git commit'
alias gp='git push'
alias d='docker'
alias dc='docker compose'
alias dps='docker ps --format "table {{.Names}}\t{{.Status}}"'
EOF
    log "Created .zshrc"
}

# Create .tmux.conf
install_tmux_conf() {
    log "Installing .tmux.conf..."
    cat > "$HOME/.tmux.conf" << 'EOF'
# Terminal
set -g default-terminal "tmux-256color"
set -ag terminal-overrides ",xterm-256color:RGB"

# Basics
set -g history-limit 50000
set -g escape-time 10
set -g focus-events on
set -g set-clipboard on
set -g base-index 1
setw -g pane-base-index 1

# Mouse
set -g mouse on

# VI keys
setw -g mode-keys vi
bind -T copy-mode-vi v send -X begin-selection
bind -T copy-mode-vi y send -X copy-selection-and-cancel

# Prefix
unbind C-b
set -g prefix C-a
bind C-a send-prefix

# Key bindings
bind r source-file ~/.tmux.conf \; display-message "Config reloaded!"
bind | split-window -h -c "#{pane_current_path}"
bind - split-window -v -c "#{pane_current_path}"
bind c new-window -c "#{pane_current_path}"
bind x kill-pane
bind X kill-session
bind N new-session
bind '$' command-prompt -p "Rename session: " "rename-session '%%'"

# Status bar
set -g status-position bottom
set -g status-interval 5
set -g status-style bg=colour235,fg=white
set -g status-left "#[bg=colour39,bold] #S #[bg=colour235] "
set -g status-right "#[fg=colour250] %H:%M | %d %b "
setw -g window-status-current-format "#[bg=colour39,bold] #I:#W "
setw -g window-status-format "#[fg=colour241] #I:#W "

# Plugins
set -g @plugin "tmux-plugins/tpm"
set -g @plugin "tmux-plugins/tmux-sensible"
set -g @plugin "tmux-plugins/tmux-resurrect"
set -g @plugin "tmux-plugins/tmux-continuum"
set -g @plugin "tmux-plugins/tmux-prefix-highlight"
set -g @plugin "b0o/tmux-autoreload"

# Plugin options
set -g @continuum-restore "on"
set -g @continuum-save-interval "15"
set -g @resurrect-capture-pane-contents "on"
set -g @resurrect-dir "~/.tmux/resurrect"
set -g @prefix_highlight_show_copy_mode "on"
set -g @resurrect-save 'S'
set -g @resurrect-restore 'R'

# TPM
run "~/.tmux/plugins/tpm/tpm"
EOF
    log "Created .tmux.conf"
}

# Create .profile
install_profile() {
    log "Installing .profile..."
    cat > "$HOME/.profile" << 'EOF'
# Editor
export EDITOR=vim
export VISUAL=vim

# Locale
export LANG=en_US.UTF-8
export LC_ALL=en_US.UTF-8

# XDG
export XDG_CONFIG_HOME="$HOME/.config"
export XDG_DATA_HOME="$HOME/.local/share"
export XDG_CACHE_HOME="$HOME/.cache"

# Development paths
export PATH="$HOME/.local/bin:$HOME/bin:$PATH"
export PATH="/usr/local/bin:$PATH"

# Docker
export DOCKER_CONFIG="${DOCKER_CONFIG:-$HOME/.docker}"
EOF
    log "Created .profile"
}

# Main
main() {
    log "CortexOS Dotfiles Installer"
    echo "================================"

    detect_os
    install_deps
    install_omz
    install_zsh_plugins
    install_tmux
    install_tpm
    install_docker
    install_nodejs
    install_zshrc
    install_tmux_conf
    install_profile

    echo ""
    log "Installation complete!"
    echo ""
    echo "Next steps:"
    echo "  1. Restart your terminal or run: exec zsh"
    echo "  2. In tmux, press 'prefix + I' (Ctrl-a then I) to install plugins"
    echo "  3. See docs/INSTALL.md for full server setup"
    echo "  4. See docs/CONFIG.md for CLI tool configuration"
}

main "$@"
