# 81 — Projects

## Chat Input Gate

This prompt follows `prompts/CHAT-INPUT-CONTRACT.md` and the prompt skeleton in `docs/SCRIPT-PROMPT-POLICY.md`. Ask required operator-specific values through a **STOP — input question** before emitting commands that use them.

## Purpose

Register projects that CortexOS manages through Paperclip and Hermes.

## Project Model

Each project gets:

- a row in the dashboard `projects` table
- a secret file under `/opt/cortexos/.secrets/projects/<slug>.env`
- a Hermes profile under `/opt/cortexos/hermes/profiles/<slug>`
- Paperclip role bindings that point at the Hermes profile
- an app attachment allowlist in `projects.settings.apps` copied from the factory definition

## Register

```bash
sudo install -d -m 0700 /opt/cortexos/.secrets/projects

sudo tee /opt/cortexos/.secrets/projects/<slug>.env <<'EOF'
PROJECT_SLUG=<slug>
PROJECT_GITHUB_REPO=<github-org>/<repo-name>
HERMES_PROFILE=<slug>
PAPERCLIP_ADAPTER=hermes_local
PROJECT_NOTIFY_ON_STAGE_CHANGE=true
EOF
sudo chmod 0600 /opt/cortexos/.secrets/projects/<slug>.env

node scripts/hermes-profile-create.mjs <slug>

psql -U dashboard -h 127.0.0.1 cortex_dashboard <<'SQL'
INSERT INTO projects (slug, name, repo_url, messaging_mode, settings)
VALUES (
  '<slug>',
  '<name>',
  'https://github.com/<github-org>/<repo-name>',
  'single',
  '{"hermes_profile":"<slug>","paperclip_adapter":"hermes_local","apps":["paperclip","honcho","9router","cortex-dashboard","langfuse"]}'::jsonb
)
ON CONFLICT (slug) DO UPDATE SET
  name = EXCLUDED.name,
  repo_url = EXCLUDED.repo_url,
  settings = EXCLUDED.settings,
  updated_at = NOW();
SQL
```

For factory-created projects, copy `agent_factories.definition.apps` into `projects.settings.apps`; generated agent profiles then inherit the same app allowlist. Use dashboard `services.slug` values only. Do not put app URLs, API keys, passwords, or env file contents in project settings.

## Verify

```bash
test -f /opt/cortexos/.secrets/projects/<slug>.env
test -d /opt/cortexos/hermes/profiles/<slug>
psql -U dashboard -h 127.0.0.1 cortex_dashboard -c "SELECT slug, settings FROM projects ORDER BY slug;"
```

## CHECKPOINT 1

Confirm every project has a Hermes profile and dashboard row.

## Next

→ `prompts/tools/99-final-validation.md`
