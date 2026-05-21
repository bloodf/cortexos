# Hermes and AgentGateway MCP

## Purpose

Install filesystem MCP directly in coding Hermes profiles, and install the
external MCP bundle behind the CortexOS AgentGateway MCP proxy/aggregator.
The repository stores only generic templates; profile instances, tokens, local
paths, and host-specific endpoints stay in runtime secrets and runtime profile
homes.

## Scope

Apply direct filesystem MCP to Cortex, coding project profiles, and Agent
Factory-created coding profiles. Configure the external MCP bundle only in
AgentGateway. Standalone messaging bots do not receive the coding profile MCP
config unless the operator explicitly opts them in.

## Repository safety

Do not write any of these values into prompts, templates, docs, or tracked
source files:

- tokens, API keys, bearer headers, or webhook secrets
- tenant-specific service URLs
- local absolute filesystem paths
- private IPs, hostnames, or profile instance names
- generated project-agent files

Use placeholders and env names in repository files. Write real values only to
runtime secrets.

## Runtime secrets

Create or update the runtime MCP env file with mode `0600`:

```bash
: "${CORTEX_SECRETS_DIR:?set runtime secrets root}"
: "${CORTEX_USER:?set runtime service user}"

sudo install -d -m 0700 -o "$CORTEX_USER" -g "$CORTEX_USER" "$CORTEX_SECRETS_DIR"
sudo install -m 0600 -o "$CORTEX_USER" -g "$CORTEX_USER" /dev/null "$CORTEX_SECRETS_DIR/mcp.env"
```

Required keys are environment variables only:

```text
EMBEDDING_PROVIDER
EMBEDDING_MODEL
MILVUS_ADDRESS
MILVUS_TOKEN
EXPO_MCP_TOKEN
MINIMAX_API_KEY
MCP_MINIMAX_BASE_PATH
MINIMAX_API_HOST
MINIMAX_API_RESOURCE_MODE
Z_AI_MODE
Z_AI_API_KEY
ZAI_WEB_READER_AUTHORIZATION
ZAI_WEB_SEARCH_PRIME_AUTHORIZATION
ZAI_ZREAD_AUTHORIZATION
MCP_FILESYSTEM_ROOTS
CORTEX_LOCAL_TIMEZONE
```

## MCP bundle

The AgentGateway proxy/aggregator bundle is:

```text
claude-context
context7
expo
fetch
git
markitdown
next-devtools
semble
sequentialthinking
time
minimax
web-reader
web-search-prime
zai-mcp-server
zread
```

Render `templates/agentgateway/mcp-servers.json` into the runtime
AgentGateway MCP config. Do not render these external servers directly into
Hermes profile config.

Render `templates/hermes/filesystem-mcp.yaml` into each runtime coding
profile's Hermes config. This gives Hermes direct filesystem access under the
operator-approved roots and one `agentgateway` MCP entry that proxies the
external MCP bundle.

Expo's remote MCP server uses OAuth. Keep `EXPO_MCP_TOKEN` in runtime secrets
for the operator-authenticated OAuth flow; do not write it as a static
authorization header in repository config.

## AgentGateway

Install the generic `hermes-gateway@.service` template using runtime
substitution for service user, home, secrets root, and Hermes root. The service
must load both the profile env and the MCP env. Install the
`cortex-agentgateway-mcp` proxy binary in runtime storage and point
`CORTEX_AGENTGATEWAY_MCP_BIN` at it.

Enable gateway instances only for runtime profile slugs. Do not add named
profile units to the repository.

## Verify

```bash
node scripts/check-repo-leaks.mjs
command -v npx
command -v uvx
```

For each enabled runtime coding profile:

```bash
systemctl is-active "hermes-profile@${profile}"
systemctl is-active "hermes-gateway@${profile}"
```

Then verify Hermes exposes MCP tools using the live Hermes reload or restart
path supported by the installed Hermes release.

## Next

→ `prompts/tools/43-paperclip-hermes.md`
