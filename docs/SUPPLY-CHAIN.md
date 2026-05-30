# Supply Chain

During the rebuild, the supply-chain rule is simple:

- Build from repo-declared source.
- Prefer Ubuntu packages and pinned manifests where practical.
- Record accepted reproducibility risks in `PLAN.md`.
- Validate generated images and host services before removing old runtime
  copies.
