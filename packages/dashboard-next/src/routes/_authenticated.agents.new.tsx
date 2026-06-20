import { createFileRoute } from "@tanstack/react-router";
import AgentGeneratorPage from "@/features/AgentGenerator";

export const Route = createFileRoute("/_authenticated/agents/new")({
  component: AgentGeneratorPage,
});
