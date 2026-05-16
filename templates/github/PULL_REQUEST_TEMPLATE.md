{short_human_title}

{clear_two_to_four_sentence_summary_of_the_change}. Explain what the user gets, why this approach was chosen, and what part of the system is intentionally untouched.

- {specific_change_1_with_file_or_behavior_reference}
- {specific_change_2_with_file_or_behavior_reference}
- {specific_change_3_with_file_or_behavior_reference}

Issue: Closes #{issue_number}
Agent: `{agent_name}`
Branch: `{branch_name}`

## Labels (apply on open)

- Stage: pick exactly one of `stage:triage`, `stage:planning`, `stage:in-progress`, `stage:review-needed`, `stage:changes-requested`, `stage:antagonist-review`, `stage:qa`, `stage:ready-to-merge`, `stage:merged`, `stage:deployed`, `stage:verified`, `stage:done`. PRs typically open at `stage:review-needed`.
- Agent: pick exactly one of `agent:pm`, `agent:cto`, `agent:ceo`, `agent:po`, `agent:staff-eng`, `agent:qa`, `agent:uxui`, `agent:cortex`, `agent:antagonist`, `agent:eng-backend`, `agent:eng-frontend`, `agent:eng-mobile`, `agent:eng-esp32`, `agent:automated`.
- Other (optional): `component:<area>`, `size:<s|m|l|xl>`, `priority:<critical|high|medium|low>`, `type:<epic|story|task|bug|tech-debt>`, `gate:<staff-reviewed|cto-approved|security-reviewed|qa-passed|qa-video-attached|visual-approved|po-accepted>`.

## Verification

- [ ] Unit tests — {command/result}
- [ ] Lint — {command/result}
- [ ] Typecheck/static checks — {command/result_or_not_applicable}
- [ ] Frontend/web build — {command/result_or_not_applicable}
- [ ] E2E stripped from CI until owner asks to restore it
- [ ] ESP32/hardware jobs stripped from CI
- [ ] iOS/Android native app builds stripped from CI; React Native uses JS/TS-only checks
- [ ] No secrets, credentials, or private deployment notes included

## Deployment / infrastructure impact

- Dev/staging/prod deployment path: Terraform through Floci
- Docker/Docker Compose usage: {none OR CI/CD validation only}
- CI container cleanup: {not applicable OR confirmed `docker compose down -v --remove-orphans` / `docker rm -f` cleanup on failure}
- Runtime migration required: {yes/no + details}

## Risk and rollback

- Risk level: {low|medium|high}
- Rollback: {how to revert safely}
- Data impact: {none OR describe migrations/backfills}

## Reviewer focus

- {what reviewers should inspect first}
- {edge cases or tradeoffs worth checking}

## Owner decision

The PM bot must request final approval in Telegram using inline buttons:

- ✅ Approve / Merge
- ❌ Reject / Restart with comments

Approval may come from a Telegram button or an explicit owner text message (`APPROVE`, `APPROVED`, `MERGE`, or `REJECT ...`). When approved, the PM/Cortex bot merges this PR and closes the linked issue. When rejected, it comments with the rejection reason and moves the issue back for rework.
