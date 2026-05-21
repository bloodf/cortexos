# Architecture

```text
Dashboard ── service catalog / approvals / health
Paperclip ── workflow, budgets, approvals
Hermes Paperclip adapter ── direct execution bridge
Hermes profiles ── project-specific agents
Honcho ── memory and knowledge
9Router ── model gateway
Langfuse ── traces
```

Each project gets its own Hermes profile. Primary and Secondary are the first
profiles; Secondary uses `cx/gpt-5.5` with medium reasoning.
