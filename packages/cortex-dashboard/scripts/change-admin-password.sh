#!/usr/bin/env bash
set -euo pipefail

cat <<'MSG'
Cortex Dashboard now authenticates with Linux PAM.

Dashboard passwords are system account passwords. Change them on the host:

  sudo passwd <username>

Grant dashboard admin rights by adding the user to cortexos-admin or sudo:

  sudo usermod -aG cortexos-admin <username>

Users can also be managed through Cockpit, Webmin, or SSH.
MSG
