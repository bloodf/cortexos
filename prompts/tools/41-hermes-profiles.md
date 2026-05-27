# Hermes Profiles

## Chat Input Gate

This prompt follows `prompts/CHAT-INPUT-CONTRACT.md` and the prompt skeleton in `docs/SCRIPT-PROMPT-POLICY.md`. Ask required operator-specific values through a **STOP — input question** before emitting commands that use them.

Purpose: create local, isolated Hermes profile APIs. Profiles are runtime
state, not repo state.

## Contract

```text
/opt/cortexos/hermes/profiles.json
/opt/cortexos/hermes/profiles/<profile>/
/opt/cortexos/.secrets/hermes/<profile>.env
```

The baseline public install creates `primary` on `18691` and `secondary` on
`18692`. Private project machines may create additional local profiles; those
profiles stay out of Git.

## Create Baseline Profiles

```bash
set -euo pipefail
set -a
source /opt/cortexos/.secrets/9router.env
set +a

node scripts/hermes-profile-create.mjs primary 18691 cx/gpt-5.5 medium
node scripts/hermes-profile-create.mjs secondary 18692 cx/gpt-5.5 medium
```

For any project profile:

```bash
node scripts/hermes-profile-create.mjs <project-slug>
```

The script picks the first free port from `18693-18749`, writes the profile
home, writes the env file, writes the wrapper, and updates `profiles.json`.

## Install API Unit

```bash
sudo install -m 0644 templates/systemd/hermes-profile@.service /etc/systemd/system/hermes-profile@.service
sudo sed -i \
  -e "s|{VPS_USER}|${USER}|g" \
  -e "s|{CORTEX_SECRETS_DIR}|/opt/cortexos/.secrets|g" \
  -e "s|{CORTEX_HERMES_ROOT}|/opt/cortexos/hermes|g" \
  -e "s|{CORTEX_RUNTIME_ROOT}|/opt/cortexos|g" \
  -e "s|{HERMES_COMMAND}|/home/${USER}/.local/bin/hermes|g" \
  -e "s|{VPS_HOME}|/home/${USER}|g" \
  /etc/systemd/system/hermes-profile@.service
sudo systemctl daemon-reload
sudo systemctl enable --now hermes-profile@primary hermes-profile@secondary
```

## Verify

```bash
curl -fsS http://127.0.0.1:18691/health
curl -fsS http://127.0.0.1:18692/health
systemctl is-active hermes-profile@primary hermes-profile@secondary
```

## Next

`42-hermes-honcho.md`
