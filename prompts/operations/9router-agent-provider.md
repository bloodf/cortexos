# 9Router — Add a Provider for Another Agent

## Purpose

Add or verify a 9Router provider/model route for a CortexOS agent role without placing provider credentials in prompts, shell history, Git, or `.env` files.

Use this when an agent should use a different model/provider through 9Router, for example changing `templates/agent-roles/ENGINEER.md` from one `9router/<provider>/<model>` value to another.

## Prerequisites

- `prompts/tools/31-9router.md` completed.
- 9Router WebUI reachable at `https://${CORTEX_DOMAIN}:11434/dashboard`.
- The target agent role file exists under `templates/agent-roles/`.
- Operator has the provider API key in hand.

## Sudo gate

This prompt reads local secrets and may restart services after role/config changes:

```bash
sudo -v
```

## Todo

- [ ] CHECKPOINT 1 confirmed — target agent role + provider/model chosen
- [ ] Open 9Router WebUI and add provider API key there only
- [ ] Verify `/v1/models` lists the chosen model
- [ ] Update the target agent role model line if needed
- [ ] Propagate/reload the consumer/AgentGateway/OpenClaw runtime if role files changed
- [ ] CHECKPOINT 2 confirmed — dashboard Agents page shows the agent with reachable model

## CHECKPOINT 1

**STOP — operator question:** Which agent role should change, and which 9Router model should it use?

Record the answer locally in your session notes. Expected model format in role files:

```text
9router/<provider>/<model-id>
```

Examples:

```text
9router/openai/gpt-4o
9router/anthropic/claude-sonnet-4-5
9router/kimi/kimi-latest
```

Type `confirmed` to proceed after the target role and model are known.

## Open 9Router WebUI

Print the WebUI URL and retrieve the admin token path without echoing the token into logs:

```bash
: "${CORTEX_DOMAIN:?CORTEX_DOMAIN unset — source the CortexOS environment first}"
echo "Open: https://${CORTEX_DOMAIN}:11434/dashboard"
echo "Admin token lives in: /opt/cortexos/.secrets/9router.env"
echo "Read it locally with: sudo awk -F= '/^NINEROUTER_API_KEY=/{print \$2}' /opt/cortexos/.secrets/9router.env"
```

In the browser:

1. Open `https://${CORTEX_DOMAIN}:11434/dashboard`.
2. Sign in with `NINEROUTER_API_KEY` from `/opt/cortexos/.secrets/9router.env`.
3. Add the provider API key in the WebUI **Providers / API Keys** view.
4. Save.
5. Confirm the provider's models appear in the WebUI **Models** view.

Provider API keys MUST stay in the WebUI encrypted store. Do not paste provider keys into prompts or `.env` files.

## Verify model availability

Set the desired model ID as an environment variable for this shell only:

```bash
TARGET_MODEL="<provider-model-id>"   # example: claude-sonnet-4-5
set -a
source /opt/cortexos/.secrets/9router.env
set +a
curl -fsS -H "Authorization: Bearer ${NINEROUTER_API_KEY}" \
  "${NINEROUTER_BASE_URL:-http://127.0.0.1:11434}/v1/models" \
  | jq --arg id "$TARGET_MODEL" '.data[] | select(.id == $id) | .id'
```

Expected: the command prints the selected model ID. If it prints nothing, the provider key or model name is not registered in 9Router yet.

## Update the agent role

Edit only the target role file under `templates/agent-roles/`. Change the `Model:` line to the selected 9Router route:

```markdown
- Model: `9router/<provider>/<model-id>`
```

Do not change unrelated role instructions.

## Deploy/reload role changes

Copy the updated role file into the live CortexOS template directory and reload consumers of role metadata:

```bash
ROLE_FILE="templates/agent-roles/<ROLE>.md"
sudo install -m 644 "$ROLE_FILE" "/opt/cortexos/templates/agent-roles/$(basename "$ROLE_FILE")"

# cortex-consumer reloads roster caches on HUP.
sudo systemctl kill -s HUP cortex-consumer || sudo systemctl restart cortex-consumer

# Restart AgentGateway only if the role participates in tool dispatch.
sudo systemctl restart cortex-agentgateway 2>/dev/null || sudo docker restart cortex-agentgateway
```

If OpenClaw maintains its own agent config, update the agent's `model.primary` there to the same `9router/<provider>/<model-id>` value and restart OpenClaw:

```bash
sudo systemctl restart openclaw-gateway
```

## Verify dashboard visibility

```bash
: "${CORTEX_DOMAIN:?CORTEX_DOMAIN unset}"
curl -fsS "https://${CORTEX_DOMAIN}/dashboard/en/agents" >/dev/null
curl -fsS "https://${CORTEX_DOMAIN}/dashboard/en/admin/agent-factory" >/dev/null
```

Then open:

```text
https://${CORTEX_DOMAIN}/dashboard/en/agents
https://${CORTEX_DOMAIN}/dashboard/en/admin/agent-factory
```

Expected:

- The target agent is visible.
- The model label matches the new 9Router model.
- The agent health row reports the model endpoint as reachable.

## CHECKPOINT 2

**STOP — operator question:** Does the dashboard show the target agent with the new model and a reachable model endpoint?

Type `confirmed` to complete.
