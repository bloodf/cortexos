# Self-hosted runner — cortexos-test

The `real-host-smoke` job in `.github/workflows/ci.yml` runs on a
self-hosted runner with the label `cortexos-test`. This file documents
the one-time setup.

## One-time: register the runner

The runner registration needs a fresh registration token from the
GitHub repo settings UI. The token is shown once and expires in 1
hour, so it cannot be committed to the repo.

### Step 1 — Mint a registration token

Open the repo on GitHub:

  Settings → Actions → Runners → **New self-hosted runner** →
  Operating system: **Linux**, Architecture: **ARM64**

GitHub shows a `Registration token` field with a copy button. Copy
it (it will look like `ABCD1234EFGH5678IJKL`). Paste it into a
local file on your machine (NOT the repo) — for example
`~/actions-runner.token`.

### Step 2 — Install the runner on the VM

SSH into `cortexos-test` and run:

```bash
# Download + extract the runner
mkdir -p ~/actions-runner && cd ~/actions-runner
curl -o actions-runner-linux-arm64-2.319.1.tar.gz -L \
  https://github.com/actions/runner/releases/download/v2.319.1/actions-runner-linux-arm64-2.319.1.tar.gz
tar xzf ./actions-runner-linux-arm64-2.319.1.tar.gz

# Read the token (scp'd over or pasted)
TOKEN=$(cat ~/actions-runner.token)

# Configure + install as a systemd service
./config.sh --url https://github.com/bloodf/cortexos \
            --token "$TOKEN" \
            --labels cortexos-test \
            --name cortexos-test-$(hostname) \
            --unattended \
            --replace
sudo ./svc.sh install
sudo ./svc.sh start

# Wipe the token file (it's a one-shot secret)
rm -f ~/actions-runner.token
```

The runner labels **must** include `cortexos-test` — that label is what
the `runs-on: [self-hosted, cortexos-test]` line in
`.github/workflows/ci.yml` matches.

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

## Smoke-test the runner end-to-end

After the runner is up, the cleanest way to verify it picks up jobs
is to push a commit to `main` and watch the workflow run:

1. `gh run watch --exit-status --job real-host-smoke` from the repo
2. Confirm the job log shows the runner picking up the
   `real-host-smoke` job, running `pnpm install`, restarting
   `cortex-dashboard.service`, and calling `scripts/smoke/real-host.sh`.
3. The smoke script should report `24 passed, 0 failed` (assuming
   the DB env vars are configured on the host).

If the job never gets picked up, check the GitHub UI
Settings → Actions → Runners for the runner's status:
green "Idle" / "Active" indicator = OK; red "Offline" = the systemd
service died.

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
