# Agent Factory (latest)

## Purpose

Configure the GitHub Actions label-based state machine (13-stage pipeline) that drives agent task orchestration. Templates live in `templates/` — this spoke wires them to the target GitHub repository.

## Prerequisites

- `70-dashboard.md` completed.
- GitHub repository for agent tasks exists.
- GitHub Actions enabled on that repository.

## Distro selection

```bash
source scripts/pkg.sh
echo "OS family: $(pkg_family) $(pkg_version)"
: "${CORTEX_OS_FAMILY:?run prompts/os/00-os-selection.md first}"
```

## Todo

- [ ] CHECKPOINT 1 confirmed — admin access on target repo
- [ ] Export `AGENT_REPO=<org>/<repo>`
- [ ] Create 13 `stage/*` labels via `gh label create`
- [ ] Copy `templates/agent-factory/*.yml` to target `.github/workflows/`
- [ ] Set `CORTEX_DASHBOARD_URL`, `OPENCLAW_BASE`, `AGENTGATEWAY_BASE` repo secrets
- [ ] Confirm dashboard migration `017_paperclip_agent_factory` seeded `paperclip-startup-company`
- [ ] When creating a startup company for Paperclip, use the Paperclip organization contract below
- [ ] Create probe issue with `stage/00-inbox` label
- [ ] Confirm triage workflow fires within 60s
- [ ] CHECKPOINT 2 confirmed — label advanced to `stage/01-triage`

## CHECKPOINT 1

**STOP — operator question:** Does `gh api repos/$AGENT_REPO --jq .permissions.admin` print `true` (not `false`, not `Not Found`)?

Type `confirmed` to proceed.

## Install

Install the label state machine on the target GitHub repository:

```bash
# Set target repo
export AGENT_REPO="{GITHUB_ORG}/{GITHUB_REPO}"

# Create all 13 pipeline stage labels
gh label create "stage/00-inbox"         --color "ededed" --repo $AGENT_REPO
gh label create "stage/01-triage"        --color "f9d0c4" --repo $AGENT_REPO
gh label create "stage/02-scoped"        --color "e4e669" --repo $AGENT_REPO
gh label create "stage/03-planned"       --color "bfd4f2" --repo $AGENT_REPO
gh label create "stage/04-approved"      --color "0075ca" --repo $AGENT_REPO
gh label create "stage/05-in-progress"   --color "e4b429" --repo $AGENT_REPO
gh label create "stage/06-review"        --color "d93f0b" --repo $AGENT_REPO
gh label create "stage/07-qa"            --color "f29513" --repo $AGENT_REPO
gh label create "stage/08-staging"       --color "5319e7" --repo $AGENT_REPO
gh label create "stage/09-uat"           --color "c2e0c6" --repo $AGENT_REPO
gh label create "stage/10-release"       --color "0e8a16" --repo $AGENT_REPO
gh label create "stage/11-deployed"      --color "006b75" --repo $AGENT_REPO
gh label create "stage/12-closed"        --color "cccccc" --repo $AGENT_REPO
```

## Configure

Copy workflow templates to the target repository's `.github/workflows/`:

```bash
# From repo root:
cp templates/agent-factory/*.yml /path/to/target-repo/.github/workflows/
```

Add required GitHub Actions secrets on the target repository:

```bash
gh secret set CORTEX_DASHBOARD_URL --body "https://{DOMAIN}" --repo $AGENT_REPO
gh secret set OPENCLAW_BASE        --body "http://127.0.0.1:18789" --repo $AGENT_REPO
gh secret set AGENTGATEWAY_BASE    --body "http://127.0.0.1:18800" --repo $AGENT_REPO
```

## Paperclip organization contract

Agent Factory project definitions that create a startup company for Paperclip MUST create a `kind=project` factory with Paperclip metadata matching the dashboard seed `paperclip-startup-company`:

- `organization_kind`: `startup_company`
- `seat_model`: `position`
- Agent slug pattern: `{project}-{seat}`
- NATS subject pattern: `cortex.task.{project}.{seat}`
- Required seats/positions:
  - `ceo` → CEO → `role-ceo` → Paperclip role `CEO`
  - `cto` → CTO → `role-cto` → `CTO`
  - `pm` → Product Manager → `role-pm` → `PM`
  - `po` → Product Owner → `role-po` → `PO`
  - `staff-eng` → Staff Engineer → `role-staff-eng` → `STAFF-ENG`
  - `eng-backend` → Backend Engineer → `role-eng-backend` → `ENG-BACKEND`
  - `eng-frontend` → Frontend Engineer → `role-eng-frontend` → `ENG-FRONTEND`
  - `qa` → QA Engineer → `role-qa` → `QA`
  - `uxui` → UX/UI Designer → `role-uxui` → `UXUI`
- Optional seats: `eng-mobile`, `eng-esp32` when the product scope requires them.

Do not create a flat list of generic agents for Paperclip. Paperclip needs stable seats and role codes so ticket links in `paperclip_ticket_link` can bind each issue/run to the correct Cortex role and NATS subject.

## Verify

Create a test issue with label `stage/00-inbox` on the target repository:

```bash
gh issue create --repo $AGENT_REPO \
  --title "Agent Factory pipeline probe" \
  --body "Automated pipeline probe — close after verifying pipeline triggers." \
  --label "stage/00-inbox"
```

Confirm the triage workflow triggers within 60 seconds (check Actions tab on GitHub).

## CHECKPOINT 2

**STOP — operator question:** Does `gh issue view <probe-number> --repo $AGENT_REPO --json labels --jq '.labels[].name'` include the line `stage/01-triage` (not stuck on `stage/00-inbox`, not empty)?

Type `confirmed` to proceed.

## Next

→ `prompts/tools/81-projects.md`
