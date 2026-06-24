/**
 * Agent Generator — ProfileSpec + chat types (P2.2).
 *
 * `ProfileSpec` is the structured output the AI interview converges on; the
 * build step (P2.3) turns it into a real Hermes profile. Channels are the
 * platforms the agent should bind; `telegramBotToken` is captured when the
 * user supplies one (written to the profile .env during build).
 */

export type ProfileStatus = "draft" | "ready" | "deployed";

export type GeneratorReasoning = "low" | "medium" | "high";

export type AgentChannel = "telegram" | "whatsapp" | "slack" | "discord" | "signal" | "email";

export interface ProfileMcp {
  name: string;
  /** Hermes catalog preset name (e.g. "linear", "n8n"); takes precedence. */
  preset?: string;
  url?: string;
  command?: string;
  /** Arguments for a stdio command server (passed last, as `hermes mcp add` requires). */
  args?: string[];
  /**
   * Credentials / env vars (e.g. API keys) the operator provided for this MCP
   * server. Written to the profile's own secured .env (mode 0600) at build
   * time so the server process can read them; never logged or echoed.
   */
  env?: Record<string, string>;
  /** Human label for which real-world account this MCP belongs to (e.g.
   *  "Space Dinosaurs JIRA", "Crocs JIRA", "Pantone JIRA", "bloodf GitHub",
   *  "Pantone Enterprise GitHub", "Crocs Enterprise GitHub",
   *  "Space Dinosaurs Granola"). Surfaced in the spec review UI so the
   *  operator can confirm each MCP is wired to the right account before build.
   *  Also persisted to the profile's accounts.yaml for downstream tooling. */
  accountLabel?: string;
  /** Class of the credential so the operator can see at build time who owns
   *  the token (and whether revocation goes through them or through HR/IT).
   *  - "personal": operator's own token (their personal GitHub, JIRA boards
   *    they own, etc.)
   *  - "employer-issued": issued by the operator's employer (Pantone Enterprise
   *    GitHub, Crocs Enterprise GitHub, Crocs JIRA, etc.). Revoking requires
   *    HR/IT.
   *  - "client-issued": issued by a client (Express via Solara6, etc.). */
  credentialClass?: "personal" | "employer-issued" | "client-issued";
}

/** The collected spec the generator builds a profile from. */
export interface ProfileSpec {
  slug: string;
  name: string;
  description: string;
  model: string;
  reasoning: GeneratorReasoning;
  channels: AgentChannel[];
  skills: string[];
  mcps: ProfileMcp[];
  /**
   * Integration catalog ids to enable (e.g. "gsuite", "ms365", "github").
   * Expanded at build time into MCP servers + skills + credential placeholders
   * in the profile .env. See integration-catalog.ts.
   */
  integrations?: string[];
  /** Roles the single-model agent should embody (folded into its persona). */
  roles?: ProfileRole[];
  /**
   * The agent's persona as a complete SOUL.md markdown document (identity, role,
   * tone, language, domain, rules). Written to the profile's SOUL.md at build —
   * this IS the agent's identity. If omitted, one is generated from the fields.
   */
  soul?: string;
  /** Telegram bot token (if the user provided one); written to the profile .env. */
  telegramBotToken?: string;
  /** Free-form deployment + operator context the build can persist alongside
   *  the profile. Keys the prompt should populate:
   *  - deploymentModel: "local-hermes-profile" | string
   *  - oauthHandoff: "operator-local-machine" | string
   *  - perProfileIsolation: true | string
   *  - operatorContext: string (e.g. "ADHD operator with two jobs ...")
   *  Unknown keys are preserved (JSON round-trips through parseSpecFromText). */
  meta?: Record<string, unknown>;
  /** EOD / status / report outputs the running agent should produce.
   *  Persisted to the profile's outputs.yaml so a downstream cron / EOD
   *  generator can route per-output. Each entry:
   *  - name: "angel-eod" | "howie-eod" | string
   *  - trigger: "every-weekday-1800-local" | "days-worked-on-evolve" | string
   *  - format: "markdown" | "slack-block" | "plain-text" | string
   *  - channel: "slack" | "email" | "telegram" | string
   *  - template: optional markdown template the agent can fill in */
  outputs?: ProfileOutput[];
  /** Lifecycle status of this spec. "draft" during the interview; "ready" when
   *  the operator approves and queues the build; "deployed" set by the build on
   *  success. Never set "deployed" manually — only the build does that. */
  status?: ProfileStatus;
}

export interface ProfileOutput {
  name: string;
  trigger: string;
  format: string;
  channel: string;
  template?: string;
}

/**
 * A role the agent should cover (coder, reviewer, qa, security, planner, …).
 * Hermes runs ONE model per profile, so roles describe modes the single agent
 * embodies via its persona — not separate per-role models (that would be a
 * multi-profile team, out of scope here).
 */
export interface ProfileRole {
  role: string;
  focus?: string;
}

export interface GeneratorMessage {
  role: "user" | "assistant" | "system";
  content: string;
}

export interface GeneratorAttachment {
  filename: string;
  mime: string;
  dataBase64: string;
}

export interface GeneratorTurnInput {
  model: string;
  reasoning: GeneratorReasoning;
  messages: GeneratorMessage[];
  attachments?: GeneratorAttachment[];
  /** The partial spec so far, so the model can refine rather than restart. */
  specSoFar?: Partial<ProfileSpec>;
}

export interface GeneratorTurnResult {
  text: string;
  /** A parsed/updated spec when the model emitted one; undefined otherwise. */
  spec?: Partial<ProfileSpec>;
  /** True when the model signals the interview is complete. */
  done?: boolean;
}

export const EMPTY_SPEC: ProfileSpec = {
  slug: "",
  name: "",
  description: "",
  model: "",
  reasoning: "medium",
  channels: [],
  skills: [],
  mcps: [],
  meta: {},
  outputs: [],
  status: "draft",
};
