# Script Inventory

Status values:

- `keep`: public script surface retained as-is.
- `merge`: retained as an implementation detail behind a package script or
  readiness wrapper; do not add new direct prompt references.
- `archive`: recovery or historical script that should move out of top-level
  `scripts/` when its remaining references are retired.
- `delete`: inventory marker for a removed script during cleanup.

Owner categories are defined in
[`SCRIPT-PROMPT-POLICY.md`](SCRIPT-PROMPT-POLICY.md).

| Script | Status | Owner | References | Notes |
| --- | --- | --- | --- | --- |
| `scripts/9router-docker-proxy.mjs` | keep | runtime-entrypoint | `templates/systemd/9router-docker-proxy.service` | Host proxy for 9Router Docker access. |
| `scripts/audit-anchor-cron.sh` | keep | backup-update | `docs/SECURITY-CHECKLIST.md`, `packages/cortex-audit` | Scheduled audit anchoring entrypoint. |
| `scripts/bootstrap.sh` | keep | bootstrap-helper | `prompts/00-bootstrap.md`, `prompts/tools/12a-sops-bootstrap.md` | Remote bootstrap helper. |
| `scripts/check-prompt-chat-contract.mjs` | merge | validator | `package.json` | Prompt contract gate behind `pnpm check:prompt-chat-contract`. |
| `scripts/check-repo-leaks.mjs` | merge | validator | `package.json`, prompts | Public-safety leak gate behind `pnpm check:repo-leaks`. |
| `scripts/check-script-inventory.mjs` | merge | validator | `package.json`, CI, readiness | Fails when top-level scripts are not inventoried. |
| `scripts/cortex-auto-update.sh` | keep | backup-update | `templates/systemd/cortex-auto-update.service` | Runtime auto-update entrypoint. |
| `scripts/cortex-backup.sh` | keep | backup-update | `templates/systemd/cortex-backup.service`, docs | Runtime backup entrypoint. |
| `scripts/cortex-degraded-service-watcher.mjs` | keep | runtime-entrypoint | `templates/systemd/cortex-degraded-service-watcher.service` | Runtime service watcher. |
| `scripts/cortex-docker-name-audit.mjs` | merge | validator | `package.json`, readiness | Docker duplicate-name audit. |
| `scripts/cortex-env-writer.sh` | keep | runtime-entrypoint | `templates/systemd/cortex-dashboard-env-writer.service` | Dashboard env rendering entrypoint. |
| `scripts/cortex-full-pipeline-smoke.mjs` | merge | validator | `scripts/cortex-production-readiness.sh` | Optional full Paperclip/Hermes/Honcho smoke. |
| `scripts/cortex-production-readiness.sh` | keep | validator | README, docs, prompts | Canonical production doctor wrapper. |
| `scripts/cortex-runtime-sync-audit.mjs` | merge | validator | `package.json`, docs, readiness | Repo/runtime sync audit. |
| `scripts/cortex-update-check.sh` | keep | backup-update | `templates/systemd/cortex-update-check.service` | Runtime update check entrypoint. |
| `scripts/hermes-dashboard-host-proxy.mjs` | keep | runtime-entrypoint | `templates/systemd/hermes-dashboard-proxy.service` | Dashboard-to-Hermes host proxy. |
| `scripts/hermes-install-skills.mjs` | keep | renderer-installer | `package.json` | Idempotent Hermes skill installer. |
| `scripts/hermes-paperclip-wrapper.sh` | keep | runtime-entrypoint | `prompts/tools/43-paperclip-hermes.md` | Paperclip-facing Hermes wrapper. |
| `scripts/hermes-profile-api.mjs` | keep | runtime-entrypoint | `templates/systemd/hermes-profile@.service` | Hermes profile API service. |
| `scripts/hermes-profile-create.mjs` | keep | renderer-installer | prompts, docs | Idempotent Hermes profile renderer. |
| `scripts/honcho-ingest-files.mjs` | keep | renderer-installer | operator memory import | Deterministic Honcho file ingest helper. |
| `scripts/honcho-memory-import.mjs` | keep | migration | `prompts/tools/49-memory-import-prep.md` | Legacy profile memory import. |
| `scripts/migrate-omc-to-paperclip.ts` | archive | migration | `scripts/package.json`, tests | Historical OMC backfill; move to recovery after package/test references are retired. |
| `scripts/os-detect.sh` | keep | bootstrap-helper | prompts, distro CI | Supported OS detection. |
| `scripts/paperclip-ensure-readiness-auth.mjs` | keep | renderer-installer | `prompts/tools/62-paperclip.md`, `package.json` | Idempotent Paperclip readiness auth repair. |
| `scripts/paperclip-hermes-smoke.mjs` | merge | validator | prompts, readiness | Paperclip/Hermes smoke used by readiness. |
| `scripts/paperclip-local-proxy.mjs` | keep | runtime-entrypoint | `templates/systemd/paperclip-local-proxy.service` | Local Paperclip proxy service. |
| `scripts/paperclip-reconcile-bootstrap-issues.mjs` | archive | migration | `recovery/` | One-off bootstrap issue repair moved out of the public script surface. |
| `scripts/paperclip-register-roles.ts` | keep | renderer-installer | `prompts/tools/43-paperclip-hermes.md`, tests | Paperclip role registration. |
| `scripts/pkg.sh` | keep | bootstrap-helper | prompts, templates | Canonical package-manager abstraction. |
| `scripts/preflight-tools.sh` | keep | bootstrap-helper | `prompts/00-bootstrap.md` | Preflight tool bootstrap. |
| `scripts/schema-version-check.js` | keep | validator | `.github/workflows/schema-check.yml` | Published schema version policy gate. |
| `scripts/secrets-decrypt.sh` | keep | bootstrap-helper | prompts, docs, dashboard provisioner | Runtime secret materialization helper. |
| `scripts/secrets-rotate.sh` | keep | backup-update | operator secret rotation | SOPS secret rotation helper. |
| `scripts/sync-hermes-9router-profiles.mjs` | merge | validator | `scripts/cortex-production-readiness.sh` | Canonical Hermes profile model sync and audit. |
| `scripts/verify-artifact.sh` | keep | validator | release docs, orchestration installer | Supply-chain artifact verification. |
