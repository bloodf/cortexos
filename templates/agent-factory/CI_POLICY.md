# CI Policy

First work: keep lightweight CI green.

Required checks:

- Unit tests.
- Lint.
- Typecheck or equivalent static checks, when configured.
- Frontend/web build, when a frontend/web target exists.
- Other lightweight verification that does not require external hardware, paid cloud resources, or native app builds.

Do not run e2e, firmware, hardware-in-loop, iOS, Android, archive, or native release builds unless the owner explicitly asks.
