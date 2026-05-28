# 81 - Projects

First project instances:

- `mementry`
- `celebrar.me`
- `3guns`

Each project gets an unprivileged Incus instance from the versioned base image,
its own Tailscale SSH identity, and per-project service credentials.

Dirty host project state is not migrated. Clone clean `main` inside each
instance and validate before host project copies are archived and removed.
