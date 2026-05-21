# Hermes Profiles

## Purpose

Create isolated Hermes profiles for Primary, Secondary, and future Paperclip
projects.

## Profile registry

CortexOS registry:

```text
/opt/cortexos/hermes/profiles.json
/opt/cortexos/hermes/profiles/<project-slug>/
```

Naming convention:

- `profile=<project-slug>`
- `workspace=<project-slug>`
- `aiPeer=hermes-<project-slug>`
- `session=<project-slug>:<role>:<issue-id>`

## Initial profiles

| Profile | API port | Model | Reasoning |
| --- | ---: | --- | --- |
| `primary` | `18691` | `cx/gpt-5.5` | `medium` |
| `secondary` | `18692` | `cx/gpt-5.5` | `medium` |

Future profiles use the first free port in `18693-18749`.

## Create profiles

```bash
set -a
source /opt/cortexos/.secrets/9router.env
set +a

node scripts/hermes-profile-create.mjs primary 18691 cx/gpt-5.5 medium
node scripts/hermes-profile-create.mjs secondary 18692 cx/gpt-5.5 medium
```

Each profile gets its own env file at:

```text
/opt/cortexos/.secrets/hermes/<profile>.env
```

## Install profile APIs

```bash
sudo install -m 0755 scripts/hermes-profile-api.mjs /opt/cortexos/scripts/hermes-profile-api.mjs
sudo install -m 0644 templates/systemd/hermes-profile@.service \
  /etc/systemd/system/hermes-profile@.service
sudo systemctl daemon-reload
sudo systemctl enable --now hermes-profile@primary
sudo systemctl enable --now hermes-profile@secondary
```

These per-profile services are local API wrappers around the Hermes CLI. They
are not a scheduler or workflow bus. Paperclip still owns work orchestration;
the profile API exists for dashboard health, local operator access, and direct
debug calls.

## Verify

```bash
curl -fsS http://127.0.0.1:18691/health
curl -fsS http://127.0.0.1:18692/health
systemctl is-active hermes-profile@primary
systemctl is-active hermes-profile@secondary
```

## Next

→ `prompts/tools/42-hermes-honcho.md`
