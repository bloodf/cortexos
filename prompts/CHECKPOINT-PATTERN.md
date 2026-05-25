# Checkpoint Pattern — Spoke Verifiability Contract

## Chat Input Gate

This prompt follows `prompts/CHAT-INPUT-CONTRACT.md`. Do not assume any
operator-specific environment variables are already defined. Before using a
value such as a host, user, domain, token, password, project path, profile name,
or service URL, ask a **STOP — input question**, wait for the operator's answer,
and then substitute that answer into the commands you produce.

> Operating contract for every spoke under `prompts/tools/`. Applies to all
> CHECKPOINT blocks the operator confirms manually.

## Chat input rule

Every prompt also follows [CHAT-INPUT-CONTRACT.md](CHAT-INPUT-CONTRACT.md).
Prompts are chat-first, not preconfigured-shell-first: they must ask the
operator for required values, wait for the answer, and then produce concrete
commands using those answers. They must not require environment variables to be
defined before the prompt starts.

## Stop-on-question rule

**A prompt stops the operator only when there is an operator question to answer.** Every `## CHECKPOINT N` section MUST contain a `**STOP — operator question:** …` line followed by `Type \`confirmed\` to proceed.` Anything else (status banners, "ok proceed" markers, log-prints) is informational and does not halt execution. Status-only checkpoints are forbidden — convert them into a real yes/no question or delete them.

## Question quality rules

A good checkpoint question is **specific, single-claim, and evidence-bound**. The operator must be able to answer yes/no in seconds by looking at terminal output they just produced.

1. **One claim per checkpoint.** Do NOT chain checks with "AND … AND … AND". If you have three things to verify, you have three checkpoints — or the checks fold into a single, named probe (`scripts/validate-<spoke>.sh`) whose pass/fail is the single claim.
2. **Cite the exact probe.** Inline-quote the command the operator just ran (e.g. `curl -fsS <http://127.0.0.1:18790/health>`) and the exact expected output (e.g. `{"status":"ok"}`). No vague "service is up" wording.
3. **Express the failure mode, not the success mode, when failure is easy to misread.** Empty arrays, HTTP 200 with an error body, status `active (exited)` — call these out by name so a tired operator does not nod past them.
4. **Yes/no answerable from one terminal screen.** If the operator has to scroll, reformat, or run extra commands to answer, the checkpoint is too broad. Split it.
5. **No forward references.** A checkpoint may NOT depend on a downstream service the operator has not installed yet (see "The rule" below).

### Template

```markdown
## CHECKPOINT N

**STOP — operator question:** Did `<exact probe command>` return `<exact expected output>` and not `<the common failure-mode output>`?

Type `confirmed` to proceed.
```

## Todo quality rules

`## Todo` is the operator's running checklist for the spoke — NOT a section index. Each entry is a thing the operator does or verifies, in execution order.

1. **Verb-led, concrete.** `Install Ollama via curl|sh` not `Install`. `Pull nomic-embed-text + llama3.2:1b` not `Configure models`. `Confirm /health returns ok` not `Verify`.
2. **One operator action per item.** If a line bundles two unrelated actions, split it.
3. **Sequential order matches the prose below.** A reader skimming only the Todo should be able to reconstruct the install path.
4. **CHECKPOINT items are explicit and numbered.** Use `[ ] CHECKPOINT N confirmed — <one-line of what was verified>` so the operator sees what each gate is actually for.
5. **No filler entries.** Drop `Read this section`, `Understand the goal`, `Review prerequisites` — those are not work items.

### Template

```markdown
## Todo

- [ ] CHECKPOINT 1 confirmed — <preconditions met>
- [ ] <verb-led action 1>
- [ ] <verb-led action 2>
- [ ] …
- [ ] CHECKPOINT 2 confirmed — <post-install probe passes>
```

## The rule

**A spoke MUST NOT verify a service installed by a later spoke.**

Checkpoint criteria verify **only state owned by THIS spoke**. Any probe
that touches a service installed downstream is a graph-order bug, not a
test — it will block install on first run.

## Why

Spokes are ordered in `prompts/tools/_order.md` and executed linearly.
The operator confirms each `CHECKPOINT N` before continuing. If spoke `N`
asks for evidence produced only by spoke `N+k`, the install graph
deadlocks — exactly the failure mode found by the readiness review for
`00-preflight` (probed Hermes before `40-Hermes`), `13-tailscale-serve` (probed
Grafana / Prometheus / Loki / cAdvisor / Paperclip / Langfuse before any of
them existed), and `20-prometheus` (asked for `cadvisor` / `node`
targets before those exporters ran).

## What each spoke is allowed to probe

| Allowed                                                       | Forbidden                                                  |
|---------------------------------------------------------------|------------------------------------------------------------|
| Local process / container started by **this** spoke            | Any process / container installed by a later spoke         |
| Local TCP listener bound by **this** spoke                     | Endpoints reachable only after a later spoke configures them |
| Local config / unit file written by **this** spoke             | Cross-service flows that span more than one upstream spoke |
| State files written by **this** spoke                          | "Operator confirms in Grafana" / "operator confirms in UI" without an API probe |
| Health endpoints owned by **this** spoke's binary              | Future-spoke health endpoints                              |

When in doubt: if removing every later spoke from the graph would make
the probe fail, the probe does **not** belong here. Move it to the
owning spoke and to `99-final-validation`.

## Detection of future-spoke state is informational only

If a spoke needs to know whether an optional later-spoke service is
already present (e.g. preflight reading whether Hermes is installed),
the probe is **informational, never blocking**:

1. Detect existence with a non-fatal command (`command -v`, `curl
   --max-time 5 ... || true`, `systemctl is-active --quiet ...`).
2. If absent, write the marker `NOT_INSTALLED` to the spoke's state
   record (`.secrets/.setup-state.json` or equivalent) and continue.
3. Explicitly note in the prompt prose **which later spoke installs it**
   so the operator does not chase a phantom failure.
4. Do **not** `exit 1`, `HALT`, or fail the checkpoint based on the
   informational probe.

## Consolidated end-to-end checks live in `99-final-validation`

Cross-service flows (Tailscale Serve → Grafana, Prometheus → cAdvisor target UP,
Fluent Bit → Loki query, Paperclip → Hermes → Honcho workflow dispatch) are
verified once in `prompts/tools/99-final-validation.md` after every
spoke has run. That is the only place where the full system is in
scope.

## Checklist for prompt authors

Before merging a new or edited spoke:

- [ ] Every `curl`, `Paperclip`, `psql`, `redis-cli`, `docker compose ps`
      in the CHECKPOINT region targets only this spoke's surface.
- [ ] Any reference to a future spoke is informational and produces
      `NOT_INSTALLED` rather than failing.
- [ ] Any cross-service probe moved to `99-final-validation.md`.
- [ ] Operator prose names the later spoke that owns each deferred check.
- [ ] Required operator-specific values are collected by a `STOP — input
      question` before use.
- [ ] The prompt does not require pre-existing environment variables.
- [ ] Docker Compose starts use explicit `container_name` values for CortexOS
      services and `docker compose up -d --remove-orphans`, with no `--scale`
      instructions that can create `-2`, `-3`, or other numbered containers.

## Reference

This contract is referenced from `SETUP.md` (Install Order section) and
governs every spoke under `prompts/tools/`. Violations are install
graph blockers and must be fixed before release.
