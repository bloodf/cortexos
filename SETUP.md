# Setup

The old spoke setup flow and the rebuild flow have both been replaced by the
chat-driven installer prompts under `prompts/tools/`.

## Quick Start

1. Run the preflight: `prompts/tools/00-preflight.md`
2. Follow the canonical order: `prompts/tools/_order.md`
3. Run prompts top-to-bottom; each prompt stops at `CHECKPOINT` questions.

Backups and restore verification must complete before any destructive host cleanup.
