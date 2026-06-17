# @cortexos/honcho-memory-mcp

A stdio MCP server that gives local AI harness tools directory-scoped memory
backed by a self-hosted [Honcho](https://docs.honcho.dev) instance.

Each directory gets its own Honcho workspace, so memories from one project never
leak into another.

## Tools exposed

- `honcho_store_memory` – persist a fact/observation for the current directory.
- `honcho_recall_memory` – semantic recall of directory memories.
- `honcho_list_memories` – list all memories in the current directory.
- `honcho_forget_memory` – delete a memory by ID.
- `honcho_current_workspace` – show the derived workspace name.

## Configuration

Environment variables:

| Variable            | Default                  | Description                                |
| ------------------- | ------------------------ | ------------------------------------------ |
| `CORTEX_HONCHO_CWD` | `process.cwd()`          | Directory used to derive the workspace ID. |
| `HONCHO_BASE_URL`   | `http://127.0.0.1:18690` | Honcho API base URL.                       |
| `HONCHO_API_KEY`    | `undefined`              | Optional API key.                          |

## Running

```bash
pnpm build
CORTEX_HONCHO_CWD=/path/to/project node dist/index.js
```

## Claude Desktop configuration

```json
{
  "mcpServers": {
    "honcho-memory": {
      "command": "node",
      "args": ["/opt/cortexos/packages/cortex-honcho-memory-mcp/dist/index.js"],
      "env": {
        "HONCHO_BASE_URL": "http://127.0.0.1:18690"
      }
    }
  }
}
```

For per-directory CWD support use the wrapper installed by
`scripts/install-local-ai-harness.sh`, which sets `CORTEX_HONCHO_CWD` before
launching the MCP server.
