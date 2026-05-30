# Checkpoint Pattern

The old spoke checkpoint model is retired. Rebuild checkpoints are phase gates
in `PLAN.md`:

1. Inventory evidence exists.
2. Local repo validation passes.
3. Backup and restore verification pass.
4. Host services validate.
5. Protected Hermes profiles validate.
6. Incus base and project instances validate.
7. Runtime cleanup validates.

Each phase must update `PLAN.md` with status, evidence, risks, and next action.
