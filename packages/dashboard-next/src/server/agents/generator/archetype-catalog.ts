/**
 * Archetype catalog for the Agent Generator.
 *
 * Archetypes are starting points the interview offers the operator. They are
 * NOT a separate runtime concept — each just seeds a normal ProfileSpec (a
 * persona hint, suggested channels/skills/integrations and a default model
 * tier) that the interview then refines. The coding-/business-oriented
 * "verticals" live in recommendation-catalog.ts (vendored from MetaHarness);
 * this file adds the day-to-day, personal, and non-code-work archetypes.
 */

export interface Archetype {
  id: string;
  name: string;
  /** "personal" | "work" | "wellbeing" | "coding" (coding handled elsewhere). */
  category: "personal" | "work" | "wellbeing";
  desc: string;
  /** One-line persona seed folded into the agent's description. */
  persona: string;
  /** Suggested integration ids (see integration-catalog.ts). */
  integrations: string[];
  /** Suggested channels. */
  channels: string[];
  /** Suggested skills. */
  skills: string[];
}

export const ARCHETYPE_CATALOG: readonly Archetype[] = [
  {
    id: "personal-assistant",
    name: "Personal Assistant",
    category: "personal",
    desc: "Email triage, scheduling, reminders and everyday follow-ups.",
    persona: "A proactive personal assistant that keeps the operator's day organized.",
    integrations: ["gsuite", "ms365"],
    channels: ["telegram", "whatsapp"],
    skills: [],
  },
  {
    id: "planner",
    name: "Day / Week Planner",
    category: "personal",
    desc: "Time-blocking, calendar planning and gentle schedule nudges.",
    persona: "A planning partner that turns goals into a realistic, time-blocked schedule.",
    integrations: ["gsuite", "ms365"],
    channels: ["telegram"],
    skills: [],
  },
  {
    id: "finance-audit",
    name: "Personal Finance Auditor",
    category: "personal",
    desc: "Track spending, audit budgets and flag unusual transactions.",
    persona: "A careful finance auditor that reviews spending and explains the numbers plainly.",
    integrations: ["gsuite"],
    channels: ["telegram"],
    skills: [],
  },
  {
    id: "life-admin",
    name: "Life Admin",
    category: "personal",
    desc: "Bills, appointments, paperwork and recurring chores.",
    persona: "A reliable life-admin helper that never lets a bill or appointment slip.",
    integrations: ["gsuite", "ms365"],
    channels: ["telegram", "whatsapp"],
    skills: [],
  },
  {
    id: "adhd-helper",
    name: "ADHD Focus Coach",
    category: "wellbeing",
    desc: "Task breakdown, body-doubling, gentle reminders and momentum.",
    persona:
      "A patient ADHD coach that breaks work into tiny steps and keeps momentum without shame.",
    integrations: [],
    channels: ["telegram", "whatsapp"],
    skills: [],
  },
  {
    id: "wellness-coach",
    name: "Wellness & Habit Coach",
    category: "wellbeing",
    desc: "Habits, routines, mood check-ins and accountability.",
    persona: "A supportive wellness coach that helps build sustainable habits.",
    integrations: [],
    channels: ["telegram", "whatsapp"],
    skills: [],
  },
  {
    id: "problem-helper",
    name: "Personal Problem Helper",
    category: "wellbeing",
    desc: "Talk through personal problems and turn them into practical next steps.",
    persona:
      "A calm, non-judgmental sounding board that helps think problems through and find concrete next steps. Not a substitute for professional help.",
    integrations: [],
    channels: ["telegram", "whatsapp", "signal"],
    skills: [],
  },
  {
    id: "work-assistant",
    name: "Work Assistant (non-code)",
    category: "work",
    desc: "Meetings, notes, docs, summaries and follow-ups for knowledge work.",
    persona: "A sharp work assistant that prepares meetings, captures notes and chases follow-ups.",
    integrations: ["gsuite", "ms365", "slack", "notion"],
    channels: ["slack", "telegram"],
    skills: [],
  },
  {
    id: "study-buddy",
    name: "Study / Learning Companion",
    category: "personal",
    desc: "Explanations, spaced-repetition prompts and study planning.",
    persona: "An encouraging tutor that explains clearly and plans study sessions.",
    integrations: ["gsuite"],
    channels: ["telegram"],
    skills: [],
  },
  {
    id: "research-assistant",
    name: "Personal Research Assistant",
    category: "work",
    desc: "Web research, source-gathering and plain-language summaries.",
    persona:
      "A diligent researcher that gathers sources and summarizes them honestly with citations.",
    integrations: ["web"],
    channels: ["telegram"],
    skills: [],
  },
];

const BY_ID = new Map(ARCHETYPE_CATALOG.map((a) => [a.id, a]));

export function getArchetype(id: string): Archetype | undefined {
  return BY_ID.get(id);
}
