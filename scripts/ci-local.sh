#!/usr/bin/env bash
# scripts/ci-local.sh — Husky-as-CI: every gate that runs in CI runs here.
#
# Doctrine (per packages/cortex-dashboard/docs/TEST_STRATEGY.md §6.2 and
# CLAUDE.md): "husky-as-CI, not GitHub Actions as the source of truth."
#
# Usage:
#   scripts/ci-local.sh                # run all gates
#   scripts/ci-local.sh --fast         # skip the slow lanes (E2E, coverage, audit)
#   scripts/ci-local.sh --gate lint    # run a single gate (e.g. lint, typecheck, e2e)
#   scripts/ci-local.sh --list         # list gate names
#   scripts/ci-local.sh --help         # show usage
#
# Exit codes:
#   0  — all gates passed
#   1  — at least one gate failed
#   2  — pre-flight failed (e.g. wrong Node version, no pnpm, no lockfile)
#
# Every gate here MUST mirror the corresponding step in .github/workflows/ci.yml.
# If you change a gate here, change the workflow too. If you change the workflow,
# change this script. The husky pre-push hook (when added) calls this script.

set -euo pipefail

# ────────────────────────────────────────────────────────────────────────
# Configuration — keep in sync with TECH_STACK.md §1
# ────────────────────────────────────────────────────────────────────────
readonly SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
readonly REPO_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"

# Pinned toolchain per TECH_STACK.md §1
readonly REQUIRED_NODE_MAJOR="24"
readonly REQUIRED_PNPM_MAJOR="11"
readonly SVELTE_PKG="@cortexos/cortex-dashboard"
readonly LEGACY_PKG="@cortexos/dashboard"

# Color output (skipped if NO_COLOR is set or stdout is not a tty)
if [[ -t 1 && -z "${NO_COLOR:-}" ]]; then
    readonly C_RED=$'\033[0;31m'
    readonly C_GREEN=$'\033[0;32m'
    readonly C_YELLOW=$'\033[0;33m'
    readonly C_BLUE=$'\033[0;34m'
    readonly C_BOLD=$'\033[1m'
    readonly C_RESET=$'\033[0m'
else
    readonly C_RED="" C_GREEN="" C_YELLOW="" C_BLUE="" C_BOLD="" C_RESET=""
fi

# ────────────────────────────────────────────────────────────────────────
# Gate registry — the source of truth for "what is a gate"
# ────────────────────────────────────────────────────────────────────────
# Order matters: cheap, fast-fail gates run first; slow E2E / coverage run last.
GATES=(
    "preflight"
    "install"
    "typecheck"
    "lint"
    "format"
    "markdown"
    "unit"
    "a11y"
    "contract"
    "coverage"
    "build"
    "e2e"
    "shell"
    "audit"
    "secrets"
    "no-remote-functions"
)

# Gates excluded from --fast
SLOW_GATES=("coverage" "e2e" "audit" "shell")

# ────────────────────────────────────────────────────────────────────────
# Output helpers
# ────────────────────────────────────────────────────────────────────────
log()   { printf '%s[ci-local]%s %s\n' "${C_BLUE}" "${C_RESET}" "$*"; }
ok()    { printf '%s[ok]%s       %s\n' "${C_GREEN}" "${C_RESET}" "$*"; }
warn()  { printf '%s[warn]%s     %s\n' "${C_YELLOW}" "${C_RESET}" "$*"; }
err()   { printf '%s[fail]%s     %s\n' "${C_RED}" "${C_RESET}" "$*" >&2; }
header() {
    printf '\n%s%s── %s ──%s\n' "${C_BOLD}" "${C_BLUE}" "$*" "${C_RESET}"
}

# ────────────────────────────────────────────────────────────────────────
# Pre-flight
# ────────────────────────────────────────────────────────────────────────
gate_preflight() {
    header "Pre-flight"

    # Repo root
    if [[ ! -f "${REPO_ROOT}/pnpm-workspace.yaml" ]]; then
        err "Not a CortexOS monorepo (no pnpm-workspace.yaml at ${REPO_ROOT})"
        return 2
    fi

    # Node version — warn on mismatch, do not fail. CI enforces the canonical
    # version (Node ${REQUIRED_NODE_MAJOR}); the local runner is fast feedback.
    if ! command -v node >/dev/null 2>&1; then
        err "Node.js not found. Install Node ${REQUIRED_NODE_MAJOR}.x (see TECH_STACK.md §1)."
        return 2
    fi
    local node_major
    node_major="$(node --version | sed -E 's/^v([0-9]+).*/\1/')"
    if [[ "${node_major}" != "${REQUIRED_NODE_MAJOR}" ]]; then
        warn "Node $(node --version) detected; recommended ${REQUIRED_NODE_MAJOR}.x (TECH_STACK §1)."
        warn "Continuing — CI will fail on a version mismatch if it matters."
    else
        ok "Node $(node --version)"
    fi

    # pnpm
    if ! command -v pnpm >/dev/null 2>&1; then
        err "pnpm not found. Install pnpm ${REQUIRED_PNPM_MAJOR}.x (corepack enable && corepack prepare pnpm@${REQUIRED_PNPM_MAJOR}.* --activate)."
        return 2
    fi
    local pnpm_major
    pnpm_major="$(pnpm --version | sed -E 's/^([0-9]+).*/\1/')"
    if [[ "${pnpm_major}" != "${REQUIRED_PNPM_MAJOR}" ]]; then
        warn "pnpm ${pnpm_major}.x detected; recommended ${REQUIRED_PNPM_MAJOR}.x. Continuing — override locally with \`pnpm@${REQUIRED_PNPM_MAJOR}\` via corepack if you hit issues."
    else
        ok "pnpm $(pnpm --version)"
    fi

    # Lockfile exists (frozen-lockfile install needs it)
    if [[ ! -f "${REPO_ROOT}/pnpm-lock.yaml" ]]; then
        warn "pnpm-lock.yaml not found. The first install will be non-frozen. Commit the resulting lockfile."
    else
        ok "pnpm-lock.yaml present"
    fi

    ok "Pre-flight passed"
    return 0
}

# ────────────────────────────────────────────────────────────────────────
# Install
# ────────────────────────────────────────────────────────────────────────
gate_install() {
    header "Install (frozen lockfile)"
    (
        cd "${REPO_ROOT}"
        if [[ -f pnpm-lock.yaml ]]; then
            pnpm install --frozen-lockfile
        else
            warn "No lockfile — running non-frozen install. Commit the lockfile afterward."
            pnpm install
        fi
    )
    ok "Install complete"
}

# ────────────────────────────────────────────────────────────────────────
# Gate 1 · Typecheck
# ────────────────────────────────────────────────────────────────────────
gate_typecheck() {
    header "Gate 1 · Typecheck (svelte-check / tsc)"
    (
        cd "${REPO_ROOT}"
        pnpm -r --if-present run typecheck
    )
    ok "Typecheck passed"
}

# ────────────────────────────────────────────────────────────────────────
# Gate 2 · Lint
# ────────────────────────────────────────────────────────────────────────
gate_lint() {
    header "Gate 2 · Lint (ESLint, Airbnb via airbnb-extended)"
    (
        cd "${REPO_ROOT}"
        pnpm -r --if-present run lint
    )
    ok "Lint passed"
}

# ────────────────────────────────────────────────────────────────────────
# Gate 3 · Prettier check
# ────────────────────────────────────────────────────────────────────────
gate_format() {
    header "Gate 3 · Prettier check"
    (
        cd "${REPO_ROOT}"
        pnpm -r --if-present exec prettier --check .
    )
    ok "Format passed"
}

# ────────────────────────────────────────────────────────────────────────
# Gate 4 · Markdown lint (docs/, README, AGENTS, CLAUDE)
# ────────────────────────────────────────────────────────────────────────
gate_markdown() {
    header "Gate 4 · Markdown lint"
    (
        cd "${REPO_ROOT}"
        # The exact globs mirror .github/workflows/ci.yml (Gate 4).
        # Use npx so markdownlint-cli2 is fetched on demand.
        npx --yes markdownlint-cli2 \
            'packages/cortex-dashboard/docs/**/*.md' \
            'docs/**/*.md' \
            'README.md' \
            'CONTRIBUTING.md' \
            'AGENTS.md' \
            'CLAUDE.md' \
            '#node_modules' \
            '#**/node_modules/**' \
            '#**/CHANGELOG.md' \
            '#**/.svelte-kit/**' \
            '#**/build/**'
    )
    ok "Markdown lint passed"
}

# ────────────────────────────────────────────────────────────────────────
# Gate 5 · Unit + integration tests
# ────────────────────────────────────────────────────────────────────────
gate_unit() {
    header "Gate 5 · Unit + Integration (Vitest)"
    (
        cd "${REPO_ROOT}"
        pnpm -r --if-present run test
    )
    ok "Unit + integration passed"
}

# ────────────────────────────────────────────────────────────────────────
# Gate 6 · Coverage (95% threshold; per-PR delta checked in Codecov)
# ────────────────────────────────────────────────────────────────────────
gate_coverage() {
    header "Gate 6 · Coverage (≥95% lines/branches/functions/statements)"
    (
        cd "${REPO_ROOT}"
        # The threshold is enforced by vitest.config.ts (TEST_STRATEGY §1.2).
        # A drop below 95% on any metric fails the run.
        pnpm -r --if-present run test:coverage
    )
    ok "Coverage passed"
}

# ────────────────────────────────────────────────────────────────────────
# Gate 7 · A11y (vitest-axe on shared components)
# ────────────────────────────────────────────────────────────────────────
gate_a11y() {
    header "Gate 7 · a11y (vitest-axe)"
    (
        cd "${REPO_ROOT}"
        pnpm -r --if-present run test:a11y
    )
    ok "a11y passed"
}

# ────────────────────────────────────────────────────────────────────────
# Gate 8 · Contract (Zod schema parity between client mock and server route)
# ────────────────────────────────────────────────────────────────────────
gate_contract() {
    header "Gate 8 · Contract (client mock ↔ server route)"
    (
        cd "${REPO_ROOT}"
        pnpm -r --if-present run test:contract
    )
    ok "Contract passed"
}

# ────────────────────────────────────────────────────────────────────────
# Gate 9 · E2E (Chromium only — fast lane; the CI runs the full matrix on main)
# ────────────────────────────────────────────────────────────────────────
gate_e2e() {
    header "Gate 9 · E2E (Chromium)"
    (
        cd "${REPO_ROOT}"
        # E2E_MOCK_MODE=1 forces the dev server to route fetches through the
        # mock layer (TEST_STRATEGY §4). Never run E2E without it.
        export E2E_MOCK_MODE=1
        export CI=1
        pnpm -r --if-present exec playwright test --project=chromium
    )
    ok "E2E (chromium) passed"
}

# ────────────────────────────────────────────────────────────────────────
# Gate 10 · Production build
# ────────────────────────────────────────────────────────────────────────
gate_build() {
    header "Gate 10 · Production build"
    (
        cd "${REPO_ROOT}"
        pnpm -r --if-present run build
    )
    ok "Build passed"
}

# ────────────────────────────────────────────────────────────────────────
# Gate 11 · Shell scripts (shellcheck --severity=error + bash -n)
# ────────────────────────────────────────────────────────────────────────
gate_shell() {
    header "Gate 11 · Shell scripts (shellcheck + bash -n)"

    if ! command -v shellcheck >/dev/null 2>&1; then
        warn "shellcheck not found. Install with: brew install shellcheck  /  apt-get install -y shellcheck"
        warn "Skipping shell gate. CI will still enforce it."
        return 0
    fi

    # bash -n parse-check (fast)
    local files=()
    while IFS= read -r -d '' f; do
        files+=("$f")
    done < <(find "${REPO_ROOT}/scripts" "${REPO_ROOT}/templates/scripts" "${REPO_ROOT}/stacks" \
              -name '*.sh' -not -path '*/node_modules/*' -print0 2>/dev/null || true)
    for f in "${files[@]:-}"; do
        [[ -n "$f" ]] || continue
        bash -n "$f"
    done
    ok "bash -n: all scripts parse"

    # Run shellcheck at error severity (warnings are allowed per project style).
    if [[ ${#files[@]} -gt 0 ]]; then
        shellcheck --severity=error "${files[@]}"
        ok "shellcheck --severity=error: clean"
    else
        warn "No .sh files under scripts/, templates/scripts/, or stacks/"
    fi
}

# ────────────────────────────────────────────────────────────────────────
# Gate 12 · Dependency audit
# ────────────────────────────────────────────────────────────────────────
gate_audit() {
    header "Gate 12 · Dependency audit (pnpm audit --prod --audit-level=high)"
    (
        cd "${REPO_ROOT}"
        pnpm audit --prod --audit-level=high
    )
    ok "Audit passed"
}

# ────────────────────────────────────────────────────────────────────────
# Gate 13 · Secrets — gitleaks if available, otherwise a grep fallback
# ────────────────────────────────────────────────────────────────────────
gate_secrets() {
    header "Gate 13 · Secrets scan"

    if command -v gitleaks >/dev/null 2>&1; then
        (
            cd "${REPO_ROOT}"
            gitleaks detect --source . --no-banner --exit-code 1
        )
        ok "gitleaks: clean"
    else
        warn "gitleaks not found locally. Falling back to a grep for high-risk patterns."
        # Lightweight fallback: scan staged + working-tree files for token-like
        # strings. This is NOT a replacement for gitleaks; it's a smoke check.
        local bad=0
        # Patterns: AWS keys, GitHub PATs, generic 'token' / 'password' assignments
        # to non-example values
        if grep -RInE --include='*.{ts,tsx,js,mjs,cjs,json,yml,yaml,env,sh,svelte}' \
              -e 'AKIA[0-9A-Z]{16}' \
              -e 'ghp_[A-Za-z0-9]{36}' \
              -e 'sk-[A-Za-z0-9]{20,}' \
              -e 'xox[baprs]-[A-Za-z0-9-]{10,}' \
              "${REPO_ROOT}" --exclude-dir=node_modules --exclude-dir=.git \
              --exclude-dir=.svelte-kit --exclude-dir=.next 2>/dev/null; then
            err "High-risk secret pattern found in working tree (see lines above)."
            err "Run gitleaks locally or pre-commit secretlint to inspect."
            bad=1
        fi
        if [[ $bad -ne 0 ]]; then
            return 1
        fi
        ok "Grep fallback clean (install gitleaks for full coverage)"
    fi
}

# ────────────────────────────────────────────────────────────────────────
# Gate 14 · No SvelteKit Remote Functions (TECH_STACK.md §4 strict rule)
# ────────────────────────────────────────────────────────────────────────
gate_no_remote_functions() {
    header "Gate 14 · No SvelteKit Remote Functions"
    (
        cd "${REPO_ROOT}"
        local hits
        hits="$(grep -RIn --include='svelte.config.*' \
            -E 'remoteFunctions|experimental\.async' packages/ 2>/dev/null || true)"
        if [[ -n "$hits" ]]; then
            err "SvelteKit Remote Functions are forbidden (TECH_STACK §4):"
            printf '%s\n' "$hits" >&2
            return 1
        fi
    )
    ok "No Remote Functions detected"
}

# ────────────────────────────────────────────────────────────────────────
# Driver
# ────────────────────────────────────────────────────────────────────────
run_gate() {
    local gate="$1"
    local fn="gate_${gate//-/_}"
    if declare -F "$fn" >/dev/null 2>&1; then
        "$fn"
    else
        err "Unknown gate: ${gate}"
        err "Run \`$0 --list\` for the list of available gates."
        return 2
    fi
}

list_gates() {
    printf '%sAvailable gates:%s\n' "${C_BOLD}" "${C_RESET}"
    for g in "${GATES[@]}"; do
        printf '  - %s\n' "$g"
    done
}

usage() {
    cat <<EOF
Usage: $0 [options]

Options:
  --fast              Skip slow gates: ${SLOW_GATES[*]}
  --gate <name>       Run a single gate (repeatable: --gate lint --gate test)
  --list              List available gates
  -h, --help          Show this help

Examples:
  $0                       # Run every gate (the husky pre-push default)
  $0 --fast                # Run every gate except coverage, e2e, audit, shell
  $0 --gate lint           # Run only the lint gate
  $0 --gate lint --gate typecheck   # Run lint then typecheck

Exit codes:
  0   all gates passed
  1   at least one gate failed
  2   pre-flight failed (wrong toolchain, missing lockfile, etc.)

Environment:
  NO_COLOR=1            disable colored output
EOF
}

main() {
    local run_fast=false
    local only_gates=()

    while [[ $# -gt 0 ]]; do
        case "$1" in
            --fast)
                run_fast=true
                shift
                ;;
            --gate)
                [[ $# -ge 2 ]] || { err "--gate requires an argument"; usage; exit 2; }
                only_gates+=("$2")
                shift 2
                ;;
            --list)
                list_gates
                exit 0
                ;;
            -h|--help)
                usage
                exit 0
                ;;
            *)
                err "Unknown option: $1"
                usage
                exit 2
                ;;
        esac
    done

    log "CortexOS local CI runner — husky-as-CI"
    log "Repo: ${REPO_ROOT}"

    # Build the gate list to run.
    local to_run=()
    if [[ ${#only_gates[@]} -gt 0 ]]; then
        to_run=("${only_gates[@]}")
    else
        to_run=("${GATES[@]}")
        if [[ "$run_fast" == true ]]; then
            local filtered=()
            for g in "${to_run[@]}"; do
                local skip=false
                for s in "${SLOW_GATES[@]}"; do
                    if [[ "$g" == "$s" ]]; then skip=true; break; fi
                done
                if [[ "$skip" == false ]]; then
                    filtered+=("$g")
                fi
            done
            to_run=("${filtered[@]}")
            log "Fast mode: skipping ${SLOW_GATES[*]}"
        fi
    fi

    local failed=()
    local total=${#to_run[@]}
    local i=0
    for g in "${to_run[@]}"; do
        i=$((i+1))
        log "($i/$total) Running gate: $g"
        if ! run_gate "$g"; then
            failed+=("$g")
            err "Gate failed: $g"
        fi
    done

    header "Summary"
    if [[ ${#failed[@]} -eq 0 ]]; then
        ok "All ${total} gates passed."
        exit 0
    else
        err "Failed gates (${#failed[@]}/${total}): ${failed[*]}"
        exit 1
    fi
}

main "$@"
