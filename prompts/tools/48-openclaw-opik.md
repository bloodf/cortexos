# OpenClaw ↔ Opik Plugin (latest)

## Purpose

Install the `comet-ml/opik-openclaw` plugin to forward all OpenClaw LLM traces to the Opik observability platform for evaluation and monitoring.

## Prerequisites

- `40-openclaw.md` completed.
- `35-opik.md` completed (Opik API running at `localhost:5000`).

## Distro selection

```bash
source scripts/pkg.sh
echo "OS family: $(pkg_family) $(pkg_version)"
: "${CORTEX_OS_FAMILY:?run prompts/os/00-os-selection.md first}"
```

## CHECKPOINT 1

Operator: confirm Opik API is healthy (`curl -s http://localhost:5000/api/v1/health`). Type "confirmed" to proceed.

## Install

```bash
git clone https://github.com/comet-ml/opik-openclaw /tmp/opik-openclaw
cd /tmp/opik-openclaw
npm install
```

Snapshot upstream README:

```bash
test -f docs/external/opik-openclaw.snapshot.md && echo "OK" || \
  (curl -fsSL https://raw.githubusercontent.com/comet-ml/opik-openclaw/HEAD/README.md \
    > docs/external/opik-openclaw.snapshot.md && \
   sed -i '1s/^/<!-- Snapshot of upstream opik-openclaw at probe time. NOT a version pin. Operator reinstalls latest upstream on each fresh install. -->\n/' \
    docs/external/opik-openclaw.snapshot.md)
```

Register:

```bash
openclaw plugins install /tmp/opik-openclaw
```

## Configure

```bash
openclaw plugins configure opik-openclaw \
  --opik-url "http://127.0.0.1:5000" \
  --trace-all true
sudo systemctl reload openclaw
```

## Verify

```bash
openclaw plugins list | grep opik-openclaw
# Trigger a test trace
openclaw trace test
```

Expected: plugin active; trace appears in Opik UI at `http://localhost:5173`.

## CHECKPOINT 2

Operator: confirm `opik-openclaw` plugin is active and test trace appears in Opik UI. Type "confirmed" to proceed.

## Next

→ `prompts/tools/49-openclaw-account-ops.md`
