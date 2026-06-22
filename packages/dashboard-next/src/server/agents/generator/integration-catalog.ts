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
  url?: string;
  command?: string;
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

export const INTEGRATION_CATALOG: readonly IntegrationTemplate[] = [
  {
    id: "gsuite",
    name: "Google Workspace",
    desc: "Gmail, Calendar, Drive, Sheets and Docs.",
    mcps: [{ name: "google-workspace", command: "npx -y @modelcontextprotocol/server-gsuite" }],
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
    desc: "Outlook mail & calendar, OneDrive, Teams, Excel.",
    mcps: [{ name: "microsoft-365", command: "npx -y @modelcontextprotocol/server-microsoft365" }],
    skills: [],
    credentialEnvKeys: ["MS365_TENANT_ID", "MS365_CLIENT_ID", "MS365_CLIENT_SECRET"],
  },
  {
    id: "github",
    name: "GitHub",
    desc: "Repos, issues, pull requests and Actions.",
    mcps: [{ name: "github", command: "npx -y @modelcontextprotocol/server-github" }],
    skills: [],
    credentialEnvKeys: ["GITHUB_PERSONAL_ACCESS_TOKEN"],
  },
  {
    id: "notion",
    name: "Notion",
    desc: "Pages and databases.",
    mcps: [{ name: "notion", command: "npx -y @notionhq/notion-mcp-server" }],
    skills: [],
    credentialEnvKeys: ["NOTION_API_KEY"],
  },
  {
    id: "slack",
    name: "Slack",
    desc: "Channels, DMs and search.",
    mcps: [{ name: "slack", command: "npx -y @modelcontextprotocol/server-slack" }],
    skills: [],
    credentialEnvKeys: ["SLACK_BOT_TOKEN", "SLACK_TEAM_ID"],
  },
  {
    id: "filesystem",
    name: "Filesystem",
    desc: "Scoped local file access for the agent.",
    mcps: [{ name: "filesystem", command: "npx -y @modelcontextprotocol/server-filesystem" }],
    skills: [],
    credentialEnvKeys: [],
  },
  {
    id: "web",
    name: "Web Search & Fetch",
    desc: "Live web search and page fetching.",
    mcps: [{ name: "fetch", command: "npx -y @modelcontextprotocol/server-fetch" }],
    skills: [],
    credentialEnvKeys: [],
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
