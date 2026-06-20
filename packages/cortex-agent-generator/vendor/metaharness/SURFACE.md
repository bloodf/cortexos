# MetaHarness — discovered surface (SURFACE.md)

Inspected `metaharness@0.1.5` (`dist/index.d.ts`) + `@ruvnet/agent-harness-generator@0.1.3`
(re-export wrapper). The library surface, as published:

## Exports (from `metaharness`)

**Constants**
- `HOSTS`: `readonly ["claude-code", "codex", "pi-dev", "hermes", "openclaw", "rvm", "copilot", "opencode", "github-actions"]`
- `TEMPLATES`: 20 ids — `"minimal"`, `"vertical:devops"`, `"vertical:support"`, `"vertical:trading"`, `"vertical:legal"`, `"vertical:research"`, `"vertical:coding"`, `"vertical:business"`, `"vertical:crm"`, `"vertical:marketing"`, `"vertical:advertising"`, `"vertical:ai"`, `"vertical:agentics"`, `"vertical:ruview"`, `"vertical:health"`, `"vertical:education"`, `"vertical:sales"`, `"vertical:gaming"`, `"vertical:repo-maintainer"`, `"vertical:exotic"`.

**Catalog**
- `loadCatalog(): CatalogEntry[]` — reads `templates/catalog.json`. Each entry: `{ id, category, name, domain, description, quickStart, tags, generate, agentCount, skillCount, commandCount }`.
- `formatCatalog(entries): string[]` — human-readable table rows.

**Scaffold**
- `scaffold(opts: ScaffoldOptions): Promise<ScaffoldResult>` — `{ name, template, host, description?, targetDir, force?, generatorVersion }` → `{ paths, manifestPath, unresolved }`.
- `templateDir(id): string`, `parseArgs(argv): CliArgs`, `main(argv): Promise<number>`.
- Rendering: `render`, `extractVarReferences`, `validateHarnessName`, `walkTemplate`, `asFileMap`, `writeAtomic`.
- Manifest/fingerprint: `emptyManifest`, `sha256`, `fingerprintFiles`, `diffFingerprints`.

## What CortexOS uses

**None of the code exports.** MetaHarness has NO `recommend(description)` /
NLP function — it is a template catalog + scaffold pipeline. The catalog
itself (`templates/catalog.json`) IS the data source for recommendations.

`recommendForPurpose` (in
`packages/dashboard-next/src/server/agents/generator/metaharness-adapter.ts`)
reads the vendored catalog snapshot (`catalog-index.json`) and does keyword
matching on `domain`/`desc`/`tags` to pick the best-matching template, then
returns that template's concrete `agents`/`skills`/`mcps` name lists. This
satisfies the plan's "extract skill/MCP/agent name lists" without running the
foreign scaffold pipeline.
