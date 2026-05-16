# {issue_title}

## Context

{short_context_explaining_user_need_or_system_problem}

## Current behavior

- {current_behavior_or_current_gap_1}
- {current_behavior_or_current_gap_2}

## Desired behavior

{plain_language_description_of_the_expected_outcome}

## Proposed implementation direction

- {implementation_direction_1}
- {implementation_direction_2}
- {implementation_direction_3}

## Design constraints / edge cases

- Do not deploy dev/staging/prod with Docker or Docker Compose; use Terraform through Floci.
- Docker/Docker Compose are allowed only inside CI/CD validation scripts and must clean up containers, networks, and volumes even when CI fails.
- Do not expose secrets, tokens, credentials, or private deployment notes.
- CI must follow `CI_POLICY.md`: unit tests, lint, typecheck/build as applicable; no e2e, ESP32/hardware, or iOS/Android native app builds until the owner asks to restore them.
- {project_specific_constraint_or_edge_case}

## Acceptance criteria

- [ ] {measurable_acceptance_criterion_1}
- [ ] {measurable_acceptance_criterion_2}
- [ ] {measurable_acceptance_criterion_3}
- [ ] For normal PR work, PR uses the CortexOS PR template and includes validation evidence.
- [ ] For first CI-green work, commit/push directly to `main`, post commit SHA + CI status in the Slack issue thread, and close the issue after CI is green.
- [ ] If owner approval is needed, PM sends Slack/Telegram buttons for Approve/Merge and Reject/Restart; explicit text fallback is accepted.

## Labels (apply on open)

- Stage: `stage:triage` for new work. Pipeline progresses `triage -> planning -> in-progress -> review-needed -> qa -> ready-to-merge -> merged -> deployed -> verified -> done`.
- Agent: pick exactly one of `agent:pm`, `agent:cto`, `agent:ceo`, `agent:po`, `agent:staff-eng`, `agent:qa`, `agent:uxui`, `agent:cortex`, `agent:antagonist`, `agent:eng-backend`, `agent:eng-frontend`, `agent:eng-mobile`, `agent:eng-esp32`, `agent:automated`.
- Other (optional): `component:<area>`, `size:<s|m|l|xl>`, `priority:<critical|high|medium|low>`, `type:<epic|story|task|bug|tech-debt>`, `needs-clarification` when blocked on the owner.

## Source report

> {user_request_or_original_report}
