/**
 * MetaHarness recommendation adapter (P2.0).
 *
 * Maps a free-text purpose description (+ optional repo URL) to recommended
 * agents / skills / MCPs, using the vendored MetaHarness template catalog
 * (`recommendation-catalog.ts`, generated from
 * `packages/cortex-agent-generator/vendor/metaharness/catalog-index.json`).
 *
 * The catalog is 20 vertical templates (devops, support, trading, legal, …),
 * each carrying concrete agent/skill/mcp NAME lists. `recommendForPurpose`
 * scores every template against the description's keywords and returns the
 * best match's lists (union of the top-N matches when scores tie).
 *
 * Contract: NEVER throws. Any error → `{ skills: [], mcps: [], agents: [] }`
 * and a warning is logged. Profile creation does NOT depend on this — the AI
 * interviewer gets pre-seeded suggestions that it then refines.
 */

import { RECOMMENDATION_CATALOG } from "@/server/agents/generator/recommendation-catalog";

export interface RecommendInput {
  /** Free-text description of what the agent should do / its domain. */
  description: string;
  /** Optional repo URL (accepted for API symmetry; not yet used for scoring). */
  repoUrl?: string;
}

export interface RecommendMcp {
  name: string;
  url?: string;
  command?: string;
}

export interface RecommendResult {
  skills: string[];
  mcps: RecommendMcp[];
  agents: string[];
}

// Generic stop-words removed before keyword extraction so "an agent that does
// incident response for devops" scores on {incident, response, devops}, not
// {an, agent, that, does, for}.
const STOP_WORDS = new Set([
  "a", "an", "the", "and", "or", "for", "to", "of", "in", "on", "with",
  "that", "this", "is", "are", "be", "do", "does", "it", "its", "my",
  "i", "we", "want", "need", "build", "create", "make", "agent", "agents",
  "hermes", "profile", "please", "help", "me", "should", "will", "can",
]);

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .split(/[^a-z0-9-]+/)
    .map((t) => t.trim())
    .filter((t) => t.length > 1 && !STOP_WORDS.has(t));
}

function scoreTemplate(template: { domain: string; desc: string; tags: string[] }, keywords: string[]): number {
  const haystack = `${template.domain} ${template.desc} ${template.tags.join(" ")}`.toLowerCase();
  let score = 0;
  for (const kw of keywords) {
    if (haystack.includes(kw)) score += 1;
  }
  return score;
}

/**
 * Recommend agents/skills/mcps for a described purpose. Returns empty lists on
 * any error or when no template scores above zero.
 */
export async function recommendForPurpose(input: RecommendInput): Promise<RecommendResult> {
  try {
    const description = (input?.description ?? "").trim();
    if (!description) {
      return { skills: [], mcps: [], agents: [] };
    }
    const keywords = tokenize(description);
    if (keywords.length === 0) {
      return { skills: [], mcps: [], agents: [] };
    }

    const scored = RECOMMENDATION_CATALOG.map((t) => ({ t, s: scoreTemplate(t, keywords) }))
      .filter((x) => x.s > 0)
      .sort((a, b) => b.s - a.s);

    if (scored.length === 0) {
      return { skills: [], mcps: [], agents: [] };
    }

    // Union the top templates (those within 1 of the top score) so a tie
    // between e.g. "support" and "crm" contributes both skill sets.
    const topScore = scored[0].s;
    const top = scored.filter((x) => x.s >= topScore - 1).map((x) => x.t);

    const skills = new Set<string>();
    const agents = new Set<string>();
    const mcpNames = new Set<string>();
    for (const t of top) {
      t.skills.forEach((s) => skills.add(s));
      t.agents.forEach((a) => agents.add(a));
      t.mcps.forEach((m) => mcpNames.add(m));
    }

    return {
      skills: [...skills].sort(),
      agents: [...agents].sort(),
      mcps: [...mcpNames].sort().map((name) => ({ name })),
    };
  } catch (err) {
    // Per the contract: never throw. The generator works without suggestions.
    console.warn("[metaharness-adapter] recommendForPurpose failed:", err);
    return { skills: [], mcps: [], agents: [] };
  }
}
