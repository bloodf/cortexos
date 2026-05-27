#!/usr/bin/env bash
set -euo pipefail

PROJECT_NAME="${DEV_PROJECT_NAME:-project}"
COMPOSE_FILE="${DEV_COMPOSE_FILE:-docker-compose.dev.yml}"
K8S_MANIFEST="${DEV_K8S_MANIFEST:-k8s/dev/resources.yaml}"

usage() {
  cat <<'EOF'
Usage: scripts/dev-env.sh <command> [args...]

Commands:
  docker-up        Start isolated Docker Compose development services
  docker-down      Stop Docker Compose services and remove this run's volumes/images
  docker-status    Show Docker Compose services for this run
  k8s-up           Create namespace and apply local Kubernetes dev resources
  k8s-down         Delete this run's Kubernetes namespace
  k8s-status       Show pods/services in this run's namespace
  clean            Run docker-down and k8s-down
  env              Print resolved isolation environment
  with-docker -- <command...>  Start Docker, run command, always clean up
  with-k8s -- <command...>     Start Kubernetes, run command, always clean up
EOF
}

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
repo_root="$(cd "$script_dir/.." && pwd)"
cd "$repo_root"

sanitize() {
  printf '%s' "$1" | tr '[:upper:]' '[:lower:]' | sed -E 's/[^a-z0-9]+/-/g; s/^-+//; s/-+$//' | cut -c1-40
}

worktree_name="$(sanitize "$(basename "$repo_root")")"
run_id="$(sanitize "${CORTEX_RUN_ID:-local}")"
port_offset="$(printf '%s' "$repo_root" | cksum | awk '{print $1 % 1000}')"

export CORTEX_PROJECT="${CORTEX_PROJECT:-$PROJECT_NAME}"
export CORTEX_WORKTREE="${CORTEX_WORKTREE:-$worktree_name}"
export CORTEX_RUN_ID="$run_id"
export COMPOSE_PROJECT_NAME="${COMPOSE_PROJECT_NAME:-${PROJECT_NAME}-${CORTEX_WORKTREE}-${CORTEX_RUN_ID}}"
export KUBE_NAMESPACE="${KUBE_NAMESPACE:-dev-${PROJECT_NAME}-${CORTEX_WORKTREE}-${CORTEX_RUN_ID}}"
export DEV_POSTGRES_PORT="${DEV_POSTGRES_PORT:-$((15432 + port_offset))}"
export DEV_REDIS_PORT="${DEV_REDIS_PORT:-$((16379 + port_offset))}"
export DEV_MINIO_PORT="${DEV_MINIO_PORT:-$((19000 + port_offset))}"
export DEV_MINIO_CONSOLE_PORT="${DEV_MINIO_CONSOLE_PORT:-$((19001 + port_offset))}"
export DEV_MAILPIT_SMTP_PORT="${DEV_MAILPIT_SMTP_PORT:-$((11025 + port_offset))}"
export DEV_MAILPIT_HTTP_PORT="${DEV_MAILPIT_HTTP_PORT:-$((18025 + port_offset))}"

require() {
  command -v "$1" >/dev/null 2>&1 || {
    printf 'Missing required command: %s\n' "$1" >&2
    exit 127
  }
}

compose() {
  require docker
  docker compose -f "$COMPOSE_FILE" "$@"
}

docker_clean_labels() {
  docker ps -a --filter "label=cortexos.project=$CORTEX_PROJECT" --filter "label=cortexos.worktree=$CORTEX_WORKTREE" --filter "label=cortexos.run=$CORTEX_RUN_ID" -q | xargs -r docker rm -f
  docker volume ls --filter "label=cortexos.project=$CORTEX_PROJECT" --filter "label=cortexos.worktree=$CORTEX_WORKTREE" --filter "label=cortexos.run=$CORTEX_RUN_ID" -q | xargs -r docker volume rm -f
  docker network ls --filter "label=cortexos.project=$CORTEX_PROJECT" --filter "label=cortexos.worktree=$CORTEX_WORKTREE" --filter "label=cortexos.run=$CORTEX_RUN_ID" -q | xargs -r docker network rm
  docker images --filter "label=cortexos.project=$CORTEX_PROJECT" --filter "label=cortexos.worktree=$CORTEX_WORKTREE" --filter "label=cortexos.run=$CORTEX_RUN_ID" -q | xargs -r docker rmi -f
}

docker_up() {
  compose up -d --remove-orphans
  compose ps
}

docker_down() {
  compose down -v --remove-orphans --rmi all
  docker_clean_labels
}

k8s_render() {
  sed -e "s/__PROJECT__/$CORTEX_PROJECT/g" -e "s/__WORKTREE__/$CORTEX_WORKTREE/g" -e "s/__RUN_ID__/$CORTEX_RUN_ID/g" "$K8S_MANIFEST"
}

k8s_up() {
  require kubectl
  kubectl create namespace "$KUBE_NAMESPACE" --dry-run=client -o yaml | kubectl apply -f -
  kubectl label namespace "$KUBE_NAMESPACE" "cortexos.project=$CORTEX_PROJECT" "cortexos.worktree=$CORTEX_WORKTREE" "cortexos.run=$CORTEX_RUN_ID" --overwrite
  k8s_render | kubectl -n "$KUBE_NAMESPACE" apply -f -
  kubectl -n "$KUBE_NAMESPACE" label all --all "cortexos.project=$CORTEX_PROJECT" "cortexos.worktree=$CORTEX_WORKTREE" "cortexos.run=$CORTEX_RUN_ID" --overwrite >/dev/null
  kubectl -n "$KUBE_NAMESPACE" get pods,svc
}

k8s_down() {
  require kubectl
  kubectl delete namespace "$KUBE_NAMESPACE" --ignore-not-found=true
}

print_env() {
  cat <<EOF
CORTEX_PROJECT=$CORTEX_PROJECT
CORTEX_WORKTREE=$CORTEX_WORKTREE
CORTEX_RUN_ID=$CORTEX_RUN_ID
COMPOSE_PROJECT_NAME=$COMPOSE_PROJECT_NAME
KUBE_NAMESPACE=$KUBE_NAMESPACE
DEV_POSTGRES_PORT=$DEV_POSTGRES_PORT
DEV_REDIS_PORT=$DEV_REDIS_PORT
DEV_MINIO_PORT=$DEV_MINIO_PORT
DEV_MINIO_CONSOLE_PORT=$DEV_MINIO_CONSOLE_PORT
DEV_MAILPIT_SMTP_PORT=$DEV_MAILPIT_SMTP_PORT
DEV_MAILPIT_HTTP_PORT=$DEV_MAILPIT_HTTP_PORT
EOF
}

cmd="${1:-help}"
shift || true

case "$cmd" in
  docker-up) docker_up ;;
  docker-down) docker_down ;;
  docker-status) compose ps ;;
  k8s-up) k8s_up ;;
  k8s-down) k8s_down ;;
  k8s-status) require kubectl; kubectl -n "$KUBE_NAMESPACE" get pods,svc ;;
  clean) docker_down || true; k8s_down || true ;;
  env) print_env ;;
  with-docker) [[ "${1:-}" == "--" ]] && shift; docker_up; trap 'docker_down' EXIT; "$@" ;;
  with-k8s) [[ "${1:-}" == "--" ]] && shift; k8s_up; trap 'k8s_down' EXIT; "$@" ;;
  help|-h|--help) usage ;;
  *) usage >&2; exit 2 ;;
esac
