# Book Writing Agent Workflow

## Purpose

Coordinate a multi-agent editorial pipeline for books, guides, courses, or long-form documentation. The workflow separates drafting, editing, reviewing, scoring, and translation so each stage has a clear owner and quality bar.

## Required Agents

- `book-author` from `templates/agent-roles/BOOK-AUTHOR.md`
- `book-editor` from `templates/agent-roles/BOOK-EDITOR.md`
- `book-reviewer` from `templates/agent-roles/BOOK-REVIEWER.md`
- `book-evaluator` from `templates/agent-roles/BOOK-EVALUATOR.md`
- `book-translator` from `templates/agent-roles/BOOK-TRANSLATOR.md`
- PM agent for human decisions and scope control

## Chapter Pipeline

1. `chapter:draft` — author creates or revises the chapter draft.
2. `chapter:edit` — editor improves structure, voice, clarity, and continuity.
3. `chapter:review` — reviewer checks correctness, reader value, and acceptance criteria.
4. `chapter:evaluate` — evaluator scores the chapter against the rubric.
5. `chapter:translate` — translator localizes approved chapters when required.
6. `chapter:done` — PM or lead editor closes the chapter after final checks.

## Editorial Gates

- A draft cannot move to review until the editor posts a summary of structural changes.
- A review BLOCK returns to `chapter:edit` with required fixes.
- Evaluation blocks if trust, continuity, or promise-fit scores are below threshold.
- Human review is required before publication or major thesis changes.

## Translation Gates

- Translate only chapters that passed evaluation.
- Preserve markdown structure and glossary terms.
- Reviewer approval is required for sensitive or high-risk translation domains.

## GitHub Issue Labels

- `chapter:draft`
- `chapter:edit`
- `chapter:review`
- `chapter:evaluate`
- `chapter:translate`
- `chapter:done`
- `agent:book-author`
- `agent:book-editor`
- `agent:book-reviewer`
- `agent:book-evaluator`
- `agent:book-translator`
- `needs-clarification`

## Human Review Points

Ask PM/human when:

- The outline conflicts with the draft.
- A chapter changes the book thesis.
- A factual claim cannot be verified.
- Cultural localization requires judgment.
- The evaluator and reviewer disagree on pass/block.

## Copy Checklist

- [ ] Role files copied into each agent workspace
- [ ] Routing table installed
- [ ] Quality gates documented in the repo
- [ ] GitHub labels created
- [ ] PM escalation works with `@pm`
- [ ] Style guide and glossary available to all agents
- [ ] At least one chapter smoke test completed
