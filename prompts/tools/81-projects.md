# Projects (latest)

## Purpose

Register each project that should be managed by CortexOS by writing per-project env files at `/opt/cortexos/.secrets/projects/<slug>.env`. Projects are NOT listed in SETUP.md — they are registered here and via the dashboard Projects page on the running VPS.

## Prerequisites

- `70-dashboard.md` completed.
- Project slugs determined by operator.

## Distro selection

```bash
source scripts/pkg.sh
echo "OS family: $(pkg_family) $(pkg_version)"
: "${CORTEX_OS_FAMILY:?run prompts/os/00-os-selection.md first}"
```

## Sudo gate

This spoke runs `sudo`. Authenticate **now** so the rest of the steps don't pause for a password mid-flow:

```bash
sudo -v
```

CortexOS never stores your password — only the kernel's sudo timestamp is used. Re-run if it expires.

## Todo

- [ ] CHECKPOINT 1 confirmed — project slug list in hand
- [ ] `sudo mkdir -p /opt/cortexos/.secrets/projects`
- [ ] Write per-slug `.env` files under `projects/` (mode 0600)
- [ ] INSERT each project into `projects` table via psql
- [ ] Confirm `ls /opt/cortexos/.secrets/projects/` lists each slug
- [ ] Confirm `SELECT slug FROM projects` returns the registered slugs
- [ ] CHECKPOINT 2 confirmed — env files present
- [ ] CHECKPOINT 2b confirmed — DB rows present

## CHECKPOINT 1

**STOP — operator question:** Do you have a written list of project slugs (lowercase, hyphens OK) plus GitHub repo URL for each (not blank, not undecided)?

Type `confirmed` to proceed.

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

**STOP — operator question:** Does `ls /opt/cortexos/.secrets/projects/*.env 2>/dev/null | wc -l` print a count equal to the number of slugs you registered (not `0`)?

Type `confirmed` to proceed.

## CHECKPOINT 2b

**STOP — operator question:** Does `psql -U dashboard -h 127.0.0.1 cortex_dashboard -tAc 'SELECT count(*) FROM projects'` print a count equal to the number of slugs you registered (not `0`)?

Type `confirmed` to proceed.

## Next

→ `prompts/tools/99-final-validation.md`
