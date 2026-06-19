# Directory-scoped Hindsight memory MCP

The repo ships a stdio MCP server (`packages/cortex-hindsight-memory-mcp`)
that lets local AI harness tools store and recall memories per
directory/project. Memories live on the self-hosted CortexOS VPS Hindsight
instance, not on the local machine.

## How it works

- When Claude Code launches the MCP server, it sets `CORTEX_HINDSIGHT_CWD` to
  the current project directory.
- The server derives a stable Hindsight bank id from that absolute path (e.g.
  `dir-cortexos-AbCdEf...`).
- All `hindsight_*` tool calls operate inside that bank, so each project has
  isolated memory.

## Tools

| Tool | Purpose |
| --- | --- |
| `hindsight_store_memory` | Persist a fact, preference, or observation. |
| `hindsight_recall_memory` | Semantic search over the directory's memories. |
| `hindsight_reflect_memory` | LLM-synthesized answer from the directory's memories. |
| `hindsight_list_memories` | List all stored memories, newest first. |
| `hindsight_forget_memory` | Soft-delete a memory by ID (invalidated, reversible). |
| `hindsight_current_bank` | Show the bank id for this directory. |

## Installation

If you already ran `scripts/install-local-ai-harness.sh`, the MCP server is
registered automatically in `~/.claude/mcp.json`.

To register or repair it manually:

```bash
cd /opt/cortexos
pnpm install --frozen-lockfile
pnpm --filter @cortexos/hindsight-memory-mcp build
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

Then restart Claude Code.

## Configuration

Environment variables passed to the MCP process:

| Variable | Default | Description |
| --- | --- | --- |
| `CORTEX_HINDSIGHT_CWD` | `process.cwd()` | Directory that defines the bank scope. |
| `HINDSIGHT_API_URL` | `http://127.0.0.1:8888` | Hindsight API base URL. |
| `HINDSIGHT_API_KEY` | unset | Optional API key (bearer). |

## Verification

Inside a project directory, ask Claude Code to run:

```text
Use hindsight_current_bank, then hindsight_store_memory with content "This
project uses pnpm workspaces.", then hindsight_recall_memory with query
"package manager".
```

Expected:

- `hindsight_current_bank` returns a stable `dir-...` name.
- `hindsight_store_memory` returns success.
- `hindsight_recall_memory` returns the stored fact.

## Implementation notes

- The MCP server is built with TypeScript and runs over stdio.
- It uses the Hindsight REST API directly (no SDK); banks are namespaced under
  `/v1/default/banks/{bank_id}` and are created lazily on first write via
  `PUT /v1/default/banks/{bank_id}`.
- Forgetting a memory is a soft `PATCH … {state: "invalidated"}` (reversible,
  excluded from recall). Hindsight does not expose per-memory hard delete; do
  not implement one.
