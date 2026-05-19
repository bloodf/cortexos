# Checkpoint Pattern — Spoke Verifiability Contract

> Operating contract for every spoke under `prompts/tools/`. Applies to all
> CHECKPOINT blocks the operator confirms manually.

## Stop-on-question rule

**A prompt stops the operator only when there is an operator question to answer.** Every `## CHECKPOINT N` section MUST contain a `**STOP — operator question:** …` line followed by `Type \`confirmed\` to proceed.` Anything else (status banners, "ok proceed" markers, log-prints) is informational and does not halt execution. Status-only checkpoints are forbidden — convert them into a real yes/no question or delete them.

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
`00-preflight` (probed OpenClaw before `40-openclaw`), `13-caddy` (probed
Grafana / Prometheus / Loki / cAdvisor / NATS / Langfuse before any of
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
already present (e.g. preflight reading whether OpenClaw is installed),
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

Cross-service flows (Caddy → Grafana, Prometheus → cAdvisor target UP,
Fluent Bit → Loki query, Consumer → NATS → Sandbox dispatch) are
verified once in `prompts/tools/99-final-validation.md` after every
spoke has run. That is the only place where the full system is in
scope.

## Checklist for prompt authors

Before merging a new or edited spoke:

- [ ] Every `curl`, `nats`, `psql`, `redis-cli`, `docker compose ps`
      in the CHECKPOINT region targets only this spoke's surface.
- [ ] Any reference to a future spoke is informational and produces
      `NOT_INSTALLED` rather than failing.
- [ ] Any cross-service probe moved to `99-final-validation.md`.
- [ ] Operator prose names the later spoke that owns each deferred check.

## Reference

This contract is referenced from `SETUP.md` (Install Order section) and
governs every spoke under `prompts/tools/`. Violations are install
graph blockers and must be fixed before release.
