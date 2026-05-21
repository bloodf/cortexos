# Contributing to CortexOS

> Practical contribution guide for docs, prompts, dashboard code, templates, and operational runbooks.

## Contents

- [Principles](#principles)
- [Development setup](#development-setup)
- [Workflow](#workflow)
- [Commit style](#commit-style)
- [Pull request checklist](#pull-request-checklist)
- [Documentation standards](#documentation-standards)
- [Security rules](#security-rules)

## Principles

- Preserve operator control and checkpoint safety.
- Prefer explicit files, deterministic scripts, and auditable changes.
- Keep secrets, tokens, private hosts, and real credentials out of git.
- Update docs, tests, prompts, and templates together when behavior changes.
- Avoid hidden automation. Operators should understand what will happen before it happens.

## Development setup

```bash
git clone https://github.com/bloodf/cortexos.git
cd cortexos
cd dashboard
npm install
npm run test
npm run build
```

Dashboard local development:

```bash
cd dashboard
cp .env.example .env.local  # when available
npx next dev --turbopack
```

## Workflow

1. Create branch from main:

   ```bash
   git checkout -b feat/<short-name>
   ```

2. Make focused change.
3. Run relevant tests and checks.
4. Update docs and prompt modules.
5. Open pull request with screenshots or logs when UI/operations change.

## Commit style

Use concise conventional prefix:

```text
feat(dashboard): add service health timeline
fix(paperclip): validate approval signature
docs(security): document credential rotation window
refactor(prompts): split monitoring setup steps
test(secrets): cover allowlist traversal rejection
```

## Pull request checklist

- [ ] Change has clear scope and rationale.
- [ ] Dashboard tests pass when dashboard code changes.
- [ ] Prompt changes keep checkpoint semantics intact.
- [ ] New paths use `/opt/cortexos` and `CORTEX_ROOT` consistently.
- [ ] Documentation index links new or changed docs.
- [ ] No secrets, private IPs, passwords, tokens, or customer data committed.
- [ ] Security-sensitive behavior includes audit notes.

## Documentation standards

Docs should include overview, concepts, procedures, verification, troubleshooting, and related links. Prefer tables for policies and fenced code blocks for commands. Use Mermaid only when GitHub can render it clearly.

## Security rules

Report vulnerabilities through [SECURITY.md](SECURITY.md). Do not open public issues for exploitable bugs.
