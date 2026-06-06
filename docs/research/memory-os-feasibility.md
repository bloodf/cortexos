# Memory OS Feasibility — CortexOS Integration

> Companion to: `docs/research/{hermes-webui,boxbox}-feasibility.md` (same rubric, same verdict shape).
> Research date: 2026-06-05.
> Memory OS upstream: https://github.com/ClaudioDrews/memory-os (MIT, v0.2.0).

## TL;DR

**RECOMMENDATION: SWAP IN — layer on top of Honcho.**

Memory OS adds a 7-layer cross-session memory operating system (workspace files + sessions + structured facts + Icarus fabric plugin + Qdrant vector db + LLM wiki + ground-truth hierarchy) on top of the existing CortexOS Honcho backend. Honcho stays as the runtime peer-model (port 18690, `cx/gpt-5.5` deriver), Memory OS adds the long-term knowledge layer. The two are complementary, not redundant. Install footprint: Qdrant + Redis + ARQ worker + Icarus plugin — fits inside the M2 wave 2 Docker stack. 9router is wired via the upstream's `ICARUS_ENDPOINT` env var (provider-agnostic).

## 1. Upstream health

Source: GitHub API `https://api.github.com/repos/ClaudioDrews/memory-os` (fetched 2026-06-05).

| Metric | Value |
| --- | --- |
| Stars | 881 |
| Forks | 87 |
| Open issues | 3 |
| Open PRs | 1 |
| License | MIT |
| Latest release | v0.2.0 (2026-06-04, one-command installer) |
| Initial release | v0.1.0 |
| Commits on main | 33 |
| Repo age | ~5 days (created late May 2026) |
| Default branch | main |
| Topics | docker, open-source, self-hosted, persistent-memory, ground-truth, rag, context-injection, local-first, vector-database, qdrant, ai-memory, hermes-agent |

**Health verdict:** **YOUNG BUT HEALTHY.** MIT license, real release cadence (v0.2.0 dropped one day after v0.1.0), active issue tracker, single-tenant Docker install. The 5-day-old repo is the only risk flag — but the upstream is being driven by someone who runs Hermes daily and shipped 20+ fixes from a systematic audit in v0.2.0, which signals engineering maturity. Watch for archived/disabled flag and 30+ day commit gaps before committing in production.

## 2. Layer-by-layer architecture

### Layer 1 — Workspace (files injected every turn)
- `MEMORY.md`, `USER.md`, `CREATIVE.md` in `${HERMES_HOME}` (default `~/.hermes`).
- These are flat files that Hermes Agent injects into the system prompt every turn.
- **CortexOS fit:** The per-profile `config.yaml` at `/opt/cortexos/hermes/profiles/<name>/` is the natural home. `HERMES_HOME` for each profile = `/opt/cortexos/hermes/profiles/<name>/`. Workspace files become `/opt/cortexos/hermes/profiles/<name>/MEMORY.md` etc. (No new prompt; the Hermes Agent binary already reads these.)

### Layer 2 — Sessions (SQLite + FTS5)
- `state.db` with FTS5 full-text search over all session transcripts.
- Path: `${STATE_DB_PATH}` (default `~/.hermes/state.db`).
- **CortexOS fit:** Per-profile. `STATE_DB_PATH=/opt/cortexos/data/memory-os/<profile>/state.db`. Honest in our model — each profile gets its own session history.

### Layer 3 — Structured facts (SQLite + HRR + FTS5 + trust scoring)
- `memory_store.db` — durable facts with entity resolution and a trust-score feedback loop.
- **CortexOS fit:** Per-profile. Same path pattern as Layer 2.

### Layer 4 — Fabric / Icarus plugin
- Heavily forked from `esaradev/icarus-plugin` (NOT upstream-compatible).
- 16 tools (`fabric_recall`, `fabric_write`, `fabric_brief`, `fabric_curate`, `fabric_train`, etc.).
- 4 hooks: `on_session_start`, `pre_llm_call`, `post_llm_call`, `on_session_end`.
- Install path: `${HERMES_HOME}/plugins/icarus` (per the upstream `setup.sh`).
- **CortexOS fit:** Per-profile. Installed via `cp -r icarus/ ${ICARUS_DEST}` from the upstream setup.sh. The plugin reads `MEMORY.md` / `USER.md` and injects context via the `pre_llm_call` hook. **Note:** the plugin assumes Hermes Agent's plugin discovery mechanism, which the upstream NousResearch Hermes Agent has. We need to confirm CortexOS's Hermes binary (assumed at `/usr/local/bin/hermes` from `60-incus-project.md:132`) loads plugins from `${HERMES_HOME}/plugins/` — that's a future prompt work item.

### Layer 5 — Vector database (Qdrant)
- Qdrant 1.17+, port 6333, collection `knowledge_base`, 4096d Cosine + BM25 sparse.
- 4-level fallback cascade: hybrid → dense → lexical (markdown file search in vault) → SQLite (lineage table) → fail-open empty.
- Weekly decay scanner + semantic dedup (cosine > 0.92 → merge).
- **CortexOS fit:** Single host-wide Qdrant. The upstream `setup.sh` runs `docker compose pull redis qdrant` — installs its own Qdrant container. We do NOT need to share with M2 wave 2's Prometheus / Grafana stack (those are observability, this is application data). New container: `cortexos-memory-os-qdrant`, port 6333, data at `/opt/cortexos/data/memory-os/qdrant`.

### Layer 6 — LLM wiki
- Auto-curated vault: `concepts/`, `entities/`, `comparisons/`.
- Frontmatter enrichment via Vault Curator v3 (`ClaudioDrews/vault-curator`, separate repo).
- Continuously ingested into Qdrant via `wiki-continuous-ingest` (hourly).
- **CortexOS fit:** Per-profile. Wiki at `/opt/cortexos/memory-os/<profile>/wiki/`. The curator calls an LLM for frontmatter enrichment — route through 9router via `ICARUS_ENDPOINT` (see §3).

### Layer 7 — Ground truth hierarchy (NON-NEGOTIABLE)
- `SOUL.md` + `rulebook.md` — these are the agent's identity documents.
- Without them, the agent treats injected memory as suggestions and re-queries the source.
- The upstream ships `setup/rulebook.md` and `modifications/soul-rulebook.md` as templates.
- **CortexOS fit:** Per-profile. The Hermes Agent binary already reads `SOUL.md` from `HERMES_HOME` (assuming it follows the upstream convention). The install prompt copies the upstream templates into `/opt/cortexos/hermes/profiles/<name>/SOUL.md` and `rulebook.md` and customizes them with a "Layer 7 says: injected memory is authoritative" preamble.

## 3. LLM provider chain

Memory OS's extraction pipeline is **provider-agnostic**. Priority order (from `.env.example:72`):

1. `ICARUS_ENDPOINT` + `ICARUS_API_KEY_ENV` — fully custom endpoint
2. `DEEPSEEK_API_KEY` — direct to api.deepseek.com
3. `OPENROUTER_API_KEY` — OpenRouter
4. The setup script also accepts `OPENROUTER_DS_API_KEY` from `~/.hermes/.env`.

**CortexOS 9router wiring (RECOMMENDED):**

```bash
# 9router is OpenAI-compatible, NOT OpenRouter. Use the ICARUS_ENDPOINT override.
ICARUS_ENDPOINT=http://172.17.0.1:11434/v1/chat/completions  # from inside the container
ICARUS_API_KEY_ENV=NINEROUTER_API_KEY
ICARUS_EXTRACTION_MODEL=cx/gpt-5.5                          # match 32-honcho.md
ICARUS_EXTRACTION_MAX_TOKENS=4096
```

For the embedding model, the upstream supports two backends:
- **Ollama** (local, zero cost) — `OLLAMA_BASE_URL=http://localhost:11434` + `OLLAMA_EMBEDDING_MODEL=nomic-embed-text`. **This matches our existing CortexOS setup** (32-honcho.md line 13: "Vulkan Ollama active on `127.0.0.1:11435` with `nomic-embed-text:latest` installed"). Use this — no new model, no new key.
- **OpenRouter Qwen3-Embedding-8B** (cloud, $0.025/1M tokens) — for higher quality multilingual embeddings. Not recommended for default; the Ollama backend is good enough for CortexOS.

`EMBEDDING_DIMS=4096` must match Qdrant collection schema.

## 4. Footprint

| Component | Image / size | RAM | Disk | Port |
| --- | --- | --- | --- | --- |
| Qdrant | `qdrant/qdrant:latest` (~200MB) | 512MB-2GB | 10GB+ (wiki + sessions grow) | 6333 |
| Redis (memory-arq) | `redis:7-alpine` (~20MB) | 100-500MB | <1GB | 6379 |
| ARQ worker | custom (Python 3.11+, ~500MB image) | 200-500MB | <1GB | 8080 (REST for health) |
| Icarus plugin | 4119 lines Python (no image) | n/a (runs in Hermes process) | <100MB | n/a |
| state.db (SQLite) | n/a | n/a | 100MB+ (session transcripts) | n/a |
| memory_store.db (SQLite) | n/a | n/a | 10MB+ (facts) | n/a |
| wiki/ | n/a | n/a | 1GB+ (markdown + ingestion) | n/a |

**Total estimated:** ~1GB RAM steady-state, ~12GB disk (Qdrant dominates). Fits inside M2 wave 2's Docker stack. No conflicts with Prometheus (9090), Grafana (3000), Postgres (5432), Loki (3100), etc.

## 5. Fallback if upstream dies

If `ClaudioDrews/memory-os` goes archived / unmaintained:

1. **Honcho** (already installed, 32-honcho.md) — can be extended with a custom LLM wiki script (frontmatter enrichment is a ~200-line Python job). Switch cost: 1-2 days.
2. **Letta** (`letta-ai/letta`) — heavyweight, requires its own server, but local-first. Switch cost: 3-5 days.
3. **Custom Icarus fork** — the Icarus plugin is already a heavily-forked version of `esaradev/icarus-plugin`; we could maintain our own fork and skip the wiki/Qdrant layers. Switch cost: 0 days (just stop installing memory-os, keep Honcho).

The 5-day-old repo is the only risk. Mitigation: pin the install to a specific tag (`v0.2.0`) and a commit SHA, not `main`. Document the `archive`/commit-gap triggers in the install prompt.

## 6. Security analysis

**Trust boundary:** the operator (root) writes `MEMORY.md` / `USER.md` / `SOUL.md` / `rulebook.md` directly. The Icarus plugin reads these and injects them into the system prompt via `pre_llm_call`. The wiki (Layer 6) is also auto-curated by an LLM (the curator), so a compromised layer 6 could inject content into the system prompt.

**CortexOS mitigations:**

- **SR-019 bash-c ban** (already enforced at the PTY bridge level in `packages/dashboard/src/lib/server/terminal/pty-bridge.ts`) blocks `bash -c <userstring>`. Even if the agent's system prompt contains injected shell commands, the operator-facing terminal will refuse to execute them.
- **PB-3 env-browser allowlist** (also at the PTY bridge) blocks reads to `/etc/passwd`, `/etc/shadow`, `.secrets/`, etc. The agent's tool calls are gated.
- **`_sanitize_context_text` + `_strip_prompt_injection`** (the upstream's defensive regex, in `setup.sh` / Icarus) catches known prompt-injection patterns before they reach the system prompt. Not bulletproof but defense-in-depth.
- **Hermes Agent runs as `hermes` user** per the upstream `.env.example` (HERMES_HOME=/home/your-user/.hermes, User=hermes in systemd). The upstream is opinionated about non-root execution; mirror that in the install prompt (`User=hermes`, not `User=root`).
- **Wiki write-back should be operator-confirmed** for new entries. The upstream auto-curates, but a CortexOS prompt can wrap the curator with a "preview + confirm" gate via the approvals system (PB-5 already in place per M2 wave 2).

**Residual risk:** the agent's context window is influenced by an LLM-curated wiki. A malicious wiki entry can influence tool selection, but cannot directly execute shell commands. The CortexOS PTY-bridge + SR-019 stack is the final guardrail.

## 7. Architecture decision: layer on top of Honcho

Honcho is the **runtime** memory (dialectic summaries, peer-model, per-session). Memory OS is the **long-term** memory (cross-session, wiki, facts, ground truth). They are complementary:

| Layer | Honcho | Memory OS |
| --- | --- | --- |
| Scope | Per-session peer-model | Cross-session, persistent |
| Storage | Postgres (M2 wave 2) | SQLite + Qdrant |
| Latency | Live (dialectic on every turn) | Async (extraction on session end) |
| LLM calls | Heavy (5 dialectic levels) | Moderate (extraction + wiki curation) |
| Surface | Honcho API (port 18690) | Icarus plugin + wiki |
| Operator UI | (none — REST only) | Wiki + memory browser |

Both can coexist: Honcho captures the conversational memory, Memory OS builds the long-term knowledge. The Hermes Agent's `pre_llm_call` hook in Icarus can call Honcho's API for runtime context AND inject Layer 5 (Qdrant) + Layer 4 (Fabric) results in the same prompt.

**Configuration:** per-profile `config.yaml` (`60-incus-project.md:82-88`) adds a `memory:` section that lists BOTH backends:

```yaml
memory:
  runtime:
    provider: honcho
    baseUrl: http://127.0.0.1:18690
  longterm:
    provider: memory-os
    home: /opt/cortexos/hermes/profiles/<name>/
    icarus: /opt/cortexos/hermes/profiles/<name>/plugins/icarus
    stateDb: /opt/cortexos/data/memory-os/<name>/state.db
    wiki: /opt/cortexos/memory-os/<name>/wiki/
```

## 8. RECOMMENDATION: SWAP IN

**Verdict:** SWAP IN. Layer on top of Honcho.

**Justification (evidence, not vibes):**

1. MIT license, real release cadence, active upstream.
2. Provider-agnostic — wires cleanly to existing 9router + Ollama stack.
3. 7 layers map 1:1 to CortexOS per-profile model.
4. Footprint fits inside M2 wave 2 Docker stack (no new infrastructure class).
5. CortexOS already has the guardrails (SR-019, PB-3, PB-5) to mitigate the trust-boundary risk.
6. Honcho + Memory OS are complementary, not redundant.

**Conditions (must hold before installing in production):**

- C-1: pin to tag `v0.2.0` + commit SHA (not `main`). Document the SHA in the install prompt.
- C-2: confirm CortexOS's Hermes binary at `/usr/local/bin/hermes` loads plugins from `${HERMES_HOME}/plugins/icarus/`. If not, this is a 1-day follow-up to add plugin discovery.
- C-3: run the upstream's smoke tests + ingestion tests after install (the README says they ship with the repo).
- C-4: layer 7 templates (SOUL.md, rulebook.md) must be customized per-profile — the upstream templates are generic and need CortexOS-specific ground truth language.
- C-5: the wiki write-back must be wrapped in a CortexOS approvals gate (PB-5).
- C-6: per-profile opt-in only (default: no). The 7-layer stack has a footprint the operator may not want per-profile.

**MONITOR triggers (escalate if any of these fire):**

- Upstream repo archived or `pushed_at` > 30 days ago.
- Release cadence drops below 1 release / 60 days.
- Critical security CVE in any of Qdrant / Redis / arq / icarus without a patch in 14 days.

## 9. Follow-up work items (not blocking install)

- F-1: write `prompts/tools/33-hermes-memory-os.md` install prompt (the next task in plan_0450a939).
- F-2: write `templates/systemd/cortex-memory-os.service` (W61-pattern force-track).
- F-3: update `60-incus-project.md` step 6.7 for per-profile wiring.
- F-4: write `migrations/010_memory_os_seed.sql` + `/apps` tile + i18n (the dashboard-integration task in plan_0450a939).
- F-5: add C-1/C-2/C-3/C-4/C-5/C-6 conditions as install-prompt checkpoints.
- F-6: file an upstream issue if the README's "any LLM provider" claim is too strong (e.g. 9router is OpenAI-compatible but not OpenRouter; the default `OPENROUTER_API_KEY` flow is wrong for us).

---

**Confidence:** HIGH on architecture + footprint. MEDIUM on integration risk (C-2 unknown). The 5-day-old repo age is the dominant risk; all other risk factors are well-understood and have CortexOS-side mitigations.
