# 70 - Dashboard

The dashboard is the LAN/tailnet control console for the rebuilt host. It runs
as a **native systemd service** (`cortex-dashboard.service`) built on the host —
there is no container, no Docker Compose, no image. Authentication is **Linux
PAM**: operators log in with an OS account, and admin rights derive from OS
group membership.

Required surfaces:

- Host service catalog from rebuild migrations.
- Protected Hermes visibility.
- Incus/project visibility.
- Root-helper command execution with audit metadata.
- Monitoring and backup evidence.

## Runtime model

- Unit: `cortex-dashboard.service` (template `templates/systemd/cortex-dashboard.service`,
  rendered by `scripts/ops/cortex-render-units.sh`).
- Runs as `root`, `WorkingDirectory=/opt/cortexos/packages/dashboard`.
- `ExecStartPre` runs `node scripts/migrate.js` (fatal) then `node scripts/dynamic-seed.js`
  (best-effort), mirroring the retired `docker-entrypoint.sh`.
- `ExecStart=/usr/bin/node server.js`, `EnvironmentFile=/opt/cortexos/.secrets/dashboard.env`,
  `HOSTNAME=0.0.0.0`, `PORT=3080`.
- Built artifacts the unit runs: `server.js` + `.next` + `node_modules` under
  `packages/dashboard/`.

## Prerequisites

The host must have (installed via `scripts/pkg.sh`, never raw `apt-get`):

- `node` and `npm` (the dashboard targets Node 22).
- `build-essential` — toolchain for the native modules (`node-gyp`).
- `libpam0g-dev` — PAM headers required to build `authenticate-pam`.

> STOP — checkpoint. Confirm `node --version` reports v22+, that
> `build-essential` and `libpam0g-dev` are installed, and that the operator has
> pushed the repo to `/opt/cortexos` (via the laptop bootstrap
> `git archive | ssh tar -x`). Do not proceed until the source tree exists at
> `/opt/cortexos/packages/dashboard`.

## Build

Build natively on the host with the build script:

```bash
sudo -u cortexos bash scripts/ops/cortex-dashboard-build.sh
```

The script:

1. `npm install --ignore-scripts` per package (avoids the husky / pnpm-workspace
   `prepare` conflict on the host), then `npm rebuild esbuild authenticate-pam`
   for the native bits.
2. Materializes `@cortexos/audit` as a real directory and hoists its runtime deps.
3. `next build` (`npm run build:next`).
4. esbuilds the custom `server.ts` → `server.js`.
5. Generates the Turbopack external-module shims + the `pg` shim so
   `node server.js` resolves at runtime.

Output: `packages/dashboard/server.js`, `.next/`, `node_modules/`.

## Render and install the unit

```bash
sudo bash scripts/ops/cortex-render-units.sh cortex-dashboard.service
sudo systemctl enable --now cortex-dashboard.service
```

`cortex-render-units.sh` substitutes `{CORTEX_ROOT}` / `{CORTEX_SECRETS_DIR}`
placeholders and installs the rendered unit into `/etc/systemd/system`, then
runs `daemon-reload`. The `EnvironmentFile` at
`/opt/cortexos/.secrets/dashboard.env` (mode `0600`) must already exist.

## Verify

```bash
systemctl status cortex-dashboard.service
journalctl -u cortex-dashboard.service -n 50 --no-pager
curl -fsS -o /dev/null -w '%{http_code}\n' http://127.0.0.1:3080/en/login   # expect 200
```

PAM login check — log in through the UI with an **OS account** that belongs to
`cortexos-admin` or `sudo`; that session must show admin surfaces. A non-admin
OS account must authenticate but see no admin actions.

> STOP — checkpoint. The login page must return `200`, the unit must be
> `active (running)`, and at least one admin PAM login must succeed before this
> step is considered complete.

## Validation (local / CI)

```bash
pnpm --dir packages/dashboard test
pnpm --dir packages/dashboard run build:next
```
