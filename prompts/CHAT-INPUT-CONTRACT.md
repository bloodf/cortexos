# Chat Input Contract

Every CortexOS prompt is a chat-driven installer prompt. It must collect the
data it needs from the operator during the chat session before emitting commands
that use that data.

## Rules

1. Do not require the operator to define environment variables before starting a
   prompt.
2. Do not say "set/export this variable and continue" as the primary workflow.
3. Before using any operator-specific value, ask a `STOP — input question` and
   wait for the answer.
4. Ask for the smallest useful set of values at the point they are needed.
5. After the operator answers, generate the concrete command, file, or secret
   write using the provided values.
6. Secrets may be written to runtime secret files, but they must not be written
   into prompts, templates, docs, git-tracked files, shell history, or chat
   summaries.
7. Existing runtime secret files may be read only after the prompt has asked the
   operator whether to reuse them.
8. A shell variable may be used inside a generated command only when the prompt
   also generated that variable assignment from a chat answer in the same block.

## Required Input Gate

Every prompt that needs operator-specific data must include a gate like this
before the first command that uses that data:

```markdown
## Input Gate

**STOP — input question:** Please provide:

- `<field>`: <why this is needed>
- `<field>`: <why this is needed>

Do not continue until the operator answers. After the answer, substitute those
values into the commands you produce. Do not rely on pre-existing environment
variables.
```

## Reuse Gate

When a prompt can reuse a runtime secret file, ask first:

```markdown
**STOP — input question:** Should I reuse the existing
`/opt/cortexos/.secrets/<name>.env` values if present, or should I ask you for
new values and rewrite the file?

Do not read or use that file until the operator answers.
```

## Verification

Verification commands may read runtime env files only when those files were
created or explicitly approved for reuse earlier in the same prompt.

## Prompt Shape

Prompts should reference this contract rather than restating it in full. Use
the canonical prompt skeleton in `docs/SCRIPT-PROMPT-POLICY.md`: Purpose,
Inputs, Desired State, Commands, Verification, and Failure Handling.
