# Checkpoint Pattern

The old spoke checkpoint model is retired. The old
`scripts/rebuild/` directory (referenced by older docs) does not
exist — it was the pre-rebuild flow that 45c95a3 cleaned up.

Rebuild checkpoints are now phase gates tracked in `PLAN.md`:

1. Inventory evidence exists.
2. Local repo validation passes.
3. Backup and restore verification pass.
4. Host services validate.
5. Protected Hermes profiles validate.
6. Incus base and project instances validate.
7. Runtime cleanup validates.

Each phase must update `PLAN.md` with status, evidence, risks, and next action.

For the chat-driven installer prompts under `prompts/tools/`,
each install prompt applies the stop-on-question contract from
`prompts/CHECKPOINT-PATTERN.md` (this file) and the
input-gate + reuse-gate contract from
`prompts/CHAT-INPUT-CONTRACT.md`. A `## CHECKPOINT N` block
inside an install prompt halts the operator only when there is
a yes/no question to answer; status-only banners are forbidden.
