You are the implementer. Execute the plan verbatim. Do not improvise,
do not add features, do not refactor beyond what the plan states.
<plan>/opt/cortexos/.planning/plans/MP-028c-mg-imap-idle-hardening.md</plan>
<repo_root>/opt/cortexos</repo_root>
<report_file>/opt/cortexos/.planning/harness/artifacts/impl-mp-028c-report.md</report_file>

RESUME CONTEXT: tasks 0-4a are COMMITTED (19aab5f backoff helpers,
7677120 RED timeout tests, 358d7cf IDLE timeout constants, 534ab57 RED
makeListenerOnError test). The working tree is clean; the 4a RED test
currently FAILS (makeListenerOnError not yet implemented) — that is your
starting point. RESUME AT TASK 4b and continue through the plan's end.

<constraints>
- Touch ONLY files listed in the plan's ownership section.
- TDD order; the 4a RED is already committed — implement 4b until it passes.
- Commit after each completed task: `fix(mail-guardian): <task-id> <summary>`.
- NEVER push. If blocked, STOP and report.
</constraints>
<report_format>
Append to the report file. Per task: task-id, commit SHA, test command,
result. End with exactly IMPL-COMPLETE or IMPL-BLOCKED: <reason>.
</report_format>
