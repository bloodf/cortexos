# Agent task

## Context

{short_context_explaining_user_need_or_system_problem}

## Current behavior

- {current_behavior_or_current_gap_1}
- {current_behavior_or_current_gap_2}

## Desired behavior

{plain_language_description_of_expected_outcome}

## Proposed implementation direction

- {implementation_direction_1}
- {implementation_direction_2}
- {implementation_direction_3}

## Constraints / edge cases

- Do not expose secrets, tokens, credentials, or private deployment notes.
- Follow `docs/AGENT-GATEWAY.md` and `docs/AUDIT.md` for validation.
- Use AgentGateway + hash-chained audit log when task touches orchestration.
- {project_specific_constraint_or_edge_case}

## Acceptance criteria

- [ ] {measurable_acceptance_criterion_1}
- [ ] {measurable_acceptance_criterion_2}
- [ ] {measurable_acceptance_criterion_3}
- [ ] PR uses CortexOS PR template and includes validation evidence.

## Labels

- Stage: `stage:triage` for new work.
- Agent: pick one of `agent:pm`, `agent:cto`, `agent:ceo`, `agent:po`, `agent:staff-eng`, `agent:qa`, `agent:uxui`, `agent:cortex`, `agent:antagonist`, `agent:eng-backend`, `agent:eng-frontend`, `agent:eng-mobile`, `agent:eng-esp32`, `agent:automated`.
- Other optional: `component:<area>`, `size:<s|m|l|xl>`, `priority:<critical|high|medium|low>`, `type:<epic|story|task|bug|tech-debt>`.

## Source report

> {user_request_or_original_report}
