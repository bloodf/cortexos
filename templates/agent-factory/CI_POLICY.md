# CI Policy

First work: keep lightweight CI green.

Required checks:

- Unit tests.
- Lint.
- Typecheck or equivalent static checks, when configured.
- Frontend/web build, when a frontend/web target exists.
- Other lightweight verification that does not require external hardware, paid cloud resources, or unsupported native app builds.

Mobile and hardware limits:

- React Native E2E on this Linux/headless host is Android-only. Do not run iOS simulator, Xcode, iOS archive, or iOS E2E flows unless the owner explicitly provides a macOS/iOS runner and asks for it.
- The first application-layer validation target for 3Guns, Celebrar.me, and Mementry mobile work is Android.
- Do not run physical 3Guns hardware, serial/USB flashing, HIL, relay/pyro, or device-attached checks unless the owner explicitly asks and provides the hardware context.

Do not run broad e2e, physical hardware, iOS, archive, or native release builds unless the owner explicitly asks.
