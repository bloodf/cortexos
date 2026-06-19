# @cortexos/hindsight-memory-mcp

A stdio MCP server that gives local AI harness tools directory-scoped memory
backed by a self-hosted [Hindsight](https://github.com/vectorize-io/hindsight)
instance.

Each directory gets its own Hindsight bank, so memories from one project never
leak into another.

## Tools exposed

- `hindsight_store_memory` – persist a fact/observation for the current directory.
- `hindsight_recall_memory` – semantic recall of directory memories.
- `hindsight_reflect_memory` – LLM-synthesized answer from this directory's memories.
- `hindsight_list_memories` – list all memories in the current directory.
- `hindsight_forget_memory` – soft-delete a memory by ID (invalidated, reversible).
- `hindsight_current_bank` – show the derived Hindsight bank id.

## Configuration

Environment variables:

| Variable                | Default                  | Description                                  |
| ----------------------- | ------------------------ | -------------------------------------------- |
| `CORTEX_HINDSIGHT_CWD`  | `process.cwd()`          | Directory used to derive the bank id.        |
| `HINDSIGHT_API_URL`     | `http://127.0.0.1:8888`  | Hindsight API base URL.                      |
| `HINDSIGHT_API_KEY`     | `undefined`              | Optional API key (bearer).                   |

## Running

```bash
pnpm build
CORTEX_HINDSIGHT_CWD=/path/to/project node dist/index.js
```

## Claude Desktop configuration

```json
{
  "mcpServers": {
    "hindsight-memory": {
      "command": "node",
      "args": ["/opt/cortexos/packages/cortex-hindsight-memory-mcp/dist/index.js"],
      "env": {
        "HINDSIGHT_API_URL": "http://127.0.0.1:8888"
      }
    }
  }
}
```

For per-directory CWD support use the wrapper installed by
`scripts/install-local-ai-harness.sh`, which sets `CORTEX_HINDSIGHT_CWD` before
launching the MCP server.
