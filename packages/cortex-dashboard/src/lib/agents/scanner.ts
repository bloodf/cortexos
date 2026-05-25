import { readdir, readFile, writeFile, stat } from "node:fs/promises";
import { isAbsolute, join, relative, resolve } from "node:path";

export interface AgentFile {
  id: string;
  name: string;
  path: string;
}

export interface Agent {
  slug: string;
  name: string;
  emoji?: string;
  model: string;
  workspace: string;
  files: AgentFile[];
  health?: {
    registered: boolean;
    roleFilesPresent: boolean;
    modelReachable: boolean;
    workflowPresent: boolean;
  };
}

export interface AgentGroup {
  project: string;
  agents: Agent[];
}

interface HermesProfile {
  profile: string;
  home: string;
  apiPort?: number;
  model?: string;
  reasoning?: string;
  honchoWorkspace?: string;
}

interface HermesRegistry {
  profiles?: HermesProfile[];
}

const DEFAULT_HERMES_ROOT = "/opt/cortexos/hermes";
const DEFAULT_HERMES_REGISTRY = `${DEFAULT_HERMES_ROOT}/profiles.json`;
const IDENTITY_MARKDOWN_FILES = new Set([
  "AGENTS.md",
  "IDENTITY.md",
  "INSTRUCTIONS.md",
  "PERSONALITY.md",
  "PIPELINE.md",
  "PROFILE.md",
  "README.md",
  "ROLE.md",
  "SOUL.md",
  "TOOLS.md",
  "WORKFLOW.md",
]);

function getRegistryPath(): string {
  return process.env.HERMES_PROFILES_REGISTRY || DEFAULT_HERMES_REGISTRY;
}

function getScanRoots(): string[] {
  return process.env.AGENT_SCAN_PATHS?.split(/[,:]/).filter(Boolean) || [
    `${DEFAULT_HERMES_ROOT}/profiles`,
  ];
}

function fileId(relativePath: string): string {
  return Buffer.from(relativePath).toString("base64url");
}

async function getMarkdownFiles(dir: string): Promise<AgentFile[]> {
  const root = resolve(dir);

  try {
    const rootStat = await stat(root);
    if (!rootStat.isDirectory()) return [];
    const entries = await readdir(root, { withFileTypes: true });
    return entries
      .filter((entry) => entry.isFile() && IDENTITY_MARKDOWN_FILES.has(entry.name))
      .map((entry) => ({
        id: fileId(entry.name),
        name: entry.name,
        path: join(root, entry.name),
      }))
      .sort((a, b) => a.name.localeCompare(b.name));
  } catch {
    return [];
  }
}

async function isModelEndpointReachable(model: string): Promise<boolean> {
  if (!model || model === "unknown") return false;
  const base = (process.env.NINEROUTER_BASE_URL || "http://127.0.0.1:11434").replace(/\/$/, "");
  const apiKey = process.env.NINEROUTER_API_KEY;
  const headers: Record<string, string> = {};
  if (apiKey) headers.Authorization = `Bearer ${apiKey}`;
  try {
    const res = await fetch(`${base}/v1/models`, { cache: "no-store", headers });
    if (!res.ok) return false;
    const payload = await res.json().catch(() => null);
    const ids = Array.isArray(payload?.data) ? payload.data.map((item: { id?: string }) => item.id) : [];
    return ids.length === 0 ? true : ids.includes(model);
  } catch {
    return false;
  }
}

function hasRoleFiles(files: AgentFile[]): boolean {
  const names = new Set(files.map((file) => file.name));
  return names.has("ROLE.md") || names.has("SOUL.md") || names.has("AGENTS.md");
}

function hasWorkflow(files: AgentFile[]): boolean {
  const names = new Set(files.map((file) => file.name));
  return names.has("WORKFLOW.md") || names.has("PIPELINE.md") || names.has("README.md");
}

function isWithinRoots(filePath: string, roots: string[]): boolean {
  const resolved = resolve(filePath);
  return roots.some((root) => {
    const rel = relative(resolve(root), resolved);
    return rel === "" || (!rel.startsWith("..") && !isAbsolute(rel));
  });
}

async function getAllowedFileRoots(): Promise<string[]> {
  const roots = new Set(getScanRoots());
  const registry = await readRegistry();
  for (const profile of registry?.profiles ?? []) {
    if (profile.home) roots.add(profile.home);
  }
  return [...roots];
}

function displayName(slug: string): string {
  return slug
    .split("-")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

async function readRegistry(): Promise<HermesRegistry | null> {
  try {
    return JSON.parse(await readFile(getRegistryPath(), "utf-8")) as HermesRegistry;
  } catch {
    return null;
  }
}

async function scanProfileDirs(): Promise<HermesProfile[]> {
  const profiles: HermesProfile[] = [];
  for (const root of getScanRoots()) {
    try {
      const rootStat = await stat(root);
      if (!rootStat.isDirectory()) continue;
      const entries = await readdir(root, { withFileTypes: true });
      for (const entry of entries.filter((item) => item.isDirectory())) {
        const home = join(root, entry.name);
        profiles.push({ profile: entry.name, home, model: "unknown" });
      }
    } catch {
      // Missing scan roots are ignored.
    }
  }
  return profiles;
}

export async function scanAgents(): Promise<AgentGroup[]> {
  const registry = await readRegistry();
  const profileList = registry?.profiles?.length ? registry.profiles : await scanProfileDirs();
  const groups: AgentGroup[] = [];

  for (const profile of profileList) {
    const files = await getMarkdownFiles(profile.home);
    const model = profile.model || "unknown";
    groups.push({
      project: displayName(profile.profile),
      agents: [
        {
          slug: profile.profile,
          name: displayName(profile.profile),
          model,
          workspace: profile.home,
          files,
          health: {
            registered: true,
            roleFilesPresent: hasRoleFiles(files),
            modelReachable: await isModelEndpointReachable(model),
            workflowPresent: hasWorkflow(files),
          },
        },
      ],
    });
  }

  return groups.sort((a, b) => a.project.localeCompare(b.project));
}

function slugifyProject(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}

export async function scanAgentsForProject(projectSlug: string): Promise<Agent[]> {
  const groups = await scanAgents();
  const normalized = slugifyProject(projectSlug);
  for (const group of groups) {
    if (slugifyProject(group.project) === normalized) return group.agents;
  }
  return groups.flatMap((group) => group.agents).filter((agent) => slugifyProject(agent.slug) === normalized);
}

export async function getAgentFiles(agentDir: string): Promise<AgentFile[]> {
  return getMarkdownFiles(agentDir);
}

export async function readAgentFile(filePath: string): Promise<string> {
  const roots = await getAllowedFileRoots();
  if (!isWithinRoots(filePath, roots)) throw new Error("Access denied: path outside scan roots");
  return readFile(filePath, "utf-8");
}

export async function writeAgentFile(filePath: string, content: string): Promise<void> {
  const roots = await getAllowedFileRoots();
  if (!isWithinRoots(filePath, roots)) throw new Error("Access denied: path outside scan roots");
  await writeFile(filePath, content, "utf-8");
}
