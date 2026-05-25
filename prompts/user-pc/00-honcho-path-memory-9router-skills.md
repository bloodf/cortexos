# User PC AI Harness, Honcho Path Memory, and 9Router Skills

## Chat Input Gate

This prompt follows `prompts/CHAT-INPUT-CONTRACT.md`. Do not assume any
operator-specific environment variables are already defined. Before using a
value such as a host, user, domain, token, password, project path, profile name,
or service URL, ask a **STOP — input question**, wait for the operator's answer,
and then substitute that answer into the commands you produce.

## Purpose

Bootstrap a user workstation so each AI harness uses the same CortexOS memory
contract while keeping memory isolated by project path. The user chooses the AI
harness they are running, for example `codex`, `claude`, `cursor`, `gemini`,
`opencode`, `pi`, `omp`, or `other`.

This prompt installs:

- A path-scoped Honcho environment loader.
- A small harness instruction file that tells the AI how to load the current
  path memory before doing work.
- The upstream 9Router skill docs in a shared local cache.
- Native skill or rule locations for harnesses with a known local convention.

## Safety

- Do not paste real secrets into a repository file.
- Store workstation secrets only in `~/.config/cortexos/honcho.env` with mode
  `0600`.
- The path identity is derived from the real project root plus a hash; the hash
  avoids collisions without publishing the full local path.
- The bootstrap writes only under the user home directory.

## Input Gate

**STOP — input question:** Please provide:

- `ai_harness`: one of `codex`, `claude`, `cursor`, `gemini`, `opencode`,
  `pi`, `omp`, or `other`.
- `honcho_base_url`: CortexOS Honcho URL, for example
  `https://<cortex-domain>:18690`.
- `honcho_api_key`: workstation Honcho API key.
- `ninerouter_url`: CortexOS 9Router URL, for example
  `https://<cortex-domain>:11434`.
- `ninerouter_key`: 9Router API key, or say `empty` when the endpoint does not
  require one.

Do not continue until the operator answers. After the answer, generate the
install command with those values substituted into the local
`~/.config/cortexos/honcho.env` write. Do not require any pre-existing
environment variables.

## Configure Local Secrets

After the operator answers the input gate, write the local config from the chat
answers:

```bash
install -d -m 0700 "$HOME/.config/cortexos"
cat >"$HOME/.config/cortexos/honcho.env" <<'EOF'
HONCHO_BASE_URL=<honcho_base_url_from_chat>
HONCHO_API_KEY=<honcho_api_key_from_chat>
NINEROUTER_URL=<ninerouter_url_from_chat>
NINEROUTER_KEY=<ninerouter_key_from_chat_or_empty>
AI_HARNESS=<ai_harness_from_chat>
EOF
chmod 0600 "$HOME/.config/cortexos/honcho.env"
```

Leave `NINEROUTER_KEY` empty when the endpoint is already protected by the
tailnet and 9Router does not require an API key.

## Install Harness Wiring

Run this once on the user PC:

```bash
install -d -m 0700 "$HOME/.config/cortexos" "$HOME/.local/bin" "$HOME/.local/share/cortexos/honcho-paths" "$HOME/.local/share/cortexos/ai-harness"

cat >"$HOME/.local/bin/cortex-honcho-path-env" <<'SH'
#!/usr/bin/env sh
set -eu

[ -f "$HOME/.config/cortexos/honcho.env" ] || {
  echo "Missing $HOME/.config/cortexos/honcho.env. Run the input-gated config step first." >&2
  exit 2
}
set -a
. "$HOME/.config/cortexos/honcho.env"
set +a

root="$(git rev-parse --show-toplevel 2>/dev/null || pwd -P)"
name="$(basename "$root" | tr '[:upper:]' '[:lower:]' | sed 's/[^a-z0-9]/-/g; s/--*/-/g; s/^-//; s/-$//')"
[ -n "$name" ] || name="workspace"

if command -v sha256sum >/dev/null 2>&1; then
  hash="$(printf '%s' "$root" | sha256sum | awk '{print substr($1,1,12)}')"
else
  hash="$(printf '%s' "$root" | shasum -a 256 | awk '{print substr($1,1,12)}')"
fi

workspace="pc-${name}-${hash}"
state_dir="$HOME/.local/share/cortexos/honcho-paths/${workspace}"
mkdir -p "$state_dir"

export HONCHO_BASE_URL="${HONCHO_BASE_URL:-}"
export HONCHO_API_KEY="${HONCHO_API_KEY:-}"
export HONCHO_WORKSPACE="$workspace"
export HONCHO_AI_PEER="${HONCHO_AI_PEER:-user-${USER:-local}}"
export NINEROUTER_URL="${NINEROUTER_URL:-}"
export NINEROUTER_KEY="${NINEROUTER_KEY:-}"
export CORTEX_PATH_ROOT="$root"
export CORTEX_PATH_STATE_DIR="$state_dir"
export CORTEX_PATH_DB="$state_dir/state.sqlite"

[ -n "$HONCHO_BASE_URL" ] || { echo "HONCHO_BASE_URL missing in $HOME/.config/cortexos/honcho.env" >&2; exit 2; }
[ -n "$HONCHO_API_KEY" ] || { echo "HONCHO_API_KEY missing in $HOME/.config/cortexos/honcho.env" >&2; exit 2; }
[ -n "$NINEROUTER_URL" ] || { echo "NINEROUTER_URL missing in $HOME/.config/cortexos/honcho.env" >&2; exit 2; }

printf 'HONCHO_BASE_URL=%s\n' "$HONCHO_BASE_URL"
printf 'HONCHO_WORKSPACE=%s\n' "$HONCHO_WORKSPACE"
printf 'HONCHO_AI_PEER=%s\n' "$HONCHO_AI_PEER"
printf 'NINEROUTER_URL=%s\n' "$NINEROUTER_URL"
printf 'NINEROUTER_KEY=%s\n' "$NINEROUTER_KEY"
printf 'CORTEX_PATH_ROOT=%s\n' "$CORTEX_PATH_ROOT"
printf 'CORTEX_PATH_STATE_DIR=%s\n' "$CORTEX_PATH_STATE_DIR"
printf 'CORTEX_PATH_DB=%s\n' "$CORTEX_PATH_DB"
SH
chmod 0755 "$HOME/.local/bin/cortex-honcho-path-env"

cat >"$HOME/.local/bin/cortex-ai-harness-install" <<'SH'
#!/usr/bin/env sh
set -eu

[ -f "$HOME/.config/cortexos/honcho.env" ] || {
  echo "Missing $HOME/.config/cortexos/honcho.env. Run the input-gated config step first." >&2
  exit 2
}
set -a
. "$HOME/.config/cortexos/honcho.env"
set +a

harness="${AI_HARNESS:-}"
[ -n "$harness" ] || { echo "AI_HARNESS missing in $HOME/.config/cortexos/honcho.env" >&2; exit 2; }
harness="$(printf '%s' "$harness" | tr '[:upper:]' '[:lower:]')"

case "$harness" in
  codex|claude|cursor|gemini|opencode|pi|omp|other) ;;
  *) echo "Unsupported AI_HARNESS: $harness" >&2; exit 2 ;;
esac

shared_root="$HOME/.local/share/cortexos/ai-harness"
shared_skills="$shared_root/skills"
install -d -m 0755 "$shared_skills"

base="https://raw.githubusercontent.com/decolua/9router/refs/heads/master/skills"
for name in 9router 9router-chat 9router-image 9router-tts 9router-stt 9router-embeddings 9router-web-search 9router-web-fetch; do
  install -d -m 0755 "$shared_skills/$name"
  curl -fsSL "$base/$name/SKILL.md" -o "$shared_skills/$name/SKILL.md"
done

instruction="$shared_root/CORTEX_HONCHO_MEMORY.md"
cat >"$instruction" <<'EOF'
# CortexOS Path Memory Contract

Before doing project work, load the current path-scoped CortexOS memory
environment:

```bash
eval "$("$HOME/.local/bin/cortex-honcho-path-env")"
```

Use these exported values for all memory operations:

- `HONCHO_BASE_URL`
- `HONCHO_API_KEY`
- `HONCHO_WORKSPACE`
- `HONCHO_AI_PEER`
- `CORTEX_PATH_ROOT`
- `CORTEX_PATH_STATE_DIR`
- `CORTEX_PATH_DB`

Never reuse memory from another path. The workspace name already includes a
stable hash of the current project root. Use `NINEROUTER_URL` and
`NINEROUTER_KEY` for 9Router-compatible model, web, image, speech, and
embedding operations when the harness supports these skills.
EOF

copy_skills() {
  target="$1"
  install -d -m 0755 "$target"
  for dir in "$shared_skills"/*; do
    [ -d "$dir" ] || continue
    name="$(basename "$dir")"
    install -d -m 0755 "$target/$name"
    cp "$dir/SKILL.md" "$target/$name/SKILL.md"
  done
}

append_block() {
  file="$1"
  title="$2"
  install -d -m 0755 "$(dirname "$file")"
  touch "$file"
  if ! grep -q "BEGIN CORTEXOS PATH MEMORY" "$file"; then
    {
      printf '\n<!-- BEGIN CORTEXOS PATH MEMORY -->\n'
      printf '# %s\n\n' "$title"
      cat "$instruction"
      printf '\n<!-- END CORTEXOS PATH MEMORY -->\n'
    } >>"$file"
  fi
}

case "$harness" in
  codex)
    copy_skills "${CODEX_HOME:-$HOME/.codex}/skills"
    append_block "${CODEX_HOME:-$HOME/.codex}/AGENTS.md" "CortexOS Codex Memory"
    ;;
  claude)
    copy_skills "$HOME/.claude/skills"
    append_block "$HOME/.claude/CLAUDE.md" "CortexOS Claude Memory"
    ;;
  cursor)
    install -d -m 0755 "$HOME/.cursor/rules"
    cp "$instruction" "$HOME/.cursor/rules/cortex-honcho-path-memory.mdc"
    copy_skills "$HOME/.cursor/9router-skills"
    ;;
  gemini)
    append_block "$HOME/.gemini/GEMINI.md" "CortexOS Gemini Memory"
    copy_skills "$HOME/.gemini/9router-skills"
    ;;
  opencode)
    append_block "$HOME/.config/opencode/AGENTS.md" "CortexOS OpenCode Memory"
    copy_skills "$HOME/.config/opencode/9router-skills"
    ;;
  pi|omp|other)
    install -d -m 0755 "$HOME/.config/cortexos/harnesses/$harness"
    cp "$instruction" "$HOME/.config/cortexos/harnesses/$harness/CORTEX_HONCHO_MEMORY.md"
    copy_skills "$HOME/.config/cortexos/harnesses/$harness/9router-skills"
    ;;
esac

printf 'Installed CortexOS AI harness wiring for %s\n' "$harness"
printf 'Shared instructions: %s\n' "$instruction"
printf 'Shared 9Router skills: %s\n' "$shared_skills"
SH
chmod 0755 "$HOME/.local/bin/cortex-ai-harness-install"

"$HOME/.local/bin/cortex-ai-harness-install"
```

## Per-Project Usage

In each project shell, load the path-scoped memory environment:

```bash
eval "$("$HOME/.local/bin/cortex-honcho-path-env")"
```

Optional `direnv` integration per project:

```bash
echo 'eval "$("$HOME/.local/bin/cortex-honcho-path-env")"' >> .envrc
direnv allow
```

For harnesses that do not have a native skill/rule folder, attach this file to
the harness persistent instructions:

```bash
$HOME/.local/share/cortexos/ai-harness/CORTEX_HONCHO_MEMORY.md
```

## Verify

From two different project directories:

```bash
eval "$("$HOME/.local/bin/cortex-honcho-path-env")"
printf '%s\n' "$HONCHO_WORKSPACE"
curl -fsS -H "Authorization: Bearer ${HONCHO_API_KEY}" "${HONCHO_BASE_URL%/}/health"
curl -fsS "${NINEROUTER_URL%/}/api/health"
```

Expected:

- Each project path prints a different `HONCHO_WORKSPACE`.
- Honcho health responds.
- 9Router health responds.
- The selected harness has either native skill/rule wiring or a CortexOS
  instruction file it can attach.
- No secrets are written into the project repository.
