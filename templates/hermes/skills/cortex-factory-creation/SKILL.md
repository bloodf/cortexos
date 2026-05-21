---
name: cortex-factory-creation
description: Create or update CortexOS agent factories from operator requests. Use when Cortex is asked to create a new project factory, spawn project agents, define roles, choose Hermes profiles, wire Paperclip-backed factory agents, or reason through the questions needed before factory creation.
---

# Cortex Factory Creation

Use this skill when the operator asks Cortex to create a project, spawn a team,
add agents, or set up a factory.

## Core Rule

Cortex is standalone and is not a Paperclip agent. Only agents created by a
factory use Paperclip. Factory agents execute through Paperclip -> Hermes ->
Honcho.

## Intake Questions

Ask only for missing information that blocks a correct factory. Prefer a short
numbered list.

Required:

1. Project name and slug.
2. Project purpose and first useful outcome.
3. Source workspace or repository path, if code exists.
4. Agent roles needed now.
5. Whether agents should run on schedules, on demand, or both.
6. Required integrations, messaging channels, and delivery targets.
7. Memory scope: new Honcho workspace or existing workspace to reuse.
8. Risk level: can agents change files/services, or should they only report?
9. Acceptance test for the initial factory smoke.

Optional:

- Budget or cost limits per role.
- Model/reasoning overrides. Default to `cx/gpt-5.5` medium through 9Router.
- Human approval rules for destructive actions.
- Secrets required by integrations. Never ask the operator to paste secrets into
  public chat if a secure env/SOPS path is available.

## Reasoning Workflow

1. Classify the request:
   - New project factory.
   - Add roles to an existing factory.
   - Change schedules or permissions.
   - Repair a factory pipeline.
2. Identify whether the work belongs in Paperclip:
   - Factory-created project agents: yes.
   - Cortex machine-owner behavior: no.
   - Standalone messaging bots such as community or religious-center bots: no,
     unless the operator explicitly asks for project agents behind them.
3. Choose the Hermes profile:
   - Reuse an existing project profile when the project already exists.
   - Create a new Hermes profile for a new independent project.
   - Keep standalone bot profiles marked `paperclip.enabled=false`.
4. Define roles with clear bosses, permissions, and schedule cadence.
5. Create or update dashboard factory state.
6. Register only factory-produced roles in Paperclip.
7. Run a smoke test:
   - Dashboard factory exists.
   - Hermes profile health is ok.
   - Paperclip agents exist only for factory roles.
   - A temporary assigned issue can run through Paperclip -> Hermes -> Honcho.
   - Temporary smoke artifacts are cleaned up.

## Output Contract

When proposing a factory, answer with:

- Factory slug.
- Hermes profile and Honcho workspace.
- Roles and reporting lines.
- Paperclip schedule for each factory agent.
- Required secrets/integrations.
- Smoke-test plan.
- Any missing operator decisions.

When implementing a factory, finish with:

- Files or runtime objects changed.
- Agents registered.
- Smoke results.
- Residual blockers.
