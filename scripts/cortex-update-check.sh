#!/usr/bin/env bash
set -euo pipefail

json_escape() { python3 -c 'import json,sys; print(json.dumps(sys.stdin.read()))'; }
section() { printf '\n== %s ==\n' "$1"; }

tmp=$(mktemp)
trap 'rm -f "$tmp"' EXIT
{
  echo '{'
  echo '  "apt": ';
  (apt list --upgradable 2>/dev/null || true) | json_escape
  echo ','
  echo '  "docker": ';
  (docker images --format '{{.Repository}}:{{.Tag}} {{.ID}}' 2>/dev/null || true) | json_escape
  echo ','
  echo '  "snap": ';
  (snap refresh --list 2>/dev/null || true) | json_escape
  echo ','
  echo '  "npm_global": ';
  (npm outdated -g --json 2>/dev/null || true) | json_escape
  echo ','
  echo '  "homebrew": ';
  (eval "$(/home/linuxbrew/.linuxbrew/bin/brew shellenv 2>/dev/null || true)"; brew outdated 2>/dev/null || true) | json_escape
  echo ','
  echo '  "pip_venvs": ';
  (for v in /opt/cortexos/stacks/*/.venv/bin/pip; do [ -x "$v" ] && "$v" list --outdated; done 2>/dev/null || true) | json_escape
  echo
  echo '}'
} > "$tmp"

section "APT"; apt list --upgradable 2>/dev/null || true
section "Docker images"; docker images --format 'table {{.Repository}}\t{{.Tag}}\t{{.ID}}\t{{.CreatedSince}}' 2>/dev/null || true
section "Snap"; snap refresh --list 2>/dev/null || true
section "npm -g"; npm outdated -g 2>/dev/null || true
section "Homebrew"; (eval "$(/home/linuxbrew/.linuxbrew/bin/brew shellenv 2>/dev/null || true)"; brew outdated 2>/dev/null || true)
section "pip venvs"; for v in /opt/cortexos/stacks/*/.venv/bin/pip; do [ -x "$v" ] && "$v" list --outdated; done 2>/dev/null || true
section "JSON report"; cat "$tmp"
