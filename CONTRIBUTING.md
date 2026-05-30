# Contributing

Use `PLAN.md` as the current product and operations contract.

Before changes:

```bash
scripts/rebuild/validate.sh --local
```

For commits, keep the repository's Lore commit protocol from `AGENTS.md`.
Do not add new runtime systems unless their placement, secrets, backup scope,
validation gate, and dashboard catalog entry are declared in
`manifests/rebuild/`.
