# WP-14 — API: System / Network / Processes / Storage

- **Wave:** 1
- **Depends-on:** WP-01
- **Parallel-safe-with:** WP-10, WP-11, WP-12, WP-13, WP-15, WP-16, WP-17, WP-18, WP-19, WP-20, WP-21
- **Owns (edit only these):**
  - `packages/dashboard-next/src/server/system/` (except `systemd.ts` which is WP-13)
  - `packages/dashboard-next/src/routes/api/system/`
  - `packages/dashboard-next/src/routes/api/network/`
  - `packages/dashboard-next/src/routes/api/processes/`
  - `packages/dashboard-next/src/routes/api/storage/`
- **Do NOT touch:** `src/server/system/systemd.ts` (WP-13), `src/server/db/`, `src/server/define-api-route.ts`, any other WP's folder

## Objective

Port the four system-level read endpoints from the legacy SvelteKit app. All four are auth-gated (`any`) and read-only — no DB, no mutation. Key constraints from the contract: `/api/network` returns **only physical NICs** (filtered by `/sys/class/net/*/device` symlink existence); `/api/storage` returns **only real disks** (lsblk type=disk) and mounts excluding tmpfs/devtmpfs/squashfs. No mock data — on a non-Linux host return real empty-states (`{interfaces:[]}`, `{processes:[]}`, etc).

## Read first

- **Legacy handlers (primary source):**
  - `packages/dashboard/src/routes/api/system/+server.ts` — full implementation: `getCpuPercent()` (reads `/proc/stat`, delta between calls), `getMemory()` (os module), `getDrives()` (`lsblk -J -b -o NAME,MODEL,SIZE,TYPE,MOUNTPOINT` → walk blockdevices for type=`disk`), `getMounts()` (`df -B1 -T --exclude-type=tmpfs --exclude-type=devtmpfs --exclude-type=squashfs`), `getSensors()` (reads `/sys/class/thermal/*` and `/sys/class/hwmon/*`), `collectSystem()`
  - `packages/dashboard/src/routes/api/network/+server.ts` — `isPhysicalInterface(name)` (checks `fs.accessSync('/sys/class/net/${name}/device')`), reads `/proc/net/dev`, computes delta rx/tx kbps between calls using module-level `prev` Map
  - `packages/dashboard/src/routes/api/processes/+server.ts` — `execFile('ps', ['aux', '--no-header'])`, parses columns: user(0), pid(1), cpu(2), mem(3), command(10+)
- **Contract section:** `01-API-CONTRACT.md §System / network / processes / storage (WP-14)`
- **Types to define locally** (the legacy app uses `$lib/types/dashboard`; replicate these in `src/server/system/types.ts`): `SystemData`, `MachineSensor`, `DriveInfo`, `MountInfo`, `NetworkInterface`, `NetworkData`, `ProcessInfo`

## Steps

1. **Create `src/server/system/readers.ts`** — consolidates the system-level readers. Port these functions verbatim from the legacy handler, updating only Node built-in imports:

   ```ts
   import os from 'node:os';
   import fs from 'node:fs';
   import { execFile } from 'node:child_process';
   import { promisify } from 'node:util';
   ```

   Functions to port:
   - `getCpuPercent()` — module-level `prevCpu` state; reads `/proc/stat`, computes delta idle/total
   - `getMemory()` → `{ total, used, percent }`
   - `getDrives()` — `lsblk -J -b -o NAME,MODEL,SIZE,TYPE,MOUNTPOINT`; walk `blockdevices` recursively, collect nodes where `type === 'disk'`
   - `getMounts()` — `df -B1 -T --exclude-type=tmpfs --exclude-type=devtmpfs --exclude-type=squashfs`; parse 7-column output (filesystem, type, total, used, free, pct, mount)
   - `getSensors()` — reads `/sys/class/thermal/thermal_zone*/type` + `/temp`; reads `/sys/class/hwmon/*/temp*_input`, `fan*_input`, `in*_input`; returns `{ cpuTemperature, temperatures, fans, voltages }`
   - `collectSystem()` — calls all four above in parallel, merges mount info into drives

2. **Create `src/server/system/network.ts`** — port network reader:
   - Module-level `prev = new Map<string, {rx,tx,ts}>()` for delta kbps computation
   - `isPhysicalInterface(name: string): boolean` — `fs.accessSync('/sys/class/net/${name}/device')`, return true if no throw, false on error
   - `readNetworkInterfaces()` — reads `/proc/net/dev` line by line (skip first 2 header lines), splits on `:`, filters `isPhysicalInterface(name)`, parses 16 columns (rx bytes at col 0, tx bytes at col 8), computes delta kbps vs prev sample

3. **Create `src/server/system/processes.ts`** — port process reader:
   - `readProcesses()` — `execFile('ps', ['aux', '--no-header'])`, parse lines: `user=cols[0]`, `pid=parseInt(cols[1])`, `cpu=parseFloat(cols[2])`, `mem=parseFloat(cols[3])`, `command=cols.slice(10).join(' ')`

4. **Create `src/server/system/types.ts`** — local type definitions matching legacy `$lib/types/dashboard` shapes needed by the routes. Only define what these 4 routes return; do not invent extras.

5. **Declare `/api/system` route:**

   `src/routes/api/system/index.ts`:
   ```
   GET /api/system — auth: any → SystemData (cpu, memory, drives, mounts, load, uptime, sensors)
   ```
   Calls `collectSystem()`. On any error, return a safe empty-state (don't let one failing probe crash the whole response — each sub-reader already catches internally).

6. **Declare `/api/network` route:**

   `src/routes/api/network/index.ts`:
   ```
   GET /api/network — auth: any → {interfaces: NetworkInterface[]}
   ```
   Calls `readNetworkInterfaces()`. Empty array on error.
   **Critical:** only physical NICs (those with `/sys/class/net/<name>/device`). Virtual interfaces (lo, docker0, veth*, br-*, incusbr0, tailscale0) are excluded because they lack the `device` symlink.

7. **Declare `/api/processes` route:**

   `src/routes/api/processes/index.ts`:
   ```
   GET /api/processes — auth: any → {processes: ProcessInfo[]}
   ```
   Calls `readProcesses()`. Empty array on error.

8. **Declare `/api/storage` route:**

   `src/routes/api/storage/index.ts`:
   ```
   GET /api/storage — auth: any → {disks: DriveInfo[], mounts: MountInfo[]}
   ```
   Calls `getDrives()` and `getMounts()` from `readers.ts`. Returns only physical disks (type=disk from lsblk) and mounts excluding virtual filesystems.

   Note: `/api/system` already returns drives + mounts. The `/api/storage` endpoint is a dedicated sub-resource exposing the same data in isolation per the contract. Reuse the same readers.

9. **Auth / audit:** all four use `defineApiRoute` with `auth: 'any'`, appropriate `surface` (`'system'`) and `action` names (`'system.read'`, `'network.read'`, `'processes.list'`, `'storage.read'`). No rate-limit overrides (inherit authed default 10/min).

## Acceptance criteria

- [ ] `GET /api/system` returns `{cpu, memory:{total,used,percent}, drives:[], mounts:[], load:[],uptime:number, sensors:{cpuTemperature,temperatures,fans,voltages}}`; on Linux host, `drives` and `mounts` are non-empty
- [ ] `GET /api/network` returns only physical NICs — `lo`, `docker0`, `veth*`, `incusbr0`, `tailscale0` are absent; on a host with an Ethernet NIC (e.g. `eth0`, `eno1`) it appears
- [ ] `GET /api/processes` returns a list with at least PID 1; all entries have `pid`, `user`, `command`, `cpu`, `mem`
- [ ] `GET /api/storage` returns `{disks, mounts}`; no tmpfs/devtmpfs/squashfs mounts appear
- [ ] All endpoints return valid empty-states when called on a non-Linux host (no crash, no mock data)
- [ ] `pnpm --filter @cortexos/dashboard-next typecheck` passes
- [ ] No edits outside OWNS

## Verification commands

```bash
pnpm --filter @cortexos/dashboard-next typecheck

curl -s http://localhost:3080/api/system | jq '{cpu, uptime, mounts_count:.mounts|length}'

# Physical NIC filter — expect no virtual interfaces
curl -s http://localhost:3080/api/network | jq '[.interfaces[].name] | map(select(test("^(lo|docker|veth|br-|incus|tailscale)")))'
# expect []

curl -s http://localhost:3080/api/processes | jq '.processes|length'

# Storage — no tmpfs
curl -s http://localhost:3080/api/storage | jq '[.mounts[].filesystem] | map(select(test("tmpfs|devtmpfs|squashfs|overlay")))'
# expect []

# Linux manual cross-check
lsblk -J -b -o NAME,MODEL,SIZE,TYPE | jq '[.blockdevices[] | select(.type=="disk") | .name]'
cat /proc/net/dev
```

## Notes / gotchas

- **Physical NIC detection** — the gate is `fs.accessSync('/sys/class/net/${name}/device')`. This symlink exists ONLY for real hardware (PCI/USB NICs). `lo` has no `device` symlink. Virtual interfaces created by Docker, Incus, and Tailscale also lack it. This is the same check in legacy `network/+server.ts` — port it verbatim.
- **Physical disk filter** — lsblk `type === 'disk'` excludes partitions (`part`), loop devices (`loop`), LVM (`lvm`). The recursive `walk()` of `blockdevices` collects only top-level `disk` nodes; partitions under `children` are visited but not collected.
- **Mount exclusions** — `df --exclude-type=tmpfs --exclude-type=devtmpfs --exclude-type=squashfs` handles most virtuals. Overlay filesystems (Docker layers) may still appear if Docker is running; they have `overlay` as filesystem type. If they appear, add `--exclude-type=overlay`. Check the legacy `getMounts()` for the exact flags used.
- **`getCpuPercent` delta state** — the module-level `prevCpu` variable means the first call always returns `0` (no prior sample). Subsequent calls return the real delta. This is the correct legacy behaviour — port it without changing.
- **execFile timeouts** — `lsblk`: default; `df`: default; `ps aux`: default. Add `timeout: 10_000` and `maxBuffer: 4 * 1024 * 1024` for safety, matching the legacy pattern.
- **No DB dependency** — this WP needs only WP-01. No DB queries.
- **No mock data** — if `lsblk` or `df` fails (non-Linux), return `[]`. Never return fabricated disk data.
- **`/proc/net/dev` format** — header is 2 lines; data lines: `  iface:  rx_bytes rx_pkts rx_errs rx_drop rx_fifo rx_frame rx_compressed rx_multicast tx_bytes ...`. rx_bytes is column 0, tx_bytes is column 8 of the data portion (after the colon split).
