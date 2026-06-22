/**
 * Integration catalog for the Agent Generator (Stage 1 — rich profile builder).
 *
 * Each integration maps a friendly id (e.g. "gsuite") the operator selects in
 * the interview to the concrete things the build step applies to a Hermes
 * profile: MCP servers to add, skills to install, and the credential env keys
 * the operator must populate in the profile .env.
 *
 * MCP `command`/`url` values are sensible DEFAULTS — the build runs them
 * best-effort and surfaces warnings, and the operator reviews the spec before
 * building. Adjust as the available MCP servers in the deployment firm up.
 */

export interface IntegrationMcp {
  name: string;
  /** Hermes catalog preset name; takes precedence over command/url. */
  preset?: string;
  url?: string;
  command?: string;
  args?: string[];
  /** Credentials/env vars; aligns with ProfileMcp so the two can be merged. */
  env?: Record<string, string>;
}

export interface IntegrationTemplate {
  id: string;
  name: string;
  desc: string;
  mcps: IntegrationMcp[];
  skills: string[];
  /** Credential env keys written (empty) to the profile .env for the operator to fill. */
  credentialEnvKeys: string[];
}

// Grounded in `hermes mcp catalog` (presets: linear, n8n, …) and known-good npm
// packages. Entries without a Hermes preset run best-effort via npx; the build
// warns on failure and the operator can correct via the custom-MCP flow.
export const INTEGRATION_CATALOG: readonly IntegrationTemplate[] = [
  {
    id: "linear",
    name: "Linear",
    desc: "Find, create and update Linear issues, projects and comments (Hermes preset).",
    mcps: [{ name: "linear", preset: "linear" }],
    skills: [],
    credentialEnvKeys: [],
  },
  {
    id: "n8n",
    name: "n8n",
    desc: "Manage and inspect n8n workflows (Hermes preset).",
    mcps: [{ name: "n8n", preset: "n8n" }],
    skills: [],
    credentialEnvKeys: [],
  },
  {
    id: "github",
    name: "GitHub",
    desc: "Repos, issues, pull requests and Actions.",
    mcps: [
      {
        name: "github",
        command: "npx",
        args: ["-y", "@modelcontextprotocol/server-github"],
        env: { GITHUB_PERSONAL_ACCESS_TOKEN: "" },
      },
    ],
    skills: [],
    credentialEnvKeys: ["GITHUB_PERSONAL_ACCESS_TOKEN"],
  },
  {
    id: "notion",
    name: "Notion",
    desc: "Pages and databases.",
    mcps: [
      {
        name: "notion",
        command: "npx",
        args: ["-y", "@notionhq/notion-mcp-server"],
        env: { NOTION_API_KEY: "" },
      },
    ],
    skills: [],
    credentialEnvKeys: ["NOTION_API_KEY"],
  },
  {
    id: "slack",
    name: "Slack",
    desc: "Channels, DMs and search.",
    mcps: [
      {
        name: "slack",
        command: "npx",
        args: ["-y", "@modelcontextprotocol/server-slack"],
        env: { SLACK_BOT_TOKEN: "", SLACK_TEAM_ID: "" },
      },
    ],
    skills: [],
    credentialEnvKeys: ["SLACK_BOT_TOKEN", "SLACK_TEAM_ID"],
  },
  {
    id: "gsuite",
    name: "Google Workspace",
    desc: "Google Drive/Workspace (community server; extend per your Workspace setup).",
    mcps: [{ name: "gdrive", command: "npx", args: ["-y", "@modelcontextprotocol/server-gdrive"] }],
    skills: [],
    credentialEnvKeys: [
      "GOOGLE_OAUTH_CLIENT_ID",
      "GOOGLE_OAUTH_CLIENT_SECRET",
      "GOOGLE_OAUTH_REFRESH_TOKEN",
    ],
  },
  {
    id: "ms365",
    name: "Microsoft 365",
    desc: "Outlook mail & calendar, OneDrive, Teams, Excel (community server).",
    mcps: [{ name: "ms365", command: "npx", args: ["-y", "@softeria/ms-365-mcp-server"] }],
    skills: [],
    credentialEnvKeys: ["MS365_TENANT_ID", "MS365_CLIENT_ID", "MS365_CLIENT_SECRET"],
  },
  {
    id: "filesystem",
    name: "Filesystem",
    desc: "Scoped local file access for the agent.",
    mcps: [
      {
        name: "filesystem",
        command: "npx",
        args: ["-y", "@modelcontextprotocol/server-filesystem", "${MCP_FILESYSTEM_ROOTS}"],
      },
    ],
    skills: [],
    credentialEnvKeys: ["MCP_FILESYSTEM_ROOTS"],
  },
  {
    id: "web",
    name: "Web Search (Brave)",
    desc: "Live web search via Brave Search.",
    mcps: [
      {
        name: "brave-search",
        command: "npx",
        args: ["-y", "@modelcontextprotocol/server-brave-search"],
        env: { BRAVE_API_KEY: "" },
      },
    ],
    skills: [],
    credentialEnvKeys: ["BRAVE_API_KEY"],
  },
];

const BY_ID = new Map(INTEGRATION_CATALOG.map((t) => [t.id, t]));

export function getIntegration(id: string): IntegrationTemplate | undefined {
  return BY_ID.get(id);
}

/**
 * Expand a list of integration ids into the concrete mcps/skills/credential
 * keys to apply. Unknown ids are returned in `unknown` so the build can warn.
 */
export function expandIntegrations(ids: readonly string[] | undefined): {
  mcps: IntegrationMcp[];
  skills: string[];
  credentialEnvKeys: string[];
  unknown: string[];
} {
  const mcps: IntegrationMcp[] = [];
  const skills: string[] = [];
  const credentialEnvKeys: string[] = [];
  const unknown: string[] = [];
  for (const id of ids ?? []) {
    const t = BY_ID.get(id);
    if (!t) {
      unknown.push(id);
      continue;
    }
    mcps.push(...t.mcps);
    skills.push(...t.skills);
    credentialEnvKeys.push(...t.credentialEnvKeys);
  }
  return {
    mcps,
    skills: [...new Set(skills)],
    credentialEnvKeys: [...new Set(credentialEnvKeys)],
    unknown,
  };
}
