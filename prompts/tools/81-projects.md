# Projects (latest)

## Purpose

Register each project that should be managed by CortexOS by writing per-project env files at `/opt/cortexos/.secrets/projects/<slug>.env`. Projects are NOT listed in SETUP.md — they are registered here and via the dashboard Projects page on the running VPS.

## Prerequisites

- `70-dashboard.md` completed.
- Project slugs determined by operator.

## CHECKPOINT 1

Operator: list the project slugs you want to register (one per line). Each project needs a slug (lowercase, hyphens OK), a GitHub repository URL, and optionally a messaging channel for notifications. Type "confirmed" when ready.

## Install

For each project `<slug>`:

```bash
sudo mkdir -p /opt/cortexos/.secrets/projects

sudo tee /opt/cortexos/.secrets/projects/<slug>.env <<EOF
PROJECT_SLUG=<slug>
PROJECT_GITHUB_REPO=<github-org>/<repo-name>
PROJECT_MESSAGING_CHANNEL=<telegram|slack|discord|whatsapp>
PROJECT_NOTIFY_ON_STAGE_CHANGE=true
EOF

sudo chmod 600 /opt/cortexos/.secrets/projects/<slug>.env
```

Repeat for each project.

> **Canonical source of channel tokens.** Per-project bot tokens
> (Telegram, Slack, Discord, WhatsApp) live in
> `~/.openclaw/openclaw.json` under
> `channels.<platform>.accounts.<slug>.{botToken|accessToken|...}`. The
> `<slug>.env` files above mirror those values for tooling that cannot
> read OpenClaw config directly. If the two disagree,
> `openclaw.json` wins — re-mirror with:
>
> ```bash
> jq -r --arg slug "<slug>" '.channels.telegram.accounts[$slug].botToken' \
>   ~/.openclaw/openclaw.json | sudo tee -a /opt/cortexos/.secrets/projects/<slug>.env
> ```

## Configure

Register the project in the dashboard database:

```bash
psql -U dashboard -h 127.0.0.1 cortex_dashboard <<SQL
INSERT INTO projects (slug, github_repo, created_at)
VALUES ('<slug>', '<github-org>/<repo-name>', NOW())
ON CONFLICT (slug) DO NOTHING;
SQL
```

Or use the dashboard Projects page at `https://{DOMAIN}/en/admin/projects` to register via the UI.

## Verify

```bash
ls -la /opt/cortexos/.secrets/projects/
psql -U dashboard -h 127.0.0.1 cortex_dashboard -c "SELECT slug, github_repo FROM projects;"
```

Expected: env files exist for each slug; database rows match.

## CHECKPOINT 2

Operator: confirm all project env files exist and dashboard Projects page shows the registered projects. Type "confirmed" to proceed.

## Next

→ `prompts/tools/99-final-validation.md`
