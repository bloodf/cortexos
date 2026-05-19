<claude-mem-context>
# Memory Context

# [cortexos] recent context, 2026-05-18 11:22pm GMT-3

Legend: 🎯session 🔴bugfix 🟣feature 🔄refactor ✅change 🔵discovery ⚖️decision 🚨security_alert 🔐security_note
Format: ID TIME TYPE TITLE
Fetch details: get_observations([IDs]) | Search: mem-search skill

Stats: 50 obs (18,620t read) | 222,202t work | 92% savings

### May 18, 2026
S3049 Fix cortexos CI dashboard job — rolldown linux native binding missing due to npm install running in workspace subdirectory instead of monorepo root (May 18 at 10:00 PM)
S3051 Fix cortexos CI dashboard build failure — two-commit fix: workspace root install for rolldown binding + lazy DB pool init for build-time safety (May 18 at 10:01 PM)
S3057 Fix CI Dashboard image build failure and expand paperclip-integration-and-fedora-support plan to include Out of Scope items and local Fedora testing (May 18 at 10:05 PM)
S3059 Expand paperclip-integration-and-fedora-support plan to include Out of Scope items and local Fedora testing; plus CI fix and setup simplification work done along the way (May 18 at 10:22 PM)
S3060 Expand paperclip-integration-and-fedora-support plan to include Out of Scope items and local Fedora testing; CI fix and setup simplification completed as prerequisite work (May 18 at 10:24 PM)
S3062 Expand paperclip-integration-and-fedora-support plan to include Out of Scope items and local Fedora testing; substantial setup/CI cleanup done as prerequisite work (May 18 at 10:25 PM)
S3067 Commit pending spoke cleanup, strip remaining Opik references, then write the comprehensive paperclip-integration-and-fedora-support plan (May 18 at 10:27 PM)
S3068 Tailscale URL routing: subdomain vs path-based — confirmed path-only approach and planned app config matrix (May 18 at 10:39 PM)
S3070 Wire path-based reverse proxy for all CortexOS web UIs on Tailscale single MagicDNS FQDN — completed and pushed to main (May 18 at 10:45 PM)
9162 10:52p 🔵 Sub-Agent Spawned to Complete Same Task Already Committed by Primary Session
9164 10:58p 🟣 Dashboard Seed Enhancement: WebUI Tools + Dynamic Pre-Migration
9165 10:59p 🔵 CortexOS Monorepo Root Structure Mapped
9166 11:00p 🔵 Full Tool Inventory Found in prompts/tools — Includes openclaw, paperclip, and Many Others
9167 " 🔵 Dashboard Migration Chain: 9 Migrations Including paperclip, LangGraph, Audit Log, Pending Approvals
9168 11:01p 🔵 002_seed.sql Gaps: paperclip, langfuse, cortex-graph, cortex-sandbox, cortex-consumer Missing
9169 " 🔵 004_tailscale_urls.sql cortex_set_service_urls Function Missing Several WebUI Tools
9170 " 🔵 All Tool Port Numbers Mapped — Seed Has Port Discrepancies vs Prompt Definitions
9171 " 🔵 .setup-state.json completed_spokes is the Key Signal for Dynamic Pre-Migration Seeding
9172 11:02p 🔵 docker-entrypoint.sh Migration Hook Point: Pre-Migration Step Can Be Injected Before migrate.js
9173 " 🔵 paperclip Bridge is a systemd Process (not Docker) on Port 8089 — Needs 'process' kind in Seed
9174 " 🔵 dashboard/Caddyfile.snippet is Stale — Contains Wrong Ports, Retired Services, Missing Tools
9175 " 🟣 Migration 010: langfuse and nats-monitor Added as Inactive Catalog Entries
9176 11:03p 🟣 Migration 011: cortex_set_service_urls Rewritten to Cover All Caddy-Routed WebUI Tools
9177 " 🟣 dashboard/scripts/dynamic-seed.js Implemented — Spoke-Aware Service Activation
9178 " 🟣 docker-entrypoint.sh Wired: dynamic-seed.js Now Runs Between Migrations and Server Start
9179 " 🟣 Caddy Config Updated: /nats/* Route Added to prompts/tools/13-caddy.md
9180 11:04p 🟣 Dashboard Dynamic Seed Feature Complete — All Verifications Passed
9181 " 🟣 Full Test Suite Passes After Dynamic Seed Changes — 601/601 Tests Green
9182 " 🔵 Production Build Succeeds with Two Pre-Existing Turbopack Warnings
9183 " ✅ 7 Files Staged for Commit — Dynamic Seed Feature Ready to Ship
9184 11:05p ✅ Commit 61059ac Pushed to main — Dynamic Seed + NATS/Langfuse Catalog Work Shipped
9185 " ⚖️ Canonical UI-less Tool List Confirmed — These Services Have No Web UI in CortexOS
9186 " ✅ Operator Follow-ups Required After Dynamic Seed Deployment
S3072 Dashboard seed audit + dynamic migration: add missing WebUI tools (paperclip, openclaw, langfuse, etc.) to services catalog and implement spoke-aware dynamic pre-migration seeding (May 18 at 11:06 PM)
9187 11:07p 🔵 Untracked Planning Document Found: docs/plans/paperclip-integration-and-fedora-support.md
9188 " 🔵 cortex-sandbox-runner is a Node.js App, Not Python/FastAPI — server.js + policy.js
9189 " 🔵 cortex-sandbox-runner Dockerfile Runs npm install at Build Time — package-lock.json Not Required in Repo
9190 11:09p 🔵 Additional Stack Directories Found: cortex-dashboard, cortex-consumer, cortex-paperclip-bridge in stacks/
9191 " 🔵 Opik Observability Tool Exists in stacks/ — Not Yet in Dashboard Seed or Caddy Config
9192 " 🔵 Fedora/RHEL Support Currently Absent from Tool Prompts — Only Planned in docs/plans/
9193 11:10p 🔵 Two Langfuse Prompt Files Exist: 35a-langfuse.md AND 55-langfuse.md — SPOKE_TO_SERVICES Only Maps 55-langfuse
9194 11:11p 🔵 35a-langfuse.md Uses Port 3000 — Conflicts with Grafana; 55-langfuse.md Supersedes It on Port 3001
9195 " 🔵 dashboard/Caddyfile.snippet is Orphaned — Zero References in the Entire Codebase
9196 " 🔵 dashboard/README.md Has Stale References: deploy.sh Still Documented, Default Admin User Claim Wrong
9197 11:12p 🔵 Dashboard Supports Three Locales: en, es, pt-br — Routes Under src/app/[locale]
9198 " 🔵 Opik Spokes Officially Retired — SETUP.md Confirms 35-opik and 48-openclaw-opik Removed
9199 " 🔵 Opik Cleanup Incomplete: stacks/opik/ and opik.service Template Remain; opik Snapshot Already Removed from docs/external/
9200 11:13p 🔵 Opik Cleanup Scope is Minimal — Only 3 Touch Points Remain
9201 " 🔵 Fedora/RHEL Support Explicitly Unsupported — OS Detection Actively Rejects It; Plan Doc is Future Aspirational Work
9202 " 🔵 vm-rehearse Uses Lima (not Vagrant) — paperclip/60-smoke-test.md Has Stale "Vagrant rehearsal" Label
9203 " 🔵 Dashboard package.json: Key Dependencies Include @xterm, nats, ai SDK, @cortexos Internal Packages
9204 11:14p 🔵 packages/cortex-telemetry Exists — OpenLLMetry Instrumentation Package for Langfuse Integration
9205 " 🔵 Critical: stacks/cortex-langfuse Uses Langfuse v3 with ClickHouse+MinIO — Contradicts 35a-langfuse.md v2 Rationale
9206 11:15p ✅ Cleanup: 8 Stale Files and Directories Deleted — Including Opik Stack, Caddyfile.snippet, and prompts/tools/35a-langfuse.md
9207 " ✅ .gitignore Updated to Exclude cortex-sandbox-runner Generated Files; .dockerignore Confirms Caddyfile.snippet Was Already Legacy
9208 " ✅ dashboard/README.md and .dockerignore Cleaned Up — Stale deploy.sh References Removed
9209 " ✅ dashboard/README.md Deployment Section Fully Rewritten — On-VPS Docker Compose Pattern Documented
9210 11:16p ✅ 004_tailscale_urls.sql Comment Updated — deploy.sh → provision-vps.sh; migrate.js Header Still Has Stale deploy.sh Reference
9211 " 🔴 99-final-validation.md: Opik Health Check Replaced with Langfuse — But Port 3000 Is Wrong for v3 Install
9212 " ✅ Opik Cleanup Complete in Most Files — 00-preflight.md Still Has Two Stale References

Access 222k tokens of past work via get_observations([IDs]) or mem-search skill.
</claude-mem-context>