/**
 * Agent Generator — ProfileSpec + chat types (P2.2).
 *
 * `ProfileSpec` is the structured output the AI interview converges on; the
 * build step (P2.3) turns it into a real Hermes profile. Channels are the
 * platforms the agent should bind; `telegramBotToken` is captured when the
 * user supplies one (written to the profile .env during build).
 */

export type GeneratorReasoning = "low" | "medium" | "high";

export type AgentChannel =
  | "telegram"
  | "whatsapp"
  | "slack"
  | "discord"
  | "signal"
  | "email";

export interface ProfileMcp {
  name: string;
  url?: string;
  command?: string;
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
  /** Telegram bot token (if the user provided one); written to the profile .env. */
  telegramBotToken?: string;
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
};
