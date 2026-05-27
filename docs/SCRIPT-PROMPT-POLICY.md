# Script And Prompt Policy

CortexOS keeps prompts as the AI-facing install interface and scripts as the
deterministic runtime surface. A prompt may describe desired state and the
operator conversation. A script may mutate the machine only when the operation
must be repeatable without AI interpretation.

## Script Ownership

Keep a top-level `scripts/` file only when it fits one of these categories:

- `runtime-entrypoint`: invoked by systemd, wrappers, or a long-running service.
- `bootstrap-helper`: low-level host setup used by installer prompts.
- `validator`: deterministic check or smoke test.
- `renderer-installer`: idempotent file, profile, skill, or env renderer.
- `backup-update`: scheduled backup, update, rotation, or supply-chain job.
- `migration`: one-time data movement with tests or documented recovery use.

One-off recovery scripts do not belong in the public script surface after the
repair has been absorbed into prompts, runtime configuration, or readiness
checks. Move them under `recovery/` with clear operator instructions, or delete
them when they have no prompt, package, systemd, workflow, or test reference.

Every top-level script must be classified in
[`SCRIPT-INVENTORY.md`](SCRIPT-INVENTORY.md). `rtk pnpm
check:script-inventory` fails when a new top-level script is added without an
inventory row.

## Prompt Boundary

Prompts must describe the install/configuration flow, collect inputs in chat,
and name the desired state. They should not contain long historical fix notes,
"fix another prompt" instructions, or repeated corrective paragraphs for old
bugs. Move that material to troubleshooting docs.

Each prompt should use this skeleton:

1. `Purpose`
2. `Inputs`
3. `Desired State`
4. `Commands`
5. `Verification`
6. `Failure Handling`

Prompts that need operator values must reference
[`prompts/CHAT-INPUT-CONTRACT.md`](../prompts/CHAT-INPUT-CONTRACT.md) instead
of restating the full chat gate. Distro-dependent install prompts should say to
use `scripts/pkg.sh`; they should not duplicate package-manager detection
logic.

Service prompts configure their own service once and declare the outputs that
downstream prompts consume. Downstream prompts should read those declared
outputs instead of patching or restating upstream setup.
