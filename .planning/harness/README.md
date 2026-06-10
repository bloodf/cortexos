# CLI worker harness

Claude orchestrates and plans. External CLIs implement, review, and run gates.
No model reviews its own output.

| Role | Worker key | CLI |
|---|---|---|
| Implementer | `m3` | `pi --provider minimax --model MiniMax-M3` |
| Diff gate + analyst | `kimi` | `kimi -p` under `timeout` |
| Recon + gate runner | `m27-hs` | `pi --provider minimax --model MiniMax-M2.7-highspeed -t read,bash` |
| Plan gate critic | `gpt-5.5` | `pi --provider openai-codex --model gpt-5.5 -nt` |

## Scripts

- `run-worker.sh <job.json>` — dispatch a job, log to `artifacts/<id>.log`,
  verify every `expected_outputs` entry exists non-empty. Exit 0 only on full pass.
- `run-critic.sh plan <doc> [context...]` — gpt-5.5 plan gate.
  `run-critic.sh diff <plan> <git-base> [path-filters...]` — kimi diff gate.
  Both write `artifacts/critic-*.md` and exit with the verdict code.
- `parse-verdict.sh <artifact>` — 0 PASS, 1 REJECT, 2 missing.

Job spec: `{"id", "worker": "kimi|m3|m27-hs|gpt-5.5", "timeout", "prompt_file", "expected_outputs": []}`

## Per-unit workflow (binding)

micro-plan (Claude) → `run-critic.sh plan` gate → `run-worker.sh` m3 implement
(TDD, commit per task, never push) → m27-hs runs tests/lint → `run-critic.sh
diff` gate → Claude pushes. Max 3 reject cycles per document, then escalate
with per-finding dispositions; overrules logged in `GATE-RESOLUTION.md`.

## CLI quirks (verified — do not rediscover)

- kimi cannot combine `-y` with `-p`; `-p` runs tools unapproved anyway.
  Process lingers: always under `timeout`; rc 124 is success if outputs exist.
  Output lines carry a `• ` prefix — parsers tolerate leading non-alpha.
- pi: always pass `--provider/--model/--no-session`; ignore the stale
  default-model warning; output ends in control sequences (lib.sh strips
  them); `-p` buffers until completion, so judge progress by file/commit side
  effects. Sessions can die silently (rc 1, empty log) — recover with a
  CONTINUATION job citing commit SHAs done and tasks remaining.
- All paths resolve to absolute before any `cd`; empty target files hard-fail
  (a critic fed an empty doc returns a false verdict).

`artifacts/` and `jobs/` are gitignored; scripts and `prompts/*.tmpl.md` +
`critic-contract.md` are committed.
