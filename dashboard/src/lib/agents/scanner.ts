import { readdir, readFile, writeFile, stat } from "node:fs/promises";
import { join, resolve } from "node:path";

export interface AgentFile {
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

const DEFAULT_OPENCLAW_BASE = `${process.env.HOME || "/home/cortex"}/.openclaw`;
const CONTAINER_PREFIX = "/home/node/.openclaw";

function getOpenclawBase(): string {
  return process.env.AGENT_SCAN_PATHS?.split(/[,:]/)[0] || process.env.OPENCLAW_BASE || DEFAULT_OPENCLAW_BASE;
}

// Group agents by the slug prefix before the first hyphen. Avoid hardcoding
// any project names — operators register projects via the admin UI.
function projectForSlug(slug: string): string {
  if (slug === "cortex") return "Cortex";
  const idx = slug.indexOf("-");
  const prefix = idx > 0 ? slug.slice(0, idx) : slug;
  if (!prefix) return "Other";
  return prefix.charAt(0).toUpperCase() + prefix.slice(1);
}

function hostPath(containerPath: string): string {
  if (containerPath.startsWith(CONTAINER_PREFIX)) {
    return containerPath.replace(CONTAINER_PREFIX, getOpenclawBase());
  }
  return containerPath;
}

function getScanRoots(): string[] {
  return process.env.AGENT_SCAN_PATHS?.split(/[,:]/).filter(Boolean) || [getOpenclawBase()];
}

async function getMarkdownFiles(dir: string): Promise<AgentFile[]> {
  try {
    const entries = await readdir(dir, { withFileTypes: true });
    return entries
      .filter((e) => e.isFile() && e.name.endsWith(".md") && !e.name.includes(".bak"))
      .map((e) => ({
        name: e.name,
        path: join(dir, e.name),
      }))
      .sort((a, b) => a.name.localeCompare(b.name));
  } catch {
    return [];
  }
}

async function isModelEndpointReachable(model: string): Promise<boolean> {
  if (!model || model === "unknown") return false;
  const base =
    process.env.NINEROUTER_BASE_URL ||
    process.env.ROUTER_BASE_URL ||
    "http://127.0.0.1:11434";
  const apiKey = process.env.NINEROUTER_API_KEY;
  const headers: Record<string, string> = {};
  if (apiKey) headers.Authorization = `Bearer ${apiKey}`;
  try {
    const res = await fetch(`${base}/v1/models`, {
      cache: "no-store",
      headers,
    });
    return res.ok;
  } catch {
    return false;
  }
}

function hasRoleFiles(files: AgentFile[]): boolean {
  const names = new Set(files.map((file) => file.name));
  return names.has("CLAUDE.md") && names.has("ROLE.md");
}

function hasWorkflow(files: AgentFile[]): boolean {
  const names = new Set(files.map((file) => file.name));
  return names.has("WORKFLOW.md") || names.has("PIPELINE.md");
}

function isWithinRoots(filePath: string, roots: string[]): boolean {
  const resolved = resolve(filePath);
  return roots.some((root) => resolved.startsWith(resolve(root)));
}

interface OpenClawAgent {
  id: string;
  name?: string;
  workspace?: string;
  model?: string | { primary?: string };
  identity?: { name?: string; emoji?: string };
}

interface OpenClawConfig {
  agents?: {
    list?: OpenClawAgent[];
  };
}

async function scanLegacyAgentDirs(): Promise<AgentGroup[]> {
  const groups: AgentGroup[] = [];

  async function walk(dir: string, projectName: string): Promise<void> {
    const entries = await readdir(dir, { withFileTypes: true });
    const agentsDir = entries.find((entry) => entry.isDirectory() && entry.name === ".agents");
    if (agentsDir) {
      const base = join(dir, agentsDir.name);
      const agentEntries = await readdir(base, { withFileTypes: true });
      const agents: Agent[] = [];
      for (const entry of agentEntries.filter((item) => item.isDirectory())) {
        const workspace = join(base, entry.name);
        agents.push({
          slug: entry.name,
          name: entry.name.charAt(0).toUpperCase() + entry.name.slice(1),
          model: "unknown",
          workspace,
          files: await getMarkdownFiles(workspace),
        });
      }
      if (agents.length > 0) groups.push({ project: projectName, agents });
      return;
    }

    for (const entry of entries.filter((item) => item.isDirectory())) {
      await walk(join(dir, entry.name), entry.name);
    }
  }

  for (const root of getScanRoots()) {
    try {
      const rootStat = await stat(root);
      if (rootStat.isDirectory()) await walk(root, root.split("/").pop() || root);
    } catch {
      // Missing scan roots are ignored.
    }
  }

  return groups;
}

export async function scanAgents(): Promise<AgentGroup[]> {
  const configPath = join(getOpenclawBase(), "openclaw.json");
  let config: OpenClawConfig;
  try {
    const raw = await readFile(configPath, "utf-8");
    config = JSON.parse(raw) as OpenClawConfig;
  } catch {
    return scanLegacyAgentDirs();
  }

  const agentList = config.agents?.list ?? [];
  const agents: Agent[] = [];

  for (const entry of agentList) {
    const workspace = entry.workspace ? hostPath(entry.workspace) : "";
    const agentDir = join(getOpenclawBase(), "agents", entry.id, "agent");
    const files = await getMarkdownFiles(agentDir);
    const model = typeof entry.model === "string" ? entry.model : (entry.model?.primary ?? "unknown");
    const shortModel = model.split("/").pop() ?? model;

    agents.push({
      slug: entry.id,
      name: entry.identity?.name || entry.name || entry.id,
      emoji: entry.identity?.emoji,
      model: shortModel,
      workspace,
      files,
      health: {
        registered: true,
        roleFilesPresent: hasRoleFiles(files),
        modelReachable: await isModelEndpointReachable(model),
        workflowPresent: hasWorkflow(files),
      },
    });
  }

  const byProject = new Map<string, Agent[]>();
  for (const agent of agents) {
    const project = projectForSlug(agent.slug);
    const bucket = byProject.get(project) ?? [];
    bucket.push(agent);
    byProject.set(project, bucket);
  }

  return Array.from(byProject.entries())
    .map(([project, list]) => ({
      project,
      agents: list.sort((a, b) => a.slug.localeCompare(b.slug)),
    }))
    .sort((a, b) => a.project.localeCompare(b.project));
}

export async function getAgentFiles(agentDir: string): Promise<AgentFile[]> {
  return getMarkdownFiles(agentDir);
}

export async function readAgentFile(filePath: string): Promise<string> {
  const roots = getScanRoots();
  if (!isWithinRoots(filePath, roots)) {
    throw new Error("Access denied: path outside scan roots");
  }
  return readFile(filePath, "utf-8");
}

export async function writeAgentFile(
  filePath: string,
  content: string,
): Promise<void> {
  const roots = getScanRoots();
  if (!isWithinRoots(filePath, roots)) {
    throw new Error("Access denied: path outside scan roots");
  }
  await writeFile(filePath, content, "utf-8");
}
