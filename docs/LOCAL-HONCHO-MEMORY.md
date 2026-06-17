# Directory-scoped Honcho memory MCP

The repo ships a stdio MCP server (`packages/cortex-honcho-memory-mcp`) that
lets local AI harness tools store and recall memories per directory/project.
Memories live on the self-hosted CortexOS VPS Honcho instance, not on the local
machine.

## How it works

- When Claude Code launches the MCP server, it sets `CORTEX_HONCHO_CWD` to the
  current project directory.
- The server derives a stable Honcho workspace ID from that absolute path
  (e.g. `dir-cortexos-AbCdEf...`).
- All `honcho_*` tool calls operate inside that workspace, so each project has
  isolated memory.

## Tools

| Tool | Purpose |
| --- | --- |
| `honcho_store_memory` | Persist a fact, preference, or observation. |
| `honcho_recall_memory` | Semantic search over the directory's memories. |
| `honcho_list_memories` | List all stored memories, newest first. |
| `honcho_forget_memory` | Delete a memory by its conclusion ID. |
| `honcho_current_workspace` | Show the workspace name for this directory. |

## Installation

If you already ran `scripts/install-local-ai-harness.sh`, the MCP server is
registered automatically in `~/.claude/mcp.json`.

To register or repair it manually:

```bash
cd /opt/cortexos
pnpm install --frozen-lockfile
pnpm --filter @cortexos/honcho-memory-mcp build
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

Then restart Claude Code.

## Configuration

Environment variables passed to the MCP process:

| Variable | Default | Description |
| --- | --- | --- |
| `CORTEX_HONCHO_CWD` | `process.cwd()` | Directory that defines the workspace scope. |
| `HONCHO_BASE_URL` | `http://127.0.0.1:18690` | Honcho API base URL. |
| `HONCHO_API_KEY` | unset | Optional API key (self-hosted auth is usually disabled). |

## Verification

Inside a project directory, ask Claude Code to run:

```text
Use honcho_current_workspace, then honcho_store_memory with content "This
project uses pnpm workspaces.", then honcho_recall_memory with query "package
manager".
```

Expected:

- `honcho_current_workspace` returns a stable `dir-...` name.
- `honcho_store_memory` returns a conclusion ID.
- `honcho_recall_memory` returns the stored fact.

## Implementation notes

- The MCP server is built with TypeScript and runs over stdio.
- It uses the `@honcho-ai/sdk` `Honcho` client with `workspaceId` set to the
  derived directory workspace.
- Self-hosted Honcho only exposes `/conclusions` for semantic memory (no
  observations), so memories are stored as self-conclusions (`observer == observed == user`).
- The server auto-creates the workspace and peer on first use.
