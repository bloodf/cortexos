# 35 - Directory-scoped Honcho memory for local AI harness

## Purpose

Register the repo's MCP server (`packages/cortexos/honcho-memory-mcp`) with
Claude Code / Claude Desktop on a local workstation so each project directory
gets its own isolated Honcho memory workspace on the CortexOS VPS.

This is normally installed automatically by
`prompts/tools/34-local-ai-harness.md` via `scripts/install-local-ai-harness.sh`.
Run this prompt only if you need to add or repair the MCP registration after the
harness is already in place.

## What gets wired up

- The MCP server is built from the monorepo.
- An entry is added to `~/.claude/mcp.json` with:
  - `HONCHO_BASE_URL=http://127.0.0.1:18690`
  - `CORTEX_HONCHO_CWD` inherited from the parent process (Claude sets this to
    the project directory).

## Tools exposed to the AI harness

- `honcho_store_memory` — persist a fact/observation for the current directory.
- `honcho_recall_memory` — semantic recall of directory memories.
- `honcho_list_memories` — list all memories for the directory.
- `honcho_forget_memory` — delete a memory by ID.
- `honcho_current_workspace` — show the derived workspace name.

## Prerequisites

- `prompts/tools/34-local-ai-harness.md` has completed and the tunnel service is
  forwarding `127.0.0.1:18690` to the VPS Honcho.
- Node.js 22+ and pnpm are installed on the local machine.
- The repo is cloned at `/opt/cortexos` (or set `CORTEXOS_ROOT` to match).

## Todo

- [ ] CHECKPOINT 1 confirmed — local `127.0.0.1:18690/health` responds
- [ ] Build the MCP server
- [ ] Register it in `~/.claude/mcp.json`
- [ ] CHECKPOINT 2 confirmed — Claude Code lists the tools and can store/recall

## CHECKPOINT 1

**STOP — operator question:** Is `http://127.0.0.1:18690/health` reachable from
this local machine?

```bash
curl -fsS http://127.0.0.1:18690/health | python3 -m json.tool
systemctl --user status cortexos-vps-tunnel.service
```

Type `confirmed` to proceed.

## Build

```bash
cd /opt/cortexos
pnpm install --frozen-lockfile
pnpm --filter @cortexos/honcho-memory-mcp build
```

## Register MCP

```bash
export CORTEXOS_ROOT=/opt/cortexos
bash /opt/cortexos/scripts/install-local-ai-harness.sh --register-mcp-only
```

If the installer does not yet support `--register-mcp-only`, run the equivalent
Python snippet:

```bash
python3 - "$HOME/.claude/mcp.json" <<'PYEOF'
import json, os, sys
config_path = sys.argv[1]
mcp_bin = "/opt/cortexos/packages/cortex-honcho-memory-mcp/dist/index.js"

os.makedirs(os.path.dirname(config_path), exist_ok=True)
data = json.load(open(config_path)) if os.path.exists(config_path) else {"mcpServers": {}}

data.setdefault('mcpServers', {})['honcho-memory'] = {
    "command": "node",
    "args": [mcp_bin],
    "env": {"HONCHO_BASE_URL": "http://127.0.0.1:18690"},
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
Use honcho_current_workspace, then honcho_store_memory with content "We are testing
 directory-scoped memory in CortexOS.", then honcho_recall_memory with query
 "testing memory".
```

Expected:

- `honcho_current_workspace` returns a stable `dir-...` workspace name derived
  from the project directory.
- `honcho_store_memory` returns a conclusion ID.
- `honcho_recall_memory` returns the stored fact.

## CHECKPOINT 2

**STOP — operator question:** Did Claude Code list the Honcho memory tools and
did store/recall succeed?

Type `confirmed` to proceed.

## Next

- Use `honcho_store_memory` naturally when a project fact should persist across
  sessions (tech stack, conventions, user preferences).
- Use `honcho_recall_memory` before answering questions about the project; it
  will surface relevant prior memories.
- Memories are isolated per directory because the MCP server derives the Honcho
  workspace ID from the absolute path of `CORTEX_HONCHO_CWD`.
