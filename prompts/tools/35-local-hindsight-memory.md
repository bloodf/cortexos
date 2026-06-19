# 35 - Directory-scoped Hindsight memory for local AI harness

## Purpose

Register the repo's MCP server (`packages/cortex-hindsight-memory-mcp`) with
Claude Code / Claude Desktop on a local workstation so each project directory
gets its own isolated Hindsight bank on the CortexOS VPS.

This is normally installed automatically by
`prompts/tools/34-local-ai-harness.md` via `scripts/install-local-ai-harness.sh`.
Run this prompt only if you need to add or repair the MCP registration after
the harness is already in place.

## What gets wired up

- The MCP server is built from the monorepo.
- An entry is added to `~/.claude/mcp.json` with:
  - `HINDSIGHT_API_URL=http://127.0.0.1:8888`
  - `CORTEX_HINDSIGHT_CWD` inherited from the parent process (Claude sets this
    to the project directory).

## Tools exposed to the AI harness

- `hindsight_store_memory` — persist a fact/observation for the current
  directory.
- `hindsight_recall_memory` — semantic recall of directory memories.
- `hindsight_reflect_memory` — LLM-synthesized answer from this directory's
  stored memories.
- `hindsight_list_memories` — list all memories for the directory.
- `hindsight_forget_memory` — soft-delete a memory by ID (invalidated,
  reversible).
- `hindsight_current_bank` — show the derived Hindsight bank id.

## Prerequisites

- `prompts/tools/32b-hindsight.md` has completed and the tunnel service is
  forwarding `127.0.0.1:8888` to the VPS Hindsight.
- Node.js 22+ and pnpm are installed on the local machine.
- The repo is cloned at `/opt/cortexos` (or set `CORTEXOS_ROOT` to match).

## Todo

- [ ] CHECKPOINT 1 confirmed — local `127.0.0.1:8888/health` responds
- [ ] Build the MCP server
- [ ] Register it in `~/.claude/mcp.json`
- [ ] CHECKPOINT 2 confirmed — Claude Code lists the tools and can store/recall

## CHECKPOINT 1

**STOP — operator question:** Is `http://127.0.0.1:8888/health` reachable from
this local machine?

```bash
curl -fsS http://127.0.0.1:8888/health | python3 -m json.tool
systemctl --user status cortexos-vps-tunnel.service
```

Type `confirmed` to proceed.

## Build

```bash
cd /opt/cortexos
pnpm install --frozen-lockfile
pnpm --filter @cortexos/hindsight-memory-mcp build
```

## Register MCP

```bash
export CORTEXOS_ROOT=/opt/cortexos
bash /opt/cortexos/scripts/install-local-ai-harness.sh --register-mcp-only
```

If the installer does not yet support `--register-mcp-only`, run the
equivalent Python snippet:

```bash
python3 - "$HOME/.claude/mcp.json" <<'PYEOF'
import json, os, sys
config_path = sys.argv[1]
mcp_bin = "/opt/cortexos/packages/cortex-hindsight-memory-mcp/dist/index.js"

os.makedirs(os.path.dirname(config_path), exist_ok=True)
data = json.load(open(config_path)) if os.path.exists(config_path) else {"mcpServers": {}}

data.setdefault('mcpServers', {})['hindsight-memory'] = {
    "command": "node",
    "args": [mcp_bin],
    "env": {"HINDSIGHT_API_URL": "http://127.0.0.1:8888"},
    "disabled": False,
    "alwaysAllow": []
}

with open(config_path, 'w') as f:
    json.dump(data, f, indent=2)
    f.write('\n')
PYEOF
```

## Verify

1. Restart Claude Code (or reload MCP tools).
2. Ask Claude to run:

```text
Use hindsight_current_bank, then hindsight_store_memory with content "We are testing
 directory-scoped memory in CortexOS.", then hindsight_recall_memory with query
 "testing memory".
```

Expected:

- `hindsight_current_bank` returns a stable `dir-...` bank id derived from the
  project directory.
- `hindsight_store_memory` returns success.
- `hindsight_recall_memory` returns the stored fact.

## CHECKPOINT 2

**STOP — operator question:** Did Claude Code list the Hindsight memory tools
and did store/recall succeed? Type `confirmed` to proceed.

## Next

- Use `hindsight_store_memory` naturally when a project fact should persist
  across sessions (tech stack, conventions, user preferences).
- Use `hindsight_recall_memory` (or `hindsight_reflect_memory` for a synthesized
  answer) before answering questions about the project.
- Memories are isolated per directory because the MCP server derives the
  Hindsight bank id from the absolute path of `CORTEX_HINDSIGHT_CWD`.
- **Pick which 9Router model to use per task** — see
  `prompts/tools/35a-local-harness-9router.md` for the canonical model set,
  cost, and per-harness wiring.
