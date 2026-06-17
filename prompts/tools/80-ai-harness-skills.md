# AI Harness Shared Skills

## Purpose

Install the same set of community skill / prompt libraries into every AI coding
agent on the host (and, optionally, into every Incus instance) so skills behave
consistently whether the operator is using Hermes, Claude Code, Kimi Code,
Cursor, Codex CLI, or Pi.

The shared library lives under `/opt/cortexos/hermes/skills/vendor` and
contains:

| Repository | What it adds |
| --- | --- |
| [DeusData/codebase-memory-mcp](https://github.com/DeusData/codebase-memory-mcp) | Local MCP server for codebase graph search, trace, architecture, and impact analysis. |
| [obra/superpowers](https://github.com/obra/superpowers) | Skills for systematic debugging, subagent-driven development, code review, planning, and git worktrees. |
| [mattpocock/skills](https://github.com/mattpocock/skills) | Engineering/productivity skills (TDD, PRD writing, triage, domain modeling, handoff, etc.). |
| [nidhinjs/prompt-master](https://github.com/nidhinjs/prompt-master) | Prompt engineering reference and helpers. |
| [hardikpandya/stop-slop](https://github.com/hardikpandya/stop-slop) | Removes AI-writing patterns from prose. |

## Prerequisites

- `31-9router.md` completed (Hermes / AI gateway is in place).
- `git`, `node`, and `npm` are available (baseline from `00-preflight.md`).
- `~/.local/bin` is on the operator `$PATH`.

## Sudo gate

**Not required on the host.** The installer runs as the operator user and only
writes to `/opt/cortexos/hermes/skills/vendor` (already owned by the operator),
`~/.hermes`, and the per-agent config dirs under `$HOME`.

Inside Incus instances, run the script as the instance operator user (same as
any other user-level tool install).

## Ask user

| Field | Default | Notes |
| --- | --- | --- |
| Install on every Incus instance too? | `yes` | Incus project creation runs the installer automatically; this field is only for retroactive/standalone installs. |

```bash
read -p "Install shared AI skills on every Incus instance? (yes/no) [yes]: " _inst
AI_SKILLS_INSTALL_INCUS="${_inst:-yes}"
```

## Todo

- [ ] CHECKPOINT 1 confirmed — host has `git`, `node`, `npm`, and the operator owns `/opt/cortexos/hermes/skills/vendor`
- [ ] Run `scripts/install-ai-harness-skills.sh` on the host
- [ ] Confirm `codebase-memory-mcp` is installed and the binary works: `codebase-memory-mcp --version`
- [ ] Confirm Hermes sees the new external skills: `bin/hermes-cortex skills list` (or any profile wrapper)
- [ ] Confirm the other agents have the skill directories on disk
- [ ] If `AI_SKILLS_INSTALL_INCUS=yes`, run the installer inside every Incus instance as the operator user
- [ ] CHECKPOINT 2 confirmed — every targeted agent has the shared libraries available

## CHECKPOINT 1

**STOP — operator question:** Is the host ready (`git`, `node`, `npm`, operator ownership of the vendor directory), and do you want to install on Incus instances too?

```bash
git --version && node --version && npm --version
stat -c '%U' /opt/cortexos/hermes/skills/vendor 2>/dev/null || echo "vendor dir missing"
```

Type `confirmed` to proceed.

## Install (host)

Run the idempotent installer from the repo root:

```bash
cd /opt/cortexos
./scripts/install-ai-harness-skills.sh
```

The script will:

1. Clone or pull all five repositories into `/opt/cortexos/hermes/skills/vendor`.
2. Patch every existing Hermes profile's `config.yaml` to load the vendor skill
   directories via `skills.external_dirs`.
3. Patch `scripts/hermes-profile-create.mjs` and `templates/hermes/filesystem-mcp.yaml`
   so **future** Hermes profiles get the same setup automatically.
4. Install the `codebase-memory-mcp` binary to `~/.local/bin` and let it
   auto-configure Claude Code, Codex CLI, and Cursor.
5. Copy the leaf skill directories into `~/.claude/skills`,
   `~/.kimi-code/skills`, `~/.cursor/skills-cursor`, `~/.codex/skills`, and
   `~/.pi/skills`.
6. Append `superpowers/CLAUDE.md` and `mattpocock-skills/CLAUDE.md` to
   `~/.claude/CLAUDE.md` with markers, so re-runs are idempotent.

## Verify

### 1. codebase-memory-mcp binary

```bash
command -v codebase-memory-mcp
codebase-memory-mcp --version
```

Expected: a version string such as `codebase-memory-mcp 0.8.1`.

### 2. Hermes skills

```bash
bin/hermes-cortex skills list 2>&1 | grep -Ei 'superpowers|prompt-master|stop-slop|mattpocock|codebase' || true
```

You should see skills such as `using-superpowers`, `prompt-master`, `stop-slop`,
and the mattpocock engineering/productivity skills.

### 3. Agent harness skill directories

```bash
for d in ~/.claude/skills ~/.kimi-code/skills ~/.cursor/skills-cursor ~/.codex/skills ~/.pi/skills; do
  echo "==> $d"
  ls "$d" | grep -Ei 'superpowers|prompt-master|stop-slop|tdd|triage|handoff' | head -5
done
```

Expected: each directory contains the relevant skill folders.

### 4. Hermes profile creation template

```bash
grep -A2 'skills.external_dirs' scripts/hermes-profile-create.mjs
grep -A3 'codebase-memory-mcp' templates/hermes/filesystem-mcp.yaml
```

Expected: the template now references the vendor directories and the MCP server.

## Install (every Incus instance)

`scripts/incus-create-project.sh` now runs the installer automatically as part
of creating a new Incus project, so new instances receive the shared libraries
without operator intervention.

For retroactive installs on existing instances, run the installer as the
instance operator user inside each instance:

```bash
for inst in $(sudo incus list -c n --format csv | grep -v '^$' | cut -d, -f1); do
  echo "==> $inst"
  sudo incus exec "$inst" -- su - cortexos -c \
    'cd /opt/cortexos && ./scripts/install-ai-harness-skills.sh'
done
```

## CHECKPOINT 2

**STOP — operator question:** Did the host verification steps succeed, and are all existing Incus instances targeted for retroactive install now covered?

Type `confirmed` to proceed.

## Next

→ `prompts/tools/82-mail-guardian.md` (or the next operator-surface tool in `_order.md`).
