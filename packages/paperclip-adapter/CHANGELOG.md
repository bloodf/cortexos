# Changelog

All notable changes to `@cortexos/paperclip-adapter`.

## 0.1.0 — 2026-05-18

### Added

- Initial public release.
- `HttpAdapter.register(role, webhookUrl, secret, events?)` returning frozen Paperclip webhook config payload.
- `ExternalAdapter` with stateless `poll`, `checkout`, `complete` primitives over Paperclip's HTTP API.
- `parseTranscript(artifact)` converting OMC artifact JSON to Paperclip rich-comment blocks.
- TypeScript declarations and ESM-only distribution.
