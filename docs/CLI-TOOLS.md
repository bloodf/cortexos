# CLI Tools

CortexOS ships with several CLI tools for host operations.

## Available Tools

### `scripts/pkg.sh`
Package management wrapper. Auto-detects Ubuntu/Debian and exports `pkg_family`, `pkg_version`, `pkg_install`.

```bash
source scripts/pkg.sh
pkg_install docker-ce docker-ce-cli
```

### `scripts/ops/cortex-render-units.sh`
Renders systemd unit templates into `/etc/systemd/system/`.

```bash
sudo bash scripts/ops/cortex-render-units.sh cortex-dashboard.service
```

### `scripts/ops/cortex-backup.sh`
Backs up databases and config to a timestamped archive.

```bash
sudo bash scripts/ops/cortex-backup.sh
```

### `scripts/ops/cortex-auto-update.sh`
Auto-update script for unattended security patches.

### `scripts/ci-local.sh`
Local CI runner — runs all gates that run in GitHub Actions.

```bash
scripts/ci-local.sh          # all gates
scripts/ci-local.sh --fast   # skip slow gates
```

### `scripts/smoke/real-host.sh`
Smoke test run on the target host after installation.

```bash
sudo bash scripts/smoke/real-host.sh
```

### `scripts/incus-create-project.sh`
Interactive Incus project creator.

```bash
sudo bash scripts/incus-create-project.sh
```

## Adding New Tools

Place new scripts under `scripts/` or `scripts/ops/`. Follow conventions:
- Use `#!/usr/bin/env bash`
- Use `set -euo pipefail`
- Include a header comment explaining purpose and usage
- Add tests if the script is critical-path
