# Branch Protection — `main`

**Status:** Authoritative. Apply this on `main` after the M1-WS7 CI lands.

This document is the contract for the `main` branch of `bloodf/cortexos`. It is
written so the user (Anita) can apply it via the GitHub UI **or** via the `gh`
CLI snippets at the bottom. The single source of truth for *what* a PR must
satisfy is here; the *how* is split into UI and CLI paths.

---

## 1. Why these rules

CortexOS doctrine (per `packages/dashboard/docs/TEST_STRATEGY.md` §6.2
and `CLAUDE.md`): **husky-as-CI**. Every gate below also runs locally via
`scripts/ci-local.sh`; the CI is the contract, not the fence. Branch
protection enforces the *minimum bar* — what the local gate already does, CI
re-asserts, and the branch refuses to absorb regressions.

The rules are also what the **code-agent squad** (Kelsey Hightower / Eda /
Margaret / Schneier / Kleppmann / Edsger) relies on. A PR that lands without
these checks is a snowflake. Snowflakes are a bug.

---

## 2. Required status checks (must all pass)

The single check **"CI / all-gates-pass"** is the umbrella. It aggregates the
13+1 blocking gates defined in `.github/workflows/ci.yml`. Each individual
gate can also be required (recommended) for clearer PR-side signal:

| # | Required check | Source | Blocking? | Why |
|---|---|---|---|---|
| 1 | `CI / all-gates-pass` | ci.yml | ✅ | The umbrella; fails if any required gate fails. |
| 2 | `CI / Gate 1 · Typecheck` | ci.yml | ✅ | svelte-check / tsc — every PR must typecheck. |
| 3 | `CI / Gate 2 · Lint (ESLint)` | ci.yml | ✅ | Airbnb-style (airbnb-extended). |
| 4 | `CI / Gate 3 · Prettier check` | ci.yml | ✅ | Format must match `prettier --write` output. |
| 5 | `CI / Gate 4 · Markdown lint` | ci.yml | ✅ | Docs are part of the contract. |
| 6 | `CI / Gate 5 · Unit + Integration (Vitest)` | ci.yml | ✅ | The floor. |
| 7 | `CI / Gate 6 · Coverage (≥95% + per-PR delta)` | ci.yml | ✅ | Per TEST_STRATEGY §5.1 + §5.4. |
| 8 | `CI / Gate 7 · a11y (vitest-axe)` | ci.yml | ✅ | Per TEST_STRATEGY §11.1.1. |
| 9 | `CI / Gate 8 · Contract (client ↔ server)` | ci.yml | ✅ | Per TEST_STRATEGY §8.2. |
| 10 | `CI / Gate 9 · E2E (Chromium)` | ci.yml | ✅ | Fast E2E lane. |
| 11 | `CI / Gate 10 · Production build` | ci.yml | ✅ | SvelteKit + adapter-node must build. |
| 12 | `CI / Gate 11 · CodeQL (security)` | ci.yml | ✅ | High/critical SARIF findings block. |
| 13 | `CI / Gate 12 · gitleaks (secrets)` | ci.yml | ✅ | Pre-commit + CI belt-and-suspenders. |
| 14 | `CI / Gate 13 · Dependency audit` | ci.yml | ✅ | `pnpm audit --prod --audit-level=high`. |
| 15 | `CI / Gate 15 · Shell scripts (shellcheck)` | ci.yml | ✅ | Per TEST_STRATEGY §6 gate 15. |
| 16 | `Codecov / codecov-project` | Codecov app | ✅ | 95% target + per-PR delta. |

### Optional checks (informational; not required)

| Check | Why optional |
|---|---|
| `CI / SBOM (informational)` | Gate 14b — non-blocking by design. |
| `CI / Gate 14 · E2E full matrix` | Main + nightly only; PRs use the chromium lane. |

---

## 3. Review requirements

| Setting | Value | Why |
|---|---|---|
| **Require pull request reviews before merging** | ✅ on | At least one human gates the merge. |
| **Required approving reviewers** | 1 | Squad uses 2-reviewer rule on risky work (security, schema, infra) — the second reviewer is added per-PR via the CODEOWNERS file, not as a global rule. |
| **Dismiss stale pull request approvals when new commits are pushed** | ✅ on | A push that changes the diff invalidates prior approvals. |
| **Require review from Code Owners** | ✅ on | CODEOWNERS drives reviewer routing. |
| **Restrict who can dismiss pull request reviews** | Repo admins | The "I approved by mistake" escape hatch stays narrow. |
| **Allowed actors who can bypass** | Edsger W. Dijkstra (final gate), Anita (Squad Leader) | Edsger is the platform-level exception; Anita is the operational exception. Both are recorded in the audit log. |

### CODEOWNERS

CODEOWNERS lives at `.github/CODEOWNERS`. Until that file is added, the
default reviewer pool is `@bloodf/cortexos-maintainers`. The expected owners
once CODEOWNERS is in place:

| Path | Owner | Why |
|---|---|---|
| `packages/dashboard/src/lib/server/policy/**` | Schneier | Command policy + RBAC predicates. |
| `packages/dashboard/src/lib/server/audit/**` | Schneier | Hash-chained audit log. |
| `packages/dashboard/src/lib/server/auth/**` | Schneier | PAM, sessions, CSRF. |
| `packages/dashboard/src/lib/server/db/**` | Kleppmann | Schema, migrations, queries. |
| `packages/dashboard/src/lib/contracts/**` | Margaret | Zod schemas shared client + server. |
| `packages/dashboard/src/lib/mocks/**` | Margaret | E2E mock layer (security-sensitive). |
| `packages/dashboard/docs/TEST_STRATEGY.md` | Margaret | Test strategy is her domain. |
| `packages/dashboard/docs/THREAT_MODEL.md` | Schneier | Threat model. |
| `.github/workflows/**` | Hightower | CI is the platform. |
| `scripts/ops/**`, `templates/systemd/**` | Hightower | Deploy scripts. |
| `packages/dashboard/svelte.config.*` | Hightower | SvelteKit config (Remote Functions risk). |
| `**/package.json`, `pnpm-lock.yaml`, `pnpm-workspace.yaml` | Hightower | Dependency surface. |

---

## 4. History requirements

| Setting | Value | Why |
|---|---|---|
| **Require linear history** | ✅ on | No merge commits on `main`. Squash or rebase only. Linear history is a precondition for clean bisects and stack PRs. |
| **Allow force pushes** | ❌ off | No one rewrites `main`. |
| **Allow deletions** | ❌ off | `main` is the only source of truth. |

---

## 5. Branch restrictions

| Setting | Value | Why |
|---|---|---|
| **Restrict pushes that create matching branches** | Edsger W. Dijkstra, Anita | Only the platform owner can create a new `main` (renaming, etc.). |
| **Restrict pushes** | Edsger W. Dijkstra, Anita | No one pushes directly to `main` — PRs only. |

---

## 6. Conversation requirements

| Setting | Value |
|---|---|
| **Require conversation resolution before merging** | ✅ on |
| **Require signed commits** | ❌ off (gpg-signed is nice-to-have, not a gate) |
| **Require linear history** | ✅ on (see §4) |

---

## 7. Apply via GitHub UI

1. Repo → **Settings** → **Branches** → **Add branch protection rule**.
2. **Branch name pattern:** `main`
3. **Protect matching branches** → enable.
4. **Require status checks to pass before merging** → enable.
   - Search and add every check listed in §2 (start with `CI / all-gates-pass`,
     then the individual gates for clearer PR-side signal).
   - Check **"Require branches to be up to date before merging"**.
5. **Require pull request reviews before merging** → enable, 1 reviewer, dismiss stale on push.
6. **Require review from Code Owners** → enable.
7. **Require linear history** → enable.
8. **Restrict who can push to matching branches** → add Edsger + Anita.
9. **Do not allow force pushes** → enable (the default).
10. **Do not allow deletions** → enable (the default).
11. **Require conversation resolution before merging** → enable.
12. **Save changes**.

---

## 8. Apply via `gh` CLI

Replace `bloodf` with the real org if different. Run as a repo admin.

```bash
REPO=bloodf/cortexos
BRANCH=main

gh api \
  --method PUT \
  /repos/$REPO/branches/$BRANCH/protection \
  --input - <<'JSON'
{
  "required_status_checks": {
    "strict": true,
    "contexts": [
      "CI / all-gates-pass",
      "CI / Gate 1 · Typecheck",
      "CI / Gate 2 · Lint (ESLint)",
      "CI / Gate 3 · Prettier check",
      "CI / Gate 4 · Markdown lint",
      "CI / Gate 5 · Unit + Integration (Vitest)",
      "CI / Gate 6 · Coverage (≥95% + per-PR delta)",
      "CI / Gate 7 · a11y (vitest-axe)",
      "CI / Gate 8 · Contract (client ↔ server)",
      "CI / Gate 9 · E2E (Chromium)",
      "CI / Gate 10 · Production build",
      "CI / Gate 11 · CodeQL (security)",
      "CI / Gate 12 · gitleaks (secrets)",
      "CI / Gate 13 · Dependency audit",
      "CI / Gate 15 · Shell scripts (shellcheck)",
      "Codecov / codecov-project"
    ]
  },
  "enforce_admins": false,
  "required_pull_request_reviews": {
    "dismiss_stale_reviews": true,
    "require_code_owner_reviews": true,
    "required_approving_review_count": 1,
    "require_last_push_approval": false
  },
  "restrictions": {
    "users": [],
    "teams": ["maintainers"],
    "apps": []
  },
  "required_linear_history": true,
  "allow_force_pushes": false,
  "allow_deletions": false,
  "block_creations": false,
  "required_conversation_resolution": true,
  "lock_branch": false,
  "allow_fork_syncing": false
}
JSON
```

### Verify

```bash
gh api /repos/bloodf/cortexos/branches/main/protection | jq .
```

### Required checks — list & remove drift

The `contexts` list must be kept in sync with the gate names in
`.github/workflows/ci.yml`. After any rename of a `name:` field, update both
this doc and the `gh api` payload above, then re-apply. A drift here means
either a gate runs but isn't required, or a check is required but the job no
longer exists.

A weekly cron in `scripts/ci-local.sh` (gate "ci-config-drift") greps this
file for the gate list and fails if a check exists in `ci.yml` that isn't
listed here.

---

## 9. Things explicitly NOT required

| Setting | Decision | Why |
|---|---|---|
| Require signed commits | ❌ off | Adds friction for a 4-person squad; GPG signing is encouraged but not a gate. |
| Require 2+ reviewers (global) | ❌ off | The 2-reviewer rule is per-PR (CODEOWNERS for risky paths), not a global floor. |
| Include admins | ❌ off | Admins can bypass for hotfixes; bypasses are logged in the audit log via the Edsger / Anita actors. |
| Restrict who can dismiss reviews to admins only | ✅ on | The "approved by mistake" escape hatch stays narrow. |
