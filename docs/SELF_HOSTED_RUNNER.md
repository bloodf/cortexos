# Self-hosted runner — cortexos-test

The `real-host-smoke` job in `.github/workflows/ci.yml` runs on a
self-hosted runner with the label `cortexos-test`. This file documents
the one-time setup.

## One-time: register the runner

On the VM (currently `cortexos-test`, OrbStack Ubuntu 24.04 arm64):

```bash
# 1. Download + extract the runner
mkdir -p ~/actions-runner && cd ~/actions-runner
curl -o actions-runner-linux-arm64-2.319.1.tar.gz -L \
  https://github.com/actions/runner/releases/download/v2.319.1/actions-runner-linux-arm64-2.319.1.tar.gz
tar xzf ./actions-runner-linux-arm64-2.319.1.tar.gz

# 2. Get a registration token from the repo settings:
#    Settings → Actions → Runners → New self-hosted runner → Linux ARM64
#    (do NOT commit the token)
./config.sh --url https://github.com/bloodf/cortexos \
            --token <REGISTRATION_TOKEN> \
            --labels cortexos-test \
            --name cortexos-test-$(hostname) \
            --unattended

# 3. Install + start as a systemd service
sudo ./svc.sh install
sudo ./svc.sh start
```

The runner labels **must** include `cortexos-test` — that label is what
the `runs-on:` line matches.

## Required runtime on the host

- Ubuntu 24.04 arm64 (the OrbStack VM we already use)
- `node` 24.x + `pnpm` 11.x
- `systemd` (the runner is a systemd service)
- `sudo` (the job runs `sudo systemctl restart cortex-dashboard.service`)
- `psql` client (the smoke test calls `psql` to count session rows)
- `curl` (the smoke test calls the dashboard)
- The dashboard systemd unit + Postgres 16 + the `dashboard` DB user —
  all installed in the real-host validation phase. See
  `packages/dashboard/docs/RELEASE_NOTES.md` v0.4.0 + the A1 release
  notes for the install order.

## Required repo secret

`DB_PASSWORD` — the password the dashboard passes to Postgres 16 for
the `dashboard` user. Set under Settings → Secrets and variables →
Actions → New repository secret.

Do **not** put the password in plain text in the workflow yaml.

## Verifying the runner is registered

On the VM:

```bash
sudo ./svc.sh status   # should say "active (running)"
```

In the GitHub UI: Settings → Actions → Runners should list
`cortexos-test-<hostname>` with the green "Idle" indicator.

## Why this runner exists

The CI unit suite (`pnpm exec vitest run`) passes even when the
real-host integration is broken — we discovered 4 production-blocking
bugs this way (authenticate-pam ESM/callback/serviceName,
is_admin vs isAdmin User shape mismatch, etc.). The
`scripts/smoke/real-host.sh` test catches all of them. The job is
`continue-on-error: true` so a missing runner does not block PRs, but
on main-branch pushes it surfaces the regression before the next
release tag.
