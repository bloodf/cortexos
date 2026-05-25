# AI Replication Contract

This is the canonical contract for reproducing a CortexOS machine from this
repository. Prompts and scripts may add detail, but they must not contradict
this file.

## Source of Truth

- Repository content: install prompts, scripts, systemd templates, dashboard
  migrations, dashboard seeds, schemas, and generic agent templates.
- Runtime-only content: `/opt/cortexos/.secrets`, Paperclip data, Honcho data,
  Hermes profile state, certificates, generated caches, logs, and project
  workspaces.
- Private project profiles are never committed. A new machine creates them
  locally with `scripts/hermes-profile-create.mjs`.

## Runtime Shape

All model calls route through 9Router. Paperclip is the only work surface.
Hermes executes profile work. Honcho stores memory and knowledge. Ollama is
only for Honcho embeddings.

```text
Paperclip -> Hermes profile -> 9Router -> model
                         |
                         -> Honcho memory
Honcho embeddings -> Ollama nomic-embed-text:latest
```

Required local endpoints:

| Service | Local endpoint | Notes |
| --- | --- | --- |
| 9Router | `http://127.0.0.1:11434/v1` | OpenAI-compatible model gateway |
| Honcho | `http://127.0.0.1:18690` | Memory and knowledge API |
| Hermes profile API | `http://127.0.0.1:18691+` | One port per profile |
| Paperclip proxy | `http://127.0.0.1:3033` | Public local compatibility port |
| Paperclip upstream | `http://127.0.0.1:3034` | Paperclip service port |
| Dashboard | `http://127.0.0.1:3080` | Native Next.js systemd service |
| Hermes Web UI | `http://127.0.0.1:9119` | Host-header proxy may expose `9120` locally |

## Clean Install Process

1. Run `prompts/00-bootstrap.md` from the operator machine.
2. Materialize the repository at `/opt/cortexos`.
3. Decrypt SOPS templates locally and push plaintext only to
   `/opt/cortexos/.secrets`.
4. Install the core stack in this order:
   system prerequisites, Docker, Tailscale, databases, observability, 9Router,
   Honcho, Hermes, Paperclip, dashboard, optional apps.
5. Create generic Hermes profiles with `scripts/hermes-profile-create.mjs`.
   The script writes the profile home, env file, wrapper, and registry row.
6. Run dashboard migrations. Seeded data must be generic and public-safe.
7. Run final validation and the repository gates.

## Dashboard Seeds

Dashboard seeds must only describe generic services. They may include local
loopback endpoints and `/opt/cortexos` runtime paths. They must not include
hostnames, tokens, project names, customer names, channel IDs, personal URLs,
or private profile names.

Public URLs are derived after install by `cortex_set_service_urls(base_url)`.
Never hardcode a machine-specific Tailscale domain in migrations.

## Prompt Rules

- Each prompt should state purpose, prerequisites, commands, verification, and
  next step.
- Commands should be idempotent or explicitly say when they are destructive.
- Use `/opt/cortexos` as the only install root.
- Use `127.0.0.1` for service-to-service examples.
- Never paste provider keys, bearer tokens, API keys, private domains, private
  project names, or local user data into prompts.
- Do not add alternate workflow buses, sidecars, or separate agent schedulers.

## Repository Gates

Run these before treating the repo as reproducible:

```bash
rtk pnpm check:repo-leaks
rtk pnpm audit:runtime-sync -- --strict
rtk pnpm --filter cortexos-scripts test
rtk pnpm --filter @cortexos/dashboard test
```

Runtime validation on the target machine:

```bash
systemctl --failed --no-pager
curl -fsS http://127.0.0.1:3033/api/health
curl -fsS http://127.0.0.1:18690/health
node scripts/cortex-runtime-sync-audit.mjs --strict
```
