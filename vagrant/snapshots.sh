#!/usr/bin/env bash
# vagrant/snapshots.sh — thin wrapper around `vagrant snapshot`.
#
# Subcommands:
#   take NAME       Snapshot every running VM with the given tag.
#   restore NAME    Restore every VM that has a snapshot matching NAME.
#   list            List snapshots per VM.
#   prune           Keep last 5 snapshots per VM, delete older ones.

set -euo pipefail

KEEP=5

usage() {
  cat <<'USAGE'
usage: vagrant/snapshots.sh <take|restore|list|prune> [NAME]

  take NAME     vagrant snapshot push --name NAME on each defined VM
  restore NAME  vagrant snapshot restore NAME on each VM that has it
  list          list snapshots for every defined VM
  prune         keep last 5 snapshots per VM, delete the rest
USAGE
}

# Vagrant defines machines in the active Vagrantfile. Use status to list.
list_vms() {
  vagrant status --machine-readable \
    | awk -F, '$3 == "state" { print $2 }'
}

snapshots_for() {
  local vm="$1"
  vagrant snapshot list "${vm}" 2>/dev/null \
    | sed -E 's/^==>\s.*//; /^$/d'
}

cmd="${1:-}"
shift || true

case "${cmd}" in
  take)
    name="${1:-}"
    [ -n "${name}" ] || { usage; exit 2; }
    for vm in $(list_vms); do
      printf '[snapshot] take %s on %s\n' "${name}" "${vm}"
      vagrant snapshot save "${vm}" "${name}" || true
    done
    ;;

  restore)
    name="${1:-}"
    [ -n "${name}" ] || { usage; exit 2; }
    for vm in $(list_vms); do
      if snapshots_for "${vm}" | grep -qx "${name}"; then
        printf '[snapshot] restore %s on %s\n' "${name}" "${vm}"
        vagrant snapshot restore "${vm}" "${name}"
      fi
    done
    ;;

  list)
    for vm in $(list_vms); do
      printf '== %s ==\n' "${vm}"
      snapshots_for "${vm}" || true
    done
    ;;

  prune)
    for vm in $(list_vms); do
      mapfile -t snaps < <(snapshots_for "${vm}")
      count="${#snaps[@]}"
      if [ "${count}" -le "${KEEP}" ]; then
        printf '[snapshot] %s has %d snapshots; nothing to prune\n' "${vm}" "${count}"
        continue
      fi
      to_drop=$(( count - KEEP ))
      for i in $(seq 0 $(( to_drop - 1 ))); do
        s="${snaps[$i]}"
        printf '[snapshot] prune %s on %s\n' "${s}" "${vm}"
        vagrant snapshot delete "${vm}" "${s}" || true
      done
    done
    ;;

  ""|-h|--help|help)
    usage
    ;;

  *)
    usage
    exit 2
    ;;
esac
