# CortexOS Rebuild Handoff - Incus Base Image

> **Operator session notes — historical record, not install instructions.**

Generated: 2026-05-28

Workspace: `/Users/heitor/Developer/github.com/bloodf/cortexos`

## Purpose

Continue the CortexOS rebuild from the Incus base image phase. The canonical plan is
`/Users/heitor/Developer/github.com/bloodf/cortexos/PLAN.md`; keep it updated after each
phase with decisions, status, validation evidence, risks, and next actions.

## Critical Safety Constraints

- Preserve and restore protected Hermes identities: `CIEUCPB`, `Netbook`, and `Cortex`.
- Do not revert unrelated dirty repo changes.
- Planned downtime is allowed, but do not casually remove, restart, or reconfigure protected
  Hermes services without a prepared validation path.
- Do not mark a phase complete without fresh evidence.

## Current State

- Phase 0 live inventory is complete.
  - Inventory artifact: `docs/rebuild/current-host-inventory.md`
- Backup gate is complete.
  - Backup directory: `/mnt/hdd/cortexos-backups/20260528T042259Z`
  - Known caveat: MySQL logical dump failed; a physical Docker volume fallback was captured.
- Host cleanup, dashboard/root-helper deployment, and AgentGateway rebuild are complete.
  - AgentGateway is now a Python central MCP proxy on `0.0.0.0:18800`.
- Incus foundation is complete.
  - Incus version: 6.0.5
  - File-backed ZFS image: `/mnt/hdd/incus-zfs.img`
  - Incus storage pool: `cortex-zfs`
  - Bridge: `incusbr0`, `<bridge-cidr>`, NAT enabled, IPv6 disabled
  - UFW rules were added for Incus DHCP, DNS, and routed egress.
  - Network smoke previously verified IPv4, default route, DNS, and HTTP egress.
- Incus base image phase is in progress and not complete.

## Fresh Evidence Before Handoff

The interrupted base-image execution is still running in Codex exec session `65987`.

Active command:

```bash
scripts/rebuild/apply.sh --phase incus-base-image --execute --backup-dir /mnt/hdd/cortexos-backups/20260528T042259Z
```

Latest observed output shows the build is still inside `apt` package downloads in the
temporary Incus builder and is still hitting intermittent Ubuntu mirror connectivity:

```text
Err:109 http://archive.ubuntu.com/ubuntu resolute/main amd64 javascript-common all 12+nmu1build1
  Unable to connect to archive.ubuntu.com:http: [IP: 172.66.152.176 80]
Err:120 http://archive.ubuntu.com/ubuntu resolute/universe amd64 node-popper2 all 2.11.2-9
  Unable to connect to archive.ubuntu.com:http: [IP: 172.66.152.176 80]
Get:111 http://security.ubuntu.com/ubuntu resolute-updates/main amd64 jq amd64 1.8.1-4ubuntu2 [72.4 kB]
Get:110 http://security.ubuntu.com/ubuntu resolute-updates/main amd64 libjq1 amd64 1.8.1-4ubuntu2 [146 kB]
```

This indicates the builder can reach `security.ubuntu.com`, but `archive.ubuntu.com` is
unstable from inside the Incus container.

Latest verification poll: 2026-05-28 12:31:49 -03. Session `65987` was still running.
The build had not completed, and the same mirror failure pattern continued:

```text
Err:130 http://archive.ubuntu.com/ubuntu resolute/main amd64 libxrender1 amd64 1:0.9.12-1build1
  Unable to connect to archive.ubuntu.com:http: [IP: 172.66.152.176 80]
Err:152 http://archive.ubuntu.com/ubuntu resolute/main amd64 python3-packaging all 26.0-1
  Unable to connect to archive.ubuntu.com:http: [IP: 172.66.152.176 80]
Get:137 http://security.ubuntu.com/ubuntu resolute-updates/main amd64 python3-tornado amd64 6.5.4-0.1ubuntu0.1 [306 kB]
```

Interpretation: the current blocker is still Ubuntu archive mirror connectivity from inside
the Incus builder, not a confirmed package or script syntax failure.

Repo state is heavily dirty because the rebuild implementation is in progress. `git status
--short` shows many planned deletions for retired systems plus new rebuild artifacts,
including:

- `PLAN.md`
- `docs/rebuild/`
- `scripts/rebuild/`
- `manifests/`
- `stacks/cortex-incus/`
- `stacks/cortex-dashboard-root-helper/`
- rebuilt `stacks/cortex-agentgateway/app.py`
- dashboard migrations and root-helper API files

Do not reset or clean this worktree.

## Key Files For Current Phase

- `scripts/rebuild/apply.sh`
- `stacks/cortex-incus/base-image-provision.sh`
- `stacks/cortex-incus/tmux.conf`
- `stacks/cortex-incus/zshrc`
- `stacks/cortex-incus/cortex-tmux`
- `stacks/cortex-incus/cortex-tailscale-up`
- `stacks/cortex-incus/cortex-host-health`
- `stacks/cortex-incus/host-services.env`
- `manifests/rebuild/tmux-plugins.txt`
- `PLAN.md`

## Current Script Behavior

The `incus-base-image` phase currently:

1. Deletes stale `cortex-base-smoke` and `cortex-base-build`.
2. Launches `images:ubuntu/26.04` as `cortex-base-build`.
3. Temporarily sets `zfs set sync=disabled cortex-zfs/containers/cortex-base-build`
   for build speed.
4. Pushes a repo archive into the builder and runs
   `/tmp/cortexos-incus/stacks/cortex-incus/base-image-provision.sh`.
5. Validates AI tools, tmux, zsh, Tailscale, and Cortex helper commands.
6. Resets the builder dataset to `sync=standard`.
7. Publishes:
   - `cortexos-base/ubuntu-26.04-20260528`
   - `cortexos-base/latest`
8. Launches and validates a smoke instance.
9. Deletes the smoke instance.

## Fixes Already Applied

- Incus ZFS storage registration now uses a pre-created sparse file and ZFS pool.
- Incus bridge UFW rules were added for DHCP, DNS, and routing.
- Temporary builder ZFS `sync=disabled` avoids very slow `dpkg` fsync behavior.
- Temporary `/usr/sbin/policy-rc.d` prevents package scripts from blocking on service
  startup inside the image build.
- Apt uses forced IPv4 and retry options.
- GitHub clones have retry logic plus codeload tarball fallback.
- Global npm package installs are done package-by-package with retry and timeout handling.

## Immediate Next Steps

1. Poll the active Codex exec session if available:

   ```text
   session_id: 65987
   ```

2. If the session is no longer available, inspect host state before rerunning:

   ```bash
   ssh -o BatchMode=yes -o ConnectTimeout=12 cortexos@cortexos.<your-tailnet>.ts.net '
     pgrep -af "apply.sh --phase incus-base-image|base-image-provision|apt-get|dpkg" || true
     sudo -n incus list --format table
     sudo -n incus image alias list | grep -E "cortexos-base/(latest|ubuntu-26.04)" || true
   '
   ```

3. If the build fails on mirror connectivity, patch narrowly. Preferred options:
   - add an apt mirror fallback for the builder,
   - split large apt installs into smaller retryable groups,
   - or rewrite apt sources to a more reliable Ubuntu mirror during image provisioning.

4. Before rerunning after any patch:

   ```bash
   bash -n stacks/cortex-incus/base-image-provision.sh scripts/rebuild/apply.sh
   shellcheck stacks/cortex-incus/base-image-provision.sh scripts/rebuild/apply.sh
   scripts/rebuild/apply.sh --phase incus-base-image --dry-run --backup-dir /mnt/hdd/cortexos-backups/20260528T042259Z
   ```

5. Rerun the phase:

   ```bash
   scripts/rebuild/apply.sh --phase incus-base-image --execute --backup-dir /mnt/hdd/cortexos-backups/20260528T042259Z
   ```

6. On success, verify protected host services:

   ```bash
   ssh -o BatchMode=yes -o ConnectTimeout=12 cortexos@cortexos.<your-tailnet>.ts.net '
     sudo -n incus image alias list | grep -E "cortexos-base/(latest|ubuntu-26.04)"
     sudo -n incus list --format table
     sudo -n systemctl is-active \
       hermes-profile@cieucpb.service \
       hermes-profile@netbook.service \
       hermes-gateway@cieucpb.service \
       hermes-gateway@netbook.service \
       hermes-gateway-cortex.service \
       hermes-dashboard.service \
       hermes-dashboard-proxy.service \
       9router.service \
       9router-docker-proxy.service \
       honcho-mcp.service \
       ollama.service \
       ollama-honcho-embeddings-proxy.service
   '
   ```

7. Update `PLAN.md` with exact evidence before moving to project instances.

## Next Project Instance Targets

After the base image is valid, create project Incus instances for:

- `mementry`
- `celebrar.me`
- `3guns`

These should be cloned fresh from GitHub `main`. Dirty host project state for `mementry`
and `3guns` is not intended to migrate.

## Completion Criteria For Current Phase

Do not mark the Incus base-image phase complete until all are true:

- `cortexos-base/latest` alias exists.
- Versioned `cortexos-base/ubuntu-26.04-20260528` alias exists.
- Base smoke instance validates expected tools and helper commands.
- Tailscale is installed and enabled in the image, but no tailnet identity is baked in.
- Tmux and oh-my-zsh setup is present.
- Protected Hermes and core host services are still active.
- `PLAN.md` records the validation evidence.
