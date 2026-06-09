# WP-21 — API: Agents (Hermes Profiles + File Upload)

- **Wave:** 1
- **Depends-on:** WP-01, WP-02
- **Parallel-safe-with:** WP-10, WP-11, WP-12, WP-13, WP-14, WP-15, WP-16, WP-17, WP-18, WP-19, WP-20
- **Owns (edit only these):**
  - `packages/dashboard-next/src/server/agents/`
  - `packages/dashboard-next/src/routes/api/agents/`
- **Do NOT touch:** `src/server/db/`, `src/server/define-api-route.ts`, `src/server/auth/`, any other WP's folder

## Objective

Port the Hermes agent profile endpoints: list profiles (scan filesystem paths), get a single profile by slug, update a profile's YAML/JSON config, list files in the profile directory, upload a file to the profile directory (path traversal blocked), and delete a file. No DB — profiles live on disk. Admin-only for mutations; any auth for reads.

## Read first

- **Legacy handlers (primary source — read all fully):**
  - `packages/dashboard/src/routes/api/agents/+server.ts` — GET list agents (scans paths, parses profile YAML/JSON)
  - `packages/dashboard/src/routes/api/agents/[slug]/+server.ts` — GET single agent, PATCH update
  - `packages/dashboard/src/routes/api/agents/[slug]/files/+server.ts` — GET list files, POST upload file, DELETE file
    - `AGENT_SCAN_PATHS` from env or defaults: `['/home/cortexos/.openclaw', '/opt/cortexos/hermes/profiles']`
    - Path traversal block: `filePath.includes('..') || filePath.startsWith('/')` → reject
    - Target validation: `target.startsWith(agentDir + '/')` — resolved target must be a child of the agent's directory
    - Upload: `multipart/form-data` with `file` field; `filename` field for destination
- **Hermes profile format (read the scan logic carefully):**
  - Files: `*.yaml`, `*.yml`, `*.json` under scan directories
  - Profile fields: `slug` (from filename), `name`, `description`, `model`, `systemPrompt`, `tools`, `fallbackModel`, `enabled`
  - YAML parsed with `js-yaml`; JSON parsed with `JSON.parse`
- **Contract section:** `01-API-CONTRACT.md §Agents (WP-21)`
- **Schema:** `packages/dashboard/src/lib/server/db/schema.ts` — check if there is an `agents` or `hermes_profiles` table (agents may be DB-backed in newer versions); if so, port the DB path; if not, keep filesystem-only.

## Steps

1. **Create `src/server/agents/scanner.ts`** — filesystem profile scanner:
   ```ts
   import fs from 'node:fs';
   import path from 'node:path';
   import yaml from 'js-yaml';
   
   const DEFAULT_SCAN_PATHS = [
     '/home/cortexos/.openclaw',
     '/opt/cortexos/hermes/profiles',
   ];
   
   export function getScanPaths(): string[] {
     const envPaths = process.env.AGENT_SCAN_PATHS;
     if (envPaths) return envPaths.split(':').filter(Boolean);
     return DEFAULT_SCAN_PATHS;
   }
   
   export interface AgentProfile {
     slug: string;
     name: string;
     description?: string;
     model?: string;
     fallbackModel?: string;
     systemPrompt?: string;
     tools?: string[];
     enabled?: boolean;
     profilePath: string;   // absolute path to the profile file
     profileDir: string;    // directory containing the profile file
   }
   
   export function loadProfile(filePath: string): AgentProfile | null {
     try {
       const raw = fs.readFileSync(filePath, 'utf8');
       const ext = path.extname(filePath).toLowerCase();
       const data = (ext === '.json') ? JSON.parse(raw) : yaml.load(raw) as Record<string, unknown>;
       const slug = path.basename(filePath, ext);
       return {
         slug: data['slug'] as string ?? slug,
         name: data['name'] as string ?? slug,
         description: data['description'] as string | undefined,
         model: data['model'] as string | undefined,
         fallbackModel: data['fallbackModel'] as string | undefined,
         systemPrompt: data['systemPrompt'] as string | undefined,
         tools: data['tools'] as string[] | undefined,
         enabled: data['enabled'] as boolean | undefined ?? true,
         profilePath: filePath,
         profileDir: path.dirname(filePath),
       };
     } catch { return null; }
   }
   
   export function scanProfiles(): AgentProfile[] {
     const profiles: AgentProfile[] = [];
     for (const scanPath of getScanPaths()) {
       if (!fs.existsSync(scanPath)) continue;
       for (const entry of fs.readdirSync(scanPath, { withFileTypes: true })) {
         if (!entry.isFile()) continue;
         const ext = path.extname(entry.name).toLowerCase();
         if (!['.yaml', '.yml', '.json'].includes(ext)) continue;
         const profile = loadProfile(path.join(scanPath, entry.name));
         if (profile) profiles.push(profile);
       }
     }
     return profiles;
   }
   
   export function findProfileBySlug(slug: string): AgentProfile | null {
     return scanProfiles().find(p => p.slug === slug) ?? null;
   }
   ```

2. **Create `src/server/agents/files.ts`** — file operations with path traversal protection:
   ```ts
   import fs from 'node:fs';
   import path from 'node:path';
   
   export function validateFilePath(agentDir: string, filePath: string): string {
     // Reject traversal attempts before resolve
     if (filePath.includes('..') || filePath.startsWith('/')) {
       throw new Error('path_traversal');
     }
     const target = path.resolve(agentDir, filePath);
     // Resolved path must still be within agentDir
     if (!target.startsWith(agentDir + path.sep) && target !== agentDir) {
       throw new Error('path_traversal');
     }
     return target;
   }
   
   export function listAgentFiles(agentDir: string): string[] {
     if (!fs.existsSync(agentDir)) return [];
     return fs.readdirSync(agentDir)
       .filter(name => !name.startsWith('.'))
       .sort();
   }
   
   export function writeAgentFile(agentDir: string, filename: string, data: Buffer): void {
     const target = validateFilePath(agentDir, filename);
     fs.mkdirSync(path.dirname(target), { recursive: true });
     fs.writeFileSync(target, data);
   }
   
   export function deleteAgentFile(agentDir: string, filename: string): void {
     const target = validateFilePath(agentDir, filename);
     if (!fs.existsSync(target)) throw new Error('not_found');
     fs.unlinkSync(target);
   }
   ```

3. **Create `src/server/agents/index.ts`** — re-exports:
   ```ts
   export * from './scanner';
   export * from './files';
   ```

4. **Declare list + create route — `src/routes/api/agents/index.ts`:**
   ```
   GET /api/agents — auth: any
       → scanProfiles(), returns {agents: AgentProfile[]}
   ```
   No POST (profiles are created by editing YAML files on disk directly; the dashboard does not create new profile files).

5. **Declare single agent route — `src/routes/api/agents/$slug/index.ts`:**
   ```
   GET   /api/agents/:slug — auth: any
         → findProfileBySlug(slug) or 404
         returns AgentProfile

   PATCH /api/agents/:slug — auth: admin
         input: AgentPatchSchema (all fields optional)
         → load profile, merge patch fields, write back as YAML/JSON
         returns AgentProfile
   ```
   `AgentPatchSchema`:
   ```ts
   z.object({
     name: z.string().min(1).max(255).optional(),
     description: z.string().max(2000).optional(),
     model: z.string().max(128).optional(),
     fallbackModel: z.string().max(128).optional(),
     systemPrompt: z.string().max(65535).optional(),
     tools: z.array(z.string()).optional(),
     enabled: z.boolean().optional(),
   })
   ```
   Write-back: read the existing file, merge the patch fields (shallow), write the merged object back. Preserve YAML format if the file was YAML; JSON if JSON. Use `js-yaml`'s `dump()` for YAML.

6. **Declare files routes — `src/routes/api/agents/$slug/files/index.ts`:**
   ```
   GET    /api/agents/:slug/files — auth: admin
          → findProfileBySlug(slug) or 404
          → listAgentFiles(profile.profileDir)
          returns {files: string[]}

   POST   /api/agents/:slug/files — auth: admin
          content-type: multipart/form-data
          fields: file (binary), filename (string)
          → validateFilePath(agentDir, filename)
          → writeAgentFile(agentDir, filename, fileBuffer)
          returns {ok: true, path: filename} (201)

   DELETE /api/agents/:slug/files — auth: admin
          input: { filename: string }
          → validateFilePath(agentDir, filename)
          → deleteAgentFile(agentDir, filename)
          returns {ok: true}
   ```
   File upload size limit: 10 MB. Reject filenames with `..` or absolute paths before calling `validateFilePath` (belt-and-suspenders).

7. **Auth / audit:**
   - All GET routes: `auth: 'any'`, `surface: 'agents'`
   - PATCH / POST / DELETE: `auth: 'admin'`, `surface: 'agents'`
   - Audit `target` for file ops: `slug + ':' + filename` (never the file contents)
   - PATCH audit `target`: the profile slug

## Acceptance criteria

- [ ] `GET /api/agents` returns profiles from `AGENT_SCAN_PATHS` (or defaults); count matches number of YAML/JSON files in those directories
- [ ] `GET /api/agents/:slug` returns the parsed profile; 404 for unknown slug
- [ ] `PATCH /api/agents/:slug` updates a field (e.g. `enabled: false`); re-reading the profile file shows the change; returns updated profile
- [ ] `GET /api/agents/:slug/files` returns list of files in the profile's directory (non-hidden)
- [ ] `POST /api/agents/:slug/files` uploads a file; appears in subsequent GET list; file present on disk
- [ ] `POST /api/agents/:slug/files` with `filename=../../etc/passwd` → 400 (`path_traversal`)
- [ ] `POST /api/agents/:slug/files` with `filename=/etc/passwd` → 400 (`path_traversal`)
- [ ] `DELETE /api/agents/:slug/files` with `filename=test.txt` (existing) → `{ok:true}`; file gone from disk
- [ ] `DELETE /api/agents/:slug/files` with non-existent filename → 404
- [ ] `pnpm --filter @cortexos/dashboard-next typecheck` passes
- [ ] No edits outside OWNS

## Verification commands

```bash
pnpm --filter @cortexos/dashboard-next typecheck

# List agents
curl -s http://localhost:3080/api/agents \
  -b "cortexos_session=$SESSION" | jq '{count:.agents|length, slugs:[.agents[].slug]}'

# Get single agent
SLUG=$(curl -s http://localhost:3080/api/agents -b "cortexos_session=$SESSION" | jq -r '.agents[0].slug')
curl -s "http://localhost:3080/api/agents/$SLUG" \
  -b "cortexos_session=$SESSION" | jq '{slug, model, enabled}'

# Patch agent
curl -s -X PATCH "http://localhost:3080/api/agents/$SLUG" \
  -H "Content-Type: application/json" \
  -H "x-csrf-token: $CSRF" \
  -b "cortexos_session=$SESSION" \
  -d '{"enabled":false}' | jq .enabled
# expect false

# List files
curl -s "http://localhost:3080/api/agents/$SLUG/files" \
  -b "cortexos_session=$SESSION" | jq .files

# Upload file
echo "test content" > /tmp/test-upload.txt
curl -s -X POST "http://localhost:3080/api/agents/$SLUG/files" \
  -H "x-csrf-token: $CSRF" \
  -b "cortexos_session=$SESSION" \
  -F "file=@/tmp/test-upload.txt" \
  -F "filename=test-upload.txt" | jq .ok

# Path traversal blocked
curl -s -X POST "http://localhost:3080/api/agents/$SLUG/files" \
  -H "x-csrf-token: $CSRF" \
  -b "cortexos_session=$SESSION" \
  -F "file=@/tmp/test-upload.txt" \
  -F "filename=../../etc/evil" | jq .code
# expect path_traversal or validation_error

# Delete file
curl -s -X DELETE "http://localhost:3080/api/agents/$SLUG/files" \
  -H "Content-Type: application/json" \
  -H "x-csrf-token: $CSRF" \
  -b "cortexos_session=$SESSION" \
  -d '{"filename":"test-upload.txt"}' | jq .ok

# Disk check
ls /home/cortexos/.openclaw/ 2>/dev/null || ls /opt/cortexos/hermes/profiles/ 2>/dev/null
```

## Notes / gotchas

- **`AGENT_SCAN_PATHS` env var** — colon-separated list of directories: `AGENT_SCAN_PATHS=/home/cortexos/.openclaw:/opt/cortexos/hermes/profiles`. Port this exactly from the legacy handler. If the env var is not set, use the two defaults. Never hard-code a single path.
- **`js-yaml` dependency** — check that `js-yaml` (and `@types/js-yaml`) are in `packages/dashboard-next/package.json`. The legacy dashboard uses it; it should already be a workspace dependency.
- **Path traversal is double-checked** — the `validateFilePath` function checks for `..` and leading `/` **before** calling `path.resolve`, then checks that the resolved path is still inside `agentDir` **after** resolving. Both checks are required; skip either and symlink or encoded-slash attacks become possible.
- **Profile slug source** — the `slug` field in the YAML/JSON takes precedence over the filename (without extension). If `slug` is not set in the file, fall back to the filename stem. The URL parameter `:slug` is matched against `profile.slug` (not the filename).
- **No DB** — profiles are filesystem-only. No `agents` table involved. If the legacy handler also queries a DB, inspect it; if the DB stores profile config in addition to the filesystem, port the DB path too. Based on the legacy `routes/api/agents/[slug]/files/+server.ts` inspection, the implementation is filesystem-only.
- **File upload multipart parsing** — TanStack Start / h3 exposes `readMultipartFormData(event)` for multipart parsing. Each part has `name`, `filename`, `data` (Buffer). Find the `file` part for the binary content and the `filename` part for the destination path.
- **Write-back YAML** — `js-yaml`'s `dump()` produces clean YAML. When patching a profile that was originally YAML, write back YAML. When the original was JSON, write back JSON. Detect from `path.extname(profile.profilePath)`.
- **Scan is per-request** — `scanProfiles()` reads the filesystem on every request (no cache). For M3 simplicity this is fine; caching is a Wave-4 optimisation.
- **Hidden files excluded** — `listAgentFiles` skips filenames starting with `.` (dotfiles). This prevents listing `.gitignore`, `.DS_Store`, etc. Port this filter from the legacy handler.
