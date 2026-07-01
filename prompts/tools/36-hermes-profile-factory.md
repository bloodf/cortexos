# 36 - Hermes Profile Factory

## Purpose

Create a new Hermes agent profile with hindsight memory on this CortexOS host.
Each profile gets: a `HERMES_HOME` directory under `/opt/cortexos/hermes/profiles/`,
a `config.yaml` derived from the canonical template, a `hindsight-config.json`
linked to its Hindsight bank, a secrets `.env` at
`/opt/cortexos/.secrets/hermes/<profile>.env`, and two systemd units
(`hermes-gateway@<profile>` and `hermes-profile@<profile>`) rendered from the
committed templates.

Prerequisites: `32b-hindsight.md` completed (Hindsight API reachable on `:8888`),
an OpenAI-compatible chat endpoint configured, Node.js at `/usr/bin/node`.

## Inputs

> Collect the following before proceeding. Type your answers, then `confirmed`.

| Field | Default | Notes |
| --- | --- | --- |
| Profile name (slug) | — | lowercase alphanumeric + hyphens, e.g. `mybot` |
| Model | `gpt-4o` | Any model id served by the configured endpoint |
| Hindsight bank name | `hermes-<profile>` | Bank must exist in Hindsight |
| Hindsight peer label | `hermes-<profile>` | Stored in `.env` as `HINDSIGHT_PEER`; also `honcho.aiPeer` |
| Telegram enabled? | `no` | If yes: bot token and allowed chat IDs |
| WhatsApp enabled? | `no` | If yes: admin phone(s) E.164 without `+`, e.g. `5561991029460`; WhatsApp bridge port (default `3011`) |

```bash
read -p "Profile name: " PROFILE
: "${PROFILE:?Profile name is required}"
read -p "Model [gpt-4o]: " _m;  MODEL="${_m:-gpt-4o}"
read -p "Hindsight bank [hermes-${PROFILE}]: " _b; BANK="${_b:-hermes-${PROFILE}}"
read -p "Hindsight peer [hermes-${PROFILE}]: " _p; PEER="${_p:-hermes-${PROFILE}}"
read -p "Enable Telegram? (yes/no) [no]: " _tg; TG="${_tg:-no}"
read -p "Enable WhatsApp? (yes/no) [no]: " _wa; WA="${_wa:-no}"

if [ "${TG}" = "yes" ]; then
  read -s -p "Telegram bot token: " TG_TOKEN; echo
  read -p "Allowed chat IDs (comma-separated numeric): " TG_CHATS
fi

if [ "${WA}" = "yes" ]; then
  read -p "Admin phone(s) E.164 without + (comma-separated): " WA_ADMIN
  read -p "WhatsApp bridge port [3011]: " _wbp; WA_BRIDGE_PORT="${_wbp:-3011}"
fi

export PROFILE MODEL BANK PEER TG WA TG_TOKEN TG_CHATS WA_ADMIN WA_BRIDGE_PORT
echo "Profile: ${PROFILE}, model: ${MODEL}, bank: ${BANK}, peer: ${PEER}"
```

Slug validation: must match `^[a-z0-9][a-z0-9-]*$`. The scaffold script enforces this.

## CHECKPOINT 1

**STOP:** Confirm the Hindsight bank exists before proceeding.

```bash
curl -fsS "http://127.0.0.1:8888/v1/default/banks/${BANK}" | jq -e '.id'
```

If missing, create it:

```bash
curl -fsS -X PUT "http://127.0.0.1:8888/v1/default/banks/${BANK}" \
  -H "content-type: application/json" -d '{}'
```

Type `confirmed` to proceed.

## Step 1 — Scaffold the profile directory and base .env

`scripts/hermes-profile-create.mjs` handles slug validation, port allocation
(18691–18749, stored as the profile API port), directory creation, base `.env`
generation, the `/opt/cortexos/bin/hermes-<profile>` wrapper, and the profiles
registry.

The second argument is `portArg`. Passing an empty string keeps argument
positions correct while letting the script auto-select an available port via
`defaultPortFor`.

```bash
cd /opt/cortexos
node scripts/hermes-profile-create.mjs "${PROFILE}" "" "${MODEL}" medium \
  | tee /tmp/hermes-profile-create-out.json
PORT=$(node -e "process.stdout.write(String(JSON.parse(require('fs').readFileSync('/tmp/hermes-profile-create-out.json','utf8')).port))")
PROFILE_HOME="/opt/cortexos/hermes/profiles/${PROFILE}"
SECRETS_FILE="/opt/cortexos/.secrets/hermes/${PROFILE}.env"
echo "Profile home: ${PROFILE_HOME}, API port: ${PORT}, secrets: ${SECRETS_FILE}"
```

Note: `PORT` is the Hermes profile API port (18691–18749). The WhatsApp bridge
port (`WA_BRIDGE_PORT`, default 3011) is a separate value set in Step 4.

## Step 2 — Write config.yaml from template

Replace every `<<PLACEHOLDER>>` in the committed template and write the result
to the profile directory. `perl -p -e` is used because `envsubst` does not
handle the `<<...>>` delimiter style.

```bash
TEMPLATE_SRC="/opt/cortexos/templates/hermes/profile-config.template.yaml"
CONFIG_DEST="${PROFILE_HOME}/config.yaml"
HINDSIGHT_CONFIG_PATH="${PROFILE_HOME}/hindsight-config.json"

perl -p \
  -e "s|\Q<<PROFILE_NAME>>\E|${PROFILE}|g;" \
  -e "s|\Q<<HINDSIGHT_BANK_ID>>\E|${BANK}|g;" \
  -e "s|\Q<<HINDSIGHT_PEER>>\E|${PEER}|g;" \
  -e "s|\Q<<HINDSIGHT_CONFIG_PATH>>\E|${HINDSIGHT_CONFIG_PATH}|g;" \
  "${TEMPLATE_SRC}" > "${CONFIG_DEST}"
chmod 0644 "${CONFIG_DEST}"
echo "Wrote ${CONFIG_DEST}"
```

Verify all active (uncommented) placeholders are resolved:

```bash
grep '<<' "${CONFIG_DEST}" | grep -v '^#' && echo "UNRESOLVED PLACEHOLDERS" || echo "OK"
```

Expected output: `OK`.

## Step 3 — Write hindsight-config.json

```bash
HINDSIGHT_TEMPLATE="/opt/cortexos/templates/hermes/hindsight-config.template.json"
HINDSIGHT_CONFIG_PATH="${PROFILE_HOME}/hindsight-config.json"
HINDSIGHT_RENDER_TMP=$(mktemp)

perl -p \
  -e "s|\Q<<HINDSIGHT_API_URL>>\E|http://127.0.0.1:8888|g;" \
  -e "s|\Q<<HINDSIGHT_BANK_ID>>\E|${BANK}|g;" \
  -e "s|\Q<<HINDSIGHT_PEER>>\E|${PEER}|g;" \
  "${HINDSIGHT_TEMPLATE}" > "${HINDSIGHT_RENDER_TMP}"

python3 - "${HINDSIGHT_RENDER_TMP}" "${HINDSIGHT_CONFIG_PATH}" <<'PY'
import json, sys
with open(sys.argv[1]) as f: data = json.load(f)
data.pop("_peer", None)
with open(sys.argv[2], "w") as f:
    json.dump(data, f, indent=2)
    f.write("\n")
PY

rm -f "${HINDSIGHT_RENDER_TMP}"
chmod 0644 "${HINDSIGHT_CONFIG_PATH}"
echo "Wrote ${HINDSIGHT_CONFIG_PATH}"
cat "${HINDSIGHT_CONFIG_PATH}"
```

The template carries `_peer: <<HINDSIGHT_PEER>>` as a render-time placeholder
only; the python3 step removes it before writing the final file. The rendered
`hindsight-config.json` contains only the fields the Hindsight client schema
accepts: `mode`, `api_url`, `bank_id`, `autoRecall`, `autoRetain`.
`HINDSIGHT_PEER` is also written to the `.env` (Step 4) and to `config.yaml`
as `honcho.aiPeer`.

## Step 4 — Append Hindsight and messaging vars to the .env

```bash
# Hindsight vars (always required)
sudo tee -a "${SECRETS_FILE}" >/dev/null <<EOF
HINDSIGHT_API_URL=http://127.0.0.1:8888
HINDSIGHT_BANK_ID=${BANK}
HINDSIGHT_PEER=${PEER}
OLLAMA_API_KEY=ollama
EOF

# LLM key — copy from host secrets if not already present
if ! grep -q OPENAI_API_KEY "${SECRETS_FILE}"; then
  LLMKEY=$(grep '^OPENAI_API_KEY=' /opt/cortexos/.secrets/hermes/default.env 2>/dev/null | cut -d= -f2-)
  : "${LLMKEY:?OPENAI_API_KEY not found in /opt/cortexos/.secrets/hermes/default.env — add it manually}"
  sudo tee -a "${SECRETS_FILE}" >/dev/null <<EOF
OPENAI_BASE_URL=https://api.openai.com/v1
OPENAI_API_KEY=${LLMKEY}
EOF
fi
```

### Telegram vars (if enabled)

```bash
if [ "${TG}" = "yes" ]; then
  sudo tee -a "${SECRETS_FILE}" >/dev/null <<EOF
TELEGRAM_BOT_TOKEN=${TG_TOKEN}
EOF
fi
```

Then uncomment and populate the `telegram:` block in `config.yaml`:

```bash
if [ "${TG}" = "yes" ]; then
  perl -pi \
    -e "s|^# telegram:|telegram:|;" \
    -e "s|^#   reactions:|  reactions:|;" \
    -e "s|^#   channel_prompts: \{\}|  channel_prompts: {}|;" \
    -e "s|^#   allowed_chats: '<<TELEGRAM_ALLOWED_CHATS>>'|  allowed_chats: '${TG_CHATS}'|;" \
    "${CONFIG_DEST}"
fi
```

### WhatsApp vars (if enabled)

```bash
if [ "${WA}" = "yes" ]; then
  WA_ADMIN_PRIMARY=$(echo "${WA_ADMIN}" | cut -d, -f1)
  sudo tee -a "${SECRETS_FILE}" >/dev/null <<EOF
WHATSAPP_ENABLED=true
WHATSAPP_MODE=bot
WHATSAPP_ALLOWED_USERS=*
WHATSAPP_ALLOW_ALL_USERS=true
WHATSAPP_REQUIRE_MENTION=true
WHATSAPP_HOME_CHANNEL=
WHATSAPP_HOME_CHANNEL_NAME=${PROFILE}
EOF
fi
```

Uncomment and populate the `whatsapp:` block in `config.yaml`.

```bash
if [ "${WA}" = "yes" ]; then
  perl -pi \
    -e "s|^# whatsapp:|whatsapp:|;" \
    -e "s|^#   bridge_port: <<BRIDGE_PORT>>|  bridge_port: ${WA_BRIDGE_PORT}|;" \
    -e "s|^#   dm_policy: open|  dm_policy: open|;" \
    -e "s|^#   allow_admin_from:|  allow_admin_from:|;" \
    -e "s|^#   group_policy: open|  group_policy: open|;" \
    -e "s|^#   group_allow_from: \[\]|  group_allow_from: []|;" \
    -e "s|^#   group_allow_admin_from:|  group_allow_admin_from:|;" \
    -e "s|^#   require_mention: true|  require_mention: true|;" \
    -e "s|^#   mention_patterns:|  mention_patterns:|;" \
    -e "s|^#   reply_prefix: ''|  reply_prefix: ''|;" \
    -e "s|^#   gateway_restart_notification: false|  gateway_restart_notification: false|;" \
    "${CONFIG_DEST}"
  # Replace both admin-phone placeholder list entries with primary admin phone.
  perl -pi -e "s|^#   - '<<WHATSAPP_ADMIN_PHONES>>'|  - '${WA_ADMIN_PRIMARY}'|;" \
    "${CONFIG_DEST}"
  # Uncomment the mention_patterns list entry. Match on the literal prefix
  # because <<PROFILE_NAME>> was already substituted in Step 2.
  perl -pi -e "s|^#   - \(\?i\)\@|  - (?i)@|;" \
    "${CONFIG_DEST}"
fi
```

> If multiple admin phones were provided, append additional entries to the
> `allow_admin_from:` and `group_allow_admin_from:` lists by hand after this step.

## CHECKPOINT 2

**STOP:** Verify config.yaml is valid YAML and all active placeholders are resolved.

```bash
python3 -c "import yaml, sys; yaml.safe_load(open('${CONFIG_DEST}'))" && echo "YAML OK"
grep '<<' "${CONFIG_DEST}" | grep -v '^#' && echo "UNRESOLVED" || echo "PLACEHOLDERS OK"
cat "${HINDSIGHT_CONFIG_PATH}"
```

Expected: `YAML OK`, `PLACEHOLDERS OK`, JSON shows your bank ID.

Type `confirmed` to proceed.

## Step 5 — Render and enable systemd units

The committed templates `hermes-gateway@.service` and `hermes-profile@.service`
reference `{CORTEX_SECRETS_DIR}/hermes/%i.env` where `%i` is the profile slug.

```bash
sudo bash /opt/cortexos/scripts/ops/cortex-render-units.sh \
  "hermes-gateway@.service" "hermes-profile@.service"

sudo systemctl daemon-reload
sudo systemctl enable --now "hermes-gateway@${PROFILE}.service"
sudo systemctl enable --now "hermes-profile@${PROFILE}.service"
```

## Step 6 — Verify services are running

```bash
sudo systemctl status "hermes-gateway@${PROFILE}.service" --no-pager -l
sudo systemctl status "hermes-profile@${PROFILE}.service" --no-pager -l
```

Allow up to 15 s for the gateway to reach `active (running)`. On failure:

```bash
sudo journalctl -u "hermes-gateway@${PROFILE}" -n 50 --no-pager
sudo journalctl -u "hermes-profile@${PROFILE}" -n 50 --no-pager
```

## Step 7 — Smoke test

```bash
HERMES_HOME="${PROFILE_HOME}" hermes status
```

Expected: gateway `running`, memory provider `hindsight`, model `cx/gpt-5.5`
(or the model chosen in Inputs).

## Verification

```bash
# 1. Profile API reachable
curl -fsS \
  -H "Authorization: Bearer $(grep '^HERMES_API_KEY=' ${SECRETS_FILE} | cut -d= -f2)" \
  "http://127.0.0.1:${PORT}/v1/models" | jq '.data[].id' | head -5

# 2. Hindsight recall runs without provider error
HERMES_HOME="${PROFILE_HOME}" hermes memory recall "test" 2>&1 | head -5

# 3. Profile present in registry with correct port and model
node -e "
const r = JSON.parse(require('fs').readFileSync('/opt/cortexos/hermes/profiles.json','utf8'));
console.log(JSON.stringify(r.profiles.find(p => p.profile === '${PROFILE}'), null, 2));
"
```

Expected: (1) model list includes `cx/gpt-5.5`, (2) recall runs without a
`provider: hindsight` error, (3) registry entry shows the correct port and model.

## Pairing flow (messaging platforms)

### Telegram

1. Send `/start` (or any message) to the bot in Telegram.
2. If the chat ID is not in `allowed_chats`, the bot replies:
   > Here's your pairing code: `XXXXXXXX`
   > Ask the bot owner to run: `hermes pairing approve telegram XXXXXXXX`
3. Approve on the host:
   ```bash
   HERMES_HOME="${PROFILE_HOME}" hermes pairing approve telegram XXXXXXXX
   ```

### WhatsApp

1. Run the setup wizard to scan the QR code:
   ```bash
   HERMES_HOME="${PROFILE_HOME}" hermes whatsapp setup
   ```
2. Scan the QR from WhatsApp Settings → Linked Devices. `WHATSAPP_ENABLED=true`
   is written to the `.env` automatically on successful pairing.
3. Restart the gateway to pick up the credential:
   ```bash
   sudo systemctl restart "hermes-gateway@${PROFILE}.service"
   ```
4. Unknown users who DM the bot receive:
   > Here's your pairing code: `XXXXXXXX`
   > Ask the bot owner to run: `hermes pairing approve whatsapp XXXXXXXX`
5. Approve on the host:
   ```bash
   HERMES_HOME="${PROFILE_HOME}" hermes pairing approve whatsapp XXXXXXXX
   ```

## Next

After profile creation, add skills or MCP servers by editing the
`skills.external_dirs` and `mcp_servers` blocks in `config.yaml`, then restart
the gateway:

```bash
sudo systemctl restart "hermes-gateway@${PROFILE}.service"
```
