# MP-020f — remove the last 2 legacy react-hooks/exhaustive-deps disables

Implementer: kimi. Repo root: /opt/cortexos. Report:
`/opt/cortexos/.planning/harness/artifacts/impl-mp-020f-report.md`
Manifest input: `artifacts/recon-mp020-manifest.md` §3g (both effects
quoted in full — BINDING design input).
Scope: features/admin/EnvBrowser.tsx (~:77) and features/Terminal.tsx
(~:422) — behavior-sensitive React dependency surgery on the LIVE
product. SMALLEST micro-plan, HIGHEST review scrutiny.

## Tasks
1. RED: quote both effects in full + their current dep arrays + the
   disable comments.
2. Restructure each so the dep array is honest AND behavior is
   IDENTICAL, choosing per effect from (justify the choice in the
   report):
   a. `useRef` for values the effect reads but must not retrigger on
      (the standard "latest ref" pattern: a second effect keeps the ref
      current; the timer/subscription effect reads `ref.current`).
   b. Moving stable callbacks/objects out of the component or into
      `useCallback`/`useMemo` with honest deps so including them is a
      no-op retrigger-wise.
   c. Splitting one effect into two (mount-only + reactive) where the
      original conflated them.
   NEVER: adding the deps verbatim (changes retrigger cadence — that IS
   a behavior change), removing functionality, or new disables.
3. DELETE both disable comments. Verify:
   `pnpm exec eslint packages/dashboard-next 2>&1 | grep -cE 'exhaustive-deps|Unused eslint-disable'`
   → 0.
4. Behavior evidence per component (quote):
   - EnvBrowser: the reveal-expiry countdown still ticks once per `now`
     interval and refetches exactly when revealed+expired (describe the
     manual trace through the new code).
   - Terminal: reconnect/resize behavior still keyed ONLY on `id`
     (trace).
5. Gates: tsc 0; full suite zero failures (env sourced); build exit 0;
   format:check exit 0.
6. ONE commit: `fix(dashboard-next): MP-020f — honest effect deps, last legacy disables removed`
   Do NOT stage .planning/**. NEVER push.
End IMPL-COMPLETE or IMPL-BLOCKED: <reason>.

## Acceptance (binary)
- A1: `pnpm exec eslint packages/dashboard-next 2>&1 | grep -cE 'exhaustive-deps|Unused eslint-disable'`
  → 0 AND `grep -rn 'eslint-disable' packages/dashboard-next/src | wc -l`
  → 0 (the package's last disables gone).
- A2 (binary cadence proof): eslint's exhaustive-deps rule passing IS
  the binary verifier that every dep is honest; additionally the diff
  must show NO dep added to a timer/subscription effect's array unless
  routed through a ref/effect-split (reviewer instruction: REJECT any
  hunk where an identifier was appended verbatim to an existing dep
  array — that changes retrigger cadence by definition).
- A3: full suite zero failures at the MP-020e total N (binary); build
  exit 0; tsc 0.
- A4 (orchestrator): screen run PASS with /terminal WS handshake and
  /env-browser rendering structurally green (the run's existing binary
  checks), 18/18 overall.
