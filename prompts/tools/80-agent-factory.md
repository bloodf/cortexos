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

- [ ] CHECKPOINT 1 confirmed
- [ ] Install
- [ ] Configure
- [ ] Verify
- [ ] CHECKPOINT 2 confirmed
## CHECKPOINT 1

**STOP — operator question:** The target GitHub repository URL and that you have admin access (needed to create labels and secrets)?

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

## Verify

Create a test issue with label `stage/00-inbox` on the target repository:

```bash
gh issue create --repo $AGENT_REPO \
  --title "Agent Factory smoke test" \
  --body "Automated smoke test — close after verifying pipeline triggers." \
  --label "stage/00-inbox"
```

Confirm the triage workflow triggers within 60 seconds (check Actions tab on GitHub).

## CHECKPOINT 2

**STOP — operator question:** The smoke-test issue triggered the triage workflow and the issue label advanced to `stage/01-triage`. Close the test issue?

Type `confirmed` to proceed.
## Next

→ `prompts/tools/81-projects.md`
