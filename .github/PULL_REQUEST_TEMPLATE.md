<!--
  CortexOS PR template — husky-as-CI doctrine.
  Every checkbox is enforced by a corresponding gate in .github/workflows/ci.yml
  or by the local runner (scripts/ci-local.sh). Pre-flighting locally is the
  fastest way to a green PR.
-->

## Summary

What changed, why this approach, and what was intentionally left alone.

-
-
-

Closes #

> **Traceability.** If this PR implements an M0 / M1 / M2 milestone requirement,
> add the row to the **M0 traceability matrix** below. M0 docs are the source
> of truth for "what must ship"; an M0 row missing on the PR is a P1 review
> rejection.

| M0 doc | Requirement ID | Implementation file(s) | Notes |
|---|---|---|---|
| (e.g. `docs/TEST_STRATEGY.md`) | (e.g. §6 gate 7) | (e.g. `src/lib/components/Button.svelte`) | (e.g. vitest-axe on Button) |

## Type of change

- [ ] Bug fix (non-breaking change that fixes an issue)
- [ ] New feature (non-breaking change that adds functionality)
- [ ] Breaking change (fix or feature that would cause existing functionality to change)
- [ ] Docs only (no production code change)
- [ ] Infra / CI / platform

## Verification (run locally before requesting review)

`scripts/ci-local.sh` is the source of truth. Every checkbox below corresponds
to a CI gate — if it's unchecked, the CI gate will fail and the PR will not
merge.

- [ ] **Typecheck** — `pnpm -r run typecheck` exits 0
- [ ] **Lint** — `pnpm -r run lint` exits 0
- [ ] **Format** — `pnpm -r exec prettier --check .` exits 0
- [ ] **Markdown lint** — `pnpm exec markdownlint-cli2 'docs/**/*.md'` exits 0
- [ ] **Unit + integration tests** — `pnpm -r run test` exits 0
- [ ] **Coverage** — `pnpm -r run test:coverage` shows ≥95% on lines / branches / functions / statements
- [ ] **A11y** — `pnpm -r run test:a11y` exits 0 (no serious/critical axe violations)
- [ ] **Contract** — `pnpm -r run test:contract` exits 0 (mock + server schema parity)
- [ ] **E2E (chromium)** — `pnpm -r exec playwright test --project=chromium` exits 0
- [ ] **Build** — `pnpm -r run build` exits 0
- [ ] **Shellcheck** — `shellcheck --severity=error $(find scripts -name '*.sh')` exits 0
- [ ] **Secrets** — no `.env`, no credentials, no private IPs, no deployment notes in the diff
- [ ] **No SvelteKit Remote Functions** — `grep -RIn 'remoteFunctions' packages/` returns nothing

## E2E coverage

> **The PR rule (TEST_STRATEGY §10.2):** A PR that adds a page or an action
> MUST add a row to `packages/dashboard/docs/E2E_COVERAGE_MATRIX.md`
> and the corresponding Playwright spec before it can merge.

- [ ] No new pages / actions — N/A
- [ ] Added E2E row to `E2E_COVERAGE_MATRIX.md` (file + Test ID)
- [ ] Added Playwright spec under `e2e/specs/<surface>/`
- [ ] Mock scenario added under `src/lib/mocks/server/scenarios/<surface>/` (if new surface)
- [ ] Every new `+page.svelte` is referenced in the matrix (CI grep gate enforces this)

## Security review (Schneier reads this section)

- [ ] No new surface without a threat-model row (`docs/THREAT_MODEL.md`)
- [ ] Destructive actions route through the approval flow (no direct exec)
- [ ] Command policy unchanged (or changed in `src/lib/server/policy/command-policy.ts` with a security review)
- [ ] No secrets, tokens, or PII in the diff (gitleaks runs in CI; this is a belt-and-suspenders check)
- [ ] Auth / RBAC paths reviewed (Schneier tagged as CODEOWNER for `src/lib/server/auth/**`)
- [ ] CSRF protection on all new state-changing endpoints
- [ ] Input validation at the trust boundary (valibot schemas in form actions / `+server.ts`)
- [ ] Output encoding for any user-rendered HTML (Svelte's `{...}` is encoded by default — confirm no `{@html}` without explicit reason)
- [ ] No `Date.now()` or `Math.random()` in `src/**` (injected Clock/Random only — TEST_STRATEGY §7.3–§7.5)

## Schema & data layer (Kleppmann reads this section)

- [ ] No DB migration in this PR
- [ ] DB migration in this PR:
  - [ ] Migration file is forward-only (no rollback in the same file)
  - [ ] Migration ends with `INSERT INTO migrations (name) VALUES ('NNN_<desc>') ON CONFLICT DO NOTHING;`
  - [ ] Migration is idempotent (safe to run twice — `IF NOT EXISTS`, `ON CONFLICT`, etc.)
  - [ ] Migration tested against the testcontainers Postgres in CI
  - [ ] README / ARCHITECTURE updated if the schema shape changed visibly
  - [ ] Backward compatibility considered (existing clients / dashboard reads keep working)

## Deployment & infrastructure impact

- Runtime migration required: no / yes —
- Docker Compose changes: no / yes —
- systemd unit changes: no / yes — (Hightower reviews `templates/systemd/**`)
- pnpm workspace / lockfile changes: no / yes —
- CI workflow changes: no / yes — (Hightower reviews `.github/workflows/**`)
- New external service / API: no / yes —

## Risk & rollback

- Risk level: low / medium / high
- Rollback plan: (e.g. `git revert <sha>`; or feature flag flip; or no-op on the host)
- Blast radius: (e.g. only the dashboard; or all of cortex-dashboard.service consumers)
- Monitoring: (e.g. dashboard for `docker ps` count; or `journalctl -u cortex-dashboard.service` for errors)
- SLO impact: (e.g. none; or +50ms p99 on `/api/services`)

## Reviewer focus

Specific files / lines / decisions that benefit from a careful read:

-
-
-

> **First reviewer:** CODEOWNERS auto-routes by path. Add a second reviewer
> manually for any of: (a) `src/lib/server/{auth,audit,policy}/**`,
> (b) `src/lib/contracts/**`, (c) `.github/workflows/**`, (d) DB migrations,
> (e) destructive UI changes.
>
> **Final gate:** Edsger W. Dijkstra signs off on the platform-level
> exception list (force-push to main, hotfixes, lockfile pinning changes).

## Test run (paste the summary here)

```text
typecheck:    PASS / FAIL — <duration>
lint:         PASS / FAIL — <duration>
format:       PASS / FAIL — <duration>
markdown:     PASS / FAIL — <duration>
unit:         PASS / FAIL — <tests run> tests, <duration>
coverage:     lines=XX% branches=XX% functions=XX% statements=XX%
a11y:         PASS / FAIL — <duration>
contract:     PASS / FAIL — <duration>
e2e:          PASS / FAIL — <tests run> tests, <duration>
build:        PASS / FAIL — <duration>
shellcheck:   PASS / FAIL — <duration>
audit:        PASS / FAIL — <high/critical count>
```
