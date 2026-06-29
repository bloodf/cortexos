# 32b - Hindsight

## Purpose

Install self-hosted [Hindsight](https://github.com/vectorize-io/hindsight) as the
CortexOS memory backend. Hindsight is the primary memory backend; the legacy
Honcho stack (`32-honcho.md`) is left deployed read-only as a rollback safety
net.

Live container: `hindsight-api`. Hindsight exposes a REST API on `:8888` and a
control-plane UI on `:9999`. `/` may return 404; use `/health` and the control
plane on `:9999` for operator verification.

## Prerequisites

- `11-docker.md` completed.
- `31-9router.md` completed and 9Router is serving chat models. Hindsight
  bundles its own embedder, so no Ollama embeddings proxy is required.

## Ports and paths

| Item           | Value                              |
| -------------- | ---------------------------------- |
| Hindsight API  | `127.0.0.1:8888`                   |
| Hindsight UI   | `127.0.0.1:9999`                   |
| Stack          | `/opt/cortexos/stacks/hindsight`   |
| Data volume    | `hindsight-data` (named volume)    |
| Secrets        | `/opt/cortexos/.secrets/hindsight.env` |

## CHECKPOINT 1

**STOP — operator question:** Is 9Router reachable and `cx/gpt-5.5` available?

```bash
curl -fsS -H "Authorization: Bearer {NINEROUTER_API_KEY}" \
  "{NINEROUTER_BASE_URL}/models" | jq -e '.data[].id | select(.=="cx/gpt-5.5")'
```

Expected: `cx/gpt-5.5` appears. Type `confirmed` to proceed.

## Configure secrets

**STOP — operator action required:** Provide the 9Router API key for this
machine. The 9Router base URL from the host is `http://172.17.0.1:11434/v1` when
accessed from inside Docker (docker0 bridge); from the host shell, use
`http://127.0.0.1:11434/v1`.

Wait for the operator's answer. Replace `{NINEROUTER_API_KEY}` below.

```bash
sudo install -d -m 0700 /opt/cortexos/.secrets

sudo tee /opt/cortexos/.secrets/hindsight.env >/dev/null <<EOF
HINDSIGHT_API_LLM_PROVIDER=openai
HINDSIGHT_API_LLM_BASE_URL=http://172.17.0.1:11434/v1
HINDSIGHT_API_LLM_API_KEY={NINEROUTER_API_KEY}
HINDSIGHT_API_LLM_MODEL=cx/gpt-5.5
HINDSIGHT_API_WORKER_ID=hindsight-prod
EOF
sudo chmod 600 /opt/cortexos/.secrets/hindsight.env
```

> If `cx/gpt-5.5` does not satisfy Hindsight's 65k-output-token requirement
> during retain/extraction, switch `HINDSIGHT_API_LLM_MODEL` to a 9Router model
> that does (e.g. a gpt-5-class model) and re-create the container. Keep
> provider/base-url/key unchanged.

## Install stack

```bash
sudo install -d -m 0755 /opt/cortexos/stacks
sudo rm -rf /opt/cortexos/stacks/hindsight
sudo git clone https://github.com/vectorize-io/hindsight /opt/cortexos/stacks/hindsight
install -m 0644 /opt/cortexos/templates/hindsight/docker-compose.yml \
  /opt/cortexos/stacks/hindsight/docker-compose.yml
cd /opt/cortexos/stacks/hindsight
docker compose up -d --remove-orphans
```

Hindsight's first boot of the embedded pg0 is slow (model downloads + database
init). Allow up to 60s before the healthcheck starts passing.

## Verify

```bash
# Hindsight health
curl -fsS http://127.0.0.1:8888/health

# 9Router reachable from inside the container
docker exec -i hindsight-api python3 - <<'PY'
import json, os, urllib.request
req = urllib.request.Request(
  "http://172.17.0.1:11434/v1/chat/completions",
  data=json.dumps({"model":"cx/gpt-5.5","messages":[{"role":"user","content":"Return ok."}],"max_tokens":20}).encode(),
  headers={"content-type":"application/json","authorization":f"Bearer {os.environ['HINDSIGHT_API_LLM_API_KEY']}"},
)
data = json.loads(urllib.request.urlopen(req, timeout=45).read())
assert data["choices"][0]["message"]["content"]
PY
```

## Create initial banks

```bash
for BANK in hermes-cieucpb hermes-cleo hermes-cortex primary secondary; do
  curl -fsS -X PUT "http://127.0.0.1:8888/v1/default/banks/${BANK}" \
    -H "content-type: application/json" -d '{}'
done
```

(Per-directory `dir-*` banks are created lazily by the MCP server on first
write.)

## CHECKPOINT 2

**STOP — operator question:** Does `curl -fsS http://127.0.0.1:8888/health`
return 200, and did the in-container 9Router smoke test complete without
errors? Type `confirmed` to proceed.

## Smoke test retain → recall

```bash
curl -fsS -X PUT  http://127.0.0.1:8888/v1/default/banks/smoke
curl -fsS -X POST http://127.0.0.1:8888/v1/default/banks/smoke/memories \
  -H 'content-type: application/json' \
  -d '{"async":false,"items":[{"content":"CortexOS uses pnpm workspaces."}]}'
curl -fsS -X POST http://127.0.0.1:8888/v1/default/banks/smoke/memories/recall \
  -H 'content-type: application/json' \
  -d '{"query":"package manager","budget":"mid"}'
```

Expected: the recall response contains the pnpm fact.

## Expose on tailnet

```bash
sudo tailscale serve --bg --https 8888 http://127.0.0.1:8888
sudo tailscale serve --bg --https 9999 http://127.0.0.1:9999
```

Reach from another tailnet machine:

- Hindsight API / Swagger docs: `https://<tailnet-host>:8888/health`
- Hindsight Control Plane UI: `https://<tailnet-host>:9999/`

## Dashboard registration

The catalog rows, correct health probes, and visibility flags ship as dashboard
migration `021_hindsight_seed.sql` (hindsight / hindsight-control-plane), applied
automatically at dashboard startup.

The public Apps URL is assigned per-install by
`cortex_set_service_urls(base_url)` (migration `021`):

```bash
# once, with this host's base URL (e.g. from `tailscale status`):
SELECT cortex_set_service_urls('https://<your-tailnet-host>');
```

## Client wiring

After CHECKPOINT 2, switch the clients over to Hindsight:

1. **Hermes profiles** — per profile, write `~/.hermes/hindsight/config.json`:
   ```json
   {"mode":"cloud","api_url":"http://127.0.0.1:8888","bank_id":"hermes-<profile>","autoRecall":true,"autoRetain":true}
   ```
   and edit each profile's Hermes config to add:
   ```yaml
   memory:
     memory_enabled: true
     provider: hindsight
   hindsight:
     config_path: ~/.hermes/hindsight/config.json
   ```
   then disable Hermes' built-in markdown memory tool per profile
   (`hermes tools disable memory`).

2. **Claude Code MCP** — `scripts/install-local-ai-harness.sh`
   (`install_hindsight_mcp`) registers `hindsight-memory` in
   `~/.claude/mcp.json` with `HINDSIGHT_API_URL=http://127.0.0.1:8888`. The
   per-directory wrapper sets `CORTEX_HINDSIGHT_CWD` before each launch.

3. **OpenCode MCP + plugin** — register the same MCP entry in
   `~/.config/opencode/opencode.json` under `mcp` and add
   `/opt/cortexos/packages/opencode-hindsight-plugin/dist/index.js` to the
   `plugins` array. The plugin auto-retains assistant turns and recalls on
   `experimental.session.compacting`.

4. **Build the MCP and plugin** (on the host or on a workstation that runs the
   local harness):
   ```bash
   pnpm --filter @cortexos/hindsight-memory-mcp build
   pnpm --filter @cortexos/opencode-hindsight-plugin build
   ```

## Migration from Honcho

Honcho memories are migrated to Hindsight with
`scripts/honcho-to-hindsight-migrate.mjs`. The script reads Honcho
conclusions per workspace and writes them to the matching Hindsight bank. The
mapping is deterministic:

- Hermes profile workspaces → `hermes-<ws>` (the three profiles
  `cieucpb`, `cleo`, `cortex` are read from `hermes/profiles.json`).
- All other workspaces → unchanged.

Honcho stays deployed read-only throughout this migration.

```bash
# Dry-run: count conclusions per workspace, write nothing
node /opt/cortexos/scripts/honcho-to-hindsight-migrate.mjs \
  --workspaces cieucpb,cleo,cortex,primary,secondary

# Apply: write to Hindsight, idempotent via /opt/cortexos/backups/hindsight-migration/migrated.json
node /opt/cortexos/scripts/honcho-to-hindsight-migrate.mjs \
  --workspaces cieucpb,cleo,cortex,primary,secondary --apply

# Verify migration parity (per bank)
curl -fsS "http://127.0.0.1:8888/v1/default/banks/hermes-cieucpb/memories/list?limit=5"

# Re-running --apply reports all items as skipped (idempotent)
node /opt/cortexos/scripts/honcho-to-hindsight-migrate.mjs \
  --workspaces cieucpb,cleo,cortex,primary,secondary --apply
```

If `client.workspaces.list()` is unavailable on the installed `@honcho-ai/sdk`,
the script exits non-zero and asks the operator to pass `--workspaces`
explicitly.

## Rollback

```bash
cd /opt/cortexos/stacks/hindsight
docker compose down
sudo tailscale serve --https=8888 off
```

Honcho remains the fallback. Re-point any clients that have switched back to
Honcho env vars.

## Next

Per `prompts/tools/_order.md` — after Hindsight, run
`prompts/tools/35-local-hindsight-memory.md` (per-harness MCP wiring) and
`prompts/tools/47a-cortex-sandbox.md` (AI gateway).
