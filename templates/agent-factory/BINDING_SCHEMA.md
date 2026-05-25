# OpenClaw Channel Binding Schema

Bindings live at `~/.openclaw/bindings/<binding-name>.json` and connect a chat
account to a specific agent with an optional sender allowlist.

## Shape

```json
{
  "channel": "telegram | whatsapp | slack",
  "account": "<accountId under channels.<channel>.accounts in openclaw.json>",
  "agent":   "<agent id, must exist in openclaw.json .agents.list[].id>",
  "allowFrom": ["<sender-id-1>", "<sender-id-2>"]
}
```

### Fields

- **channel** (required): transport. One of `telegram`, `whatsapp`, `slack`.
- **account** (required): logical account id matching a key under
  `channels.<channel>.accounts` in `~/.openclaw/openclaw.json`. The bot token /
  webhook secret lives there, never inside the binding file.
- **agent** (required): the agent receiving messages on this binding. Must be a
  registered id in `.agents.list[].id`. The agent's `plugins.allow` block still
  governs what it may dispatch.
- **allowFrom** (recommended): scoped sender allowlist. Only senders whose chat
  id / phone number appears here may post to the agent through this binding.
  Omit only for public-facing bindings (e.g. the `example-public-bot` public
  channel) and document the exception inline.

## Examples

### Telegram, owner-scoped

```json
{
  "channel": "telegram",
  "account": "cortex",
  "agent":   "cortex",
  "allowFrom": ["<OWNER_CHAT_ID>"]
}
```

### WhatsApp, owner-scoped

```json
{
  "channel": "whatsapp",
  "account": "personal",
  "agent":   "cortex",
  "allowFrom": ["5512991826031"]
}
```

### Public binding (intentional, document)

```json
{
  "channel": "whatsapp",
  "account": "example-public-bot",
  "agent":   "example-public-bot",
  "_note":   "Public account — allowFrom intentionally omitted."
}
```

## Operational rules

- File mode MUST be `600`, owner `<user>:<group>`.
- A binding without `allowFrom` is treated as `public`. Audit logs flag every
  message processed under a public binding.
- Adding a new sender = edit `allowFrom` in place, validate JSON, restart
  `agentgateway`:

  ```bash
  sudo systemctl restart agentgateway
  ```

- Removing an account from `openclaw.json` requires deleting every binding that
  references it; orphan bindings cause `agentgateway` to refuse startup.

## Validation

```bash
for f in ~/.openclaw/bindings/*.json; do
  jq -e '.channel and .account and .agent' "$f" > /dev/null \
    || echo "INVALID: $f"
done
```
