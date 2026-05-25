# Hermes and AgentGateway MCP

## Chat Input Gate

This prompt follows `prompts/CHAT-INPUT-CONTRACT.md`. Do not assume any
operator-specific environment variables are already defined. Before using a
value such as a host, user, domain, token, password, project path, profile name,
or service URL, ask a **STOP — input question**, wait for the operator's answer,
and then substitute that answer into the commands you produce.

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

AgentGateway must never include a filesystem MCP server. Filesystem access is
attached directly to each Hermes profile through
`templates/hermes/filesystem-mcp.yaml`.

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

## Input Gate — Runtime Paths

**STOP — input question:** Please provide:

- `runtime_secrets_dir`: runtime secrets directory, normally
  `/opt/cortexos/.secrets`.
- `runtime_service_user`: Linux user that owns CortexOS runtime files, normally
  `cortexos`.

Do not continue until the operator answers. After the answer, substitute those
values into the command below.

Create or update the runtime MCP env file with mode `0600`:

```bash
CORTEX_SECRETS_DIR='<runtime_secrets_dir_from_chat>'
CORTEX_USER='<runtime_service_user_from_chat>'

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
MCP_FILESYSTEM_ROOTS
CORTEX_LOCAL_TIMEZONE
NINEROUTER_BASE_URL
NINEROUTER_URL
NINEROUTER_KEY
AGENTGATEWAY_MCP_CONFIG
AGENTGATEWAY_MCP_TIMEOUT_MS
CORTEX_AGENTGATEWAY_MCP_BIN
```

## MCP bundle

The AgentGateway proxy/aggregator bundle is:

```text
context7
fetch
git
sequentialthinking
time
```

Render `templates/agentgateway/mcp-servers.json` into the runtime
AgentGateway MCP config. Do not render these external servers directly into
Hermes profile config, and do not add filesystem to the AgentGateway config.

Render `templates/hermes/filesystem-mcp.yaml` into each runtime coding
profile's Hermes config. This gives Hermes direct filesystem access under the
operator-approved roots and one `agentgateway` MCP entry that proxies the
external MCP bundle.

Use 9Router skills for web search and web fetch. Do not add remote HTTP MCP
servers that fail Streamable HTTP JSON-RPC negotiation.

## AgentGateway

Install the generic `hermes-gateway@.service` template using runtime
substitution for service user, home, secrets root, and Hermes root. The service
must load both the profile env and the MCP env. Install the
`cortex-agentgateway-mcp` proxy binary in runtime storage and point
`CORTEX_AGENTGATEWAY_MCP_BIN` at it.

Enable gateway instances only for runtime profile slugs. Do not add named
profile units to the repository. Every Hermes profile config must contain the
single `agentgateway` MCP entry plus direct `filesystem` MCP where filesystem is
operator-approved.

## Skills

Install the 9Router skill bundle into every Hermes profile:

```bash
pnpm hermes:install-skills
```

The `cortex-factory-creation` skill is installed only into Cortex factory
profiles (`default,cortex` by default). Do not install that factory skill into
project or standalone bot profiles.

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
