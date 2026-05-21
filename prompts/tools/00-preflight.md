# 00 — Preflight

## Purpose

Verify the host is ready for the Hermes + Honcho + Paperclip stack before any
install spoke mutates the machine.

## Checks

```bash
set -euo pipefail

lsb_release -a || true
nproc
free -h
df -h /

for bin in git curl jq node pnpm docker tailscale sops age; do
  command -v "$bin" >/dev/null || { echo "missing: $bin"; exit 2; }
done

node -v
pnpm -v
sudo -v
```

## State

```bash
install -d -m 0700 .secrets
python3 - <<'PY'
import json, pathlib, datetime
path = pathlib.Path(".secrets/.setup-state.json")
state = json.loads(path.read_text()) if path.exists() else {}
state["preflight"] = {
    "stack": "hermes-honcho-paperclip",
    "checked_at": datetime.datetime.utcnow().isoformat() + "Z",
}
path.write_text(json.dumps(state, indent=2) + "\n")
path.chmod(0o600)
PY
```

## CHECKPOINT 1

Confirm the host has required tooling and `.secrets/.setup-state.json` records
`stack: hermes-honcho-paperclip`.

## Next

→ `prompts/tools/10-os-hardening.md`
