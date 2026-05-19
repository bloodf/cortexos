# Tools & Environment

## VPS Platform

- **OS**: Ubuntu 24.04 LTS, Ubuntu 25.x, or Debian 13 (Trixie). OS-family routing handled by `scripts/os-detect.sh` + `scripts/pkg.sh`.
- **Container Runtime**: Docker/Docker Compose policy is split by surface:
  - For **application projects**: Docker/Docker Compose is allowed only in CI/CD scripts and ephemeral validation jobs. Dev, staging, and production infrastructure is provisioned with Terraform through Floci, not Compose.
  - For the **cortex agent and CortexOS itself**: Docker Compose is the **primary deployment mechanism** for VPS-resident services under `$CORTEX_ROOT/stacks/`. The cortex agent maintains, deploys, and operates these stacks directly. Floci/Terraform is reserved for app projects, not for the CortexOS substrate.
- **Networking**: Tailscale VPN for inter-service and remote access
- **Process Manager**: systemd for host services. Application infrastructure goes through Terraform/Floci; CortexOS infrastructure goes through Docker Compose under `$CORTEX_ROOT/stacks/`.
- **Services Root**: `$CORTEX_ROOT/stacks/` — canonical for CortexOS substrate (managed by cortex agent). Application projects must not add stacks here.

## AI Gateway — 9Router

**All model calls go through 9Router. Never call provider APIs directly.**

Endpoints mirrored from `.shared/endpoints.md` (canonical).

```text
Endpoint:        http://127.0.0.1:11434/v1/chat/completions
Models list:     http://127.0.0.1:11434/v1/models
Health check:    http://127.0.0.1:11434/health
```

- Routes to multiple providers (OpenAI, Anthropic, Google, etc.)
- Handles rate limiting, cost tracking, fallback
- Use model names prefixed with `9router/` (e.g., `9router/cx/gpt-5.5`)
- If 9Router is unreachable, STOP and report. No direct fallback.

## Deployment Rule — Terraform + Floci Only

Agents must not deploy dev, staging, or production by creating Dockerfiles, Docker Compose stacks, ad-hoc containers, `act` runner containers, Coolify apps, or manual cloud resources.

Required dev/staging/prod deployment path:

1. Write or update Terraform.
2. Target Floci, the local AWS-compatible emulator, for validation.
3. Run `terraform fmt`, `terraform validate`, and a Floci-backed plan/apply in the approved workspace.
4. Promote the same Terraform module to the real target only after review and approval.

Docker/Docker Compose policy:

- Docker and Docker Compose are allowed only inside CI/CD code and validation scripts.
- CI/CD containers must be ephemeral and must be removed even when tests, builds, or CI jobs fail.
- Every script that starts containers must define cleanup with `trap cleanup EXIT`.
- Docker Compose CI scripts must run `docker compose down -v --remove-orphans` in cleanup.
- Plain Docker CI scripts must remove named containers with `docker rm -f` in cleanup.
- `act` may be used only as an explicit CI/CD validation tool, never as deployment; remove all `act-*` containers after the run.

Allowed container operations:

- Author or run Docker/Docker Compose only for CI/CD validation.
- Inspect or stop temporary CI simulation containers.
- Maintain existing legacy service containers until a migration plan replaces them.

Forbidden container operations:

- `docker run` for dev/staging/prod deployment
- new `docker compose` dev/staging/prod deployment stacks
- container-based production deploys when Terraform + Floci can model the resource
- leaving CI/CD containers, networks, or volumes behind after failure

## AWS Emulator — Floci

Local AWS-compatible services for Terraform validation, development, and testing:

```text
Endpoint:  http://127.0.0.1:4566
Profile:   floci (use `--profile floci` or `AWS_PROFILE=floci`)
Region:    us-east-1
```

Available services:

- **S3** — object storage
- **Lambda** — serverless functions
- **DynamoDB** — NoSQL database
- **SQS** — message queues
- **SNS** — notifications
- **IAM** — identity and access management
- **CloudFormation** — infrastructure as code

Example: `aws --profile floci --endpoint-url http://127.0.0.1:4566 s3 ls`

Terraform example:

```bash
export AWS_PROFILE=floci
export AWS_REGION=us-east-1
terraform fmt -recursive
terraform validate
terraform plan -var-file=env/floci.tfvars
```

## Databases

| Database   | Host      | Port  | Notes                  |
| ---------- | --------- | ----- | ---------------------- |
| PostgreSQL | 127.0.0.1 | 5432  | Primary relational DB  |
| MySQL      | 127.0.0.1 | 3306  | Legacy app support, retained — new code MUST use PostgreSQL |
| MongoDB    | 127.0.0.1 | 27017 | Document store         |
| Redis      | 127.0.0.1 | 6379  | Cache, queues, pub/sub |

Credentials for all databases are in `.secrets/cortex-credentials.md`. Never hardcode them.

## Development Tools

| Tool              | Version | Purpose                                                                |
| ----------------- | ------- | ---------------------------------------------------------------------- |
| Node.js           | 24+     | JavaScript runtime                                                     |
| Bun               | latest  | Fast JS runtime, bundler, test runner                                  |
| GitHub CLI (`gh`) | latest  | Issues, PRs, actions, releases                                         |
| AWS CLI           | v2      | Floci interaction                                                      |
| Docker            | latest  | CI/CD validation scripts only; cleanup required on success and failure |
| Docker Compose    | v2      | CI/CD validation scripts only; never dev/staging/prod deployment       |
| Terraform         | latest  | Required dev/staging/prod deployment and infrastructure workflow       |
| Git               | latest  | Version control                                                        |
| jq                | latest  | JSON processing                                                        |
| curl              | latest  | HTTP requests                                                          |

## Knowledge & Memory Services

### OpenViking — Knowledge Base

```text
Endpoint: http://127.0.0.1:{openviking_port}
```

Semantic search over indexed documents, code, and workspace knowledge.

### Hindsight — Agent Memory

```text
Endpoint: http://127.0.0.1:{hindsight_port}
```

Structured agent memory storage and retrieval. Complements file-based MEMORY.md with searchable indexed memory.

## MCP Servers

### Filesystem

Standard filesystem MCP server for file operations. Available by default in all agent sessions.

## Skills System

Skills live in the workspace `skills/` directory. Each skill has a `SKILL.md` defining its capabilities, triggers, and usage.

### Invoking Skills

- Use `@skill-name` syntax in conversation
- Skills provide tools that appear in your tool list when activated
- Check `SKILL.md` before first use — it documents parameters and expected behavior

### Key Skills

| Skill                | Purpose                                                             |
| -------------------- | ------------------------------------------------------------------- |
| `gstack` (inlined)   | Quality gates: CEO review, eng review, code review, QA, ship, retro — see `GSTACK.md` |
| `self-improving`     | Self-reflection + self-criticism + self-learning + organizing memory (ivangdavila) |
| `self-improving-agent` | Capture learnings on command failure or user correction (pskoett) |
| `humanizer`          | Strip AI-writing tells from text (biostartechnology)               |
| `github`             | `gh` CLI workflows: issue, pr, run, api (steipete)                 |
| `lobster`            | Typed workflow pipelines + resumable approvals (@openclaw)         |
| `writing-plans`      | Structured plan creation from specs/requirements                   |
| `executing-plans`    | Batch execution with checkpoints and verification                  |
| `gh-issues`          | GitHub issue management and triage                                 |
| `mem`                | Memory operations (read, write, search, curate)                    |
| `caveman`            | Terse communication mode                                           |
| `9router`            | Model routing config, usage stats                                  |
| `clawteam`           | Multi-agent coordination and handoffs                              |
| `smart-memory`       | Intelligent memory search across daily files and MEMORY.md         |
| `model-usage`        | Track model cost, token usage, per-agent breakdown                 |

### Mandatory Clawhub Skills

All agents must have these 5 skills installed (via `openclaw skills install <slug> --agent <id>`):

1. `self-improving` (ivangdavila)
2. `humanizer` (biostartechnology)
3. `self-improving-agent` (pskoett)
4. `github` (steipete)
5. `lobster` (@openclaw, installed as code-plugin globally)

### Gstack Workflow Doctrine

Every persona inlines gstack workflows from `agent-factory/GSTACK.md`. Skills are
not invoked via slash commands (gstack runs only in Claude Code on a workstation)
— instead, agents follow the **principles + checklists** in GSTACK.md as written
instructions. Core rule: **Boil the Lake** — recommend complete (10/10) options
over shortcuts unless the work is an unboilable ocean.

Per-role skill assignments live in each persona's `## Gstack Workflows` section
(see `templates/agent-roles/*.md`).

## Git Conventions

- Branch naming: `{stage}/{issue-number}-{short-description}`
- Commit format: `{type}({scope}): {description}`
- Types: feat, fix, refactor, docs, test, chore, style, perf, ci, build, revert
- Never force push. Never rewrite shared history.
- One logical change per commit.
