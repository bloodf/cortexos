<!-- Snapshot of upstream openclaw-codex-watchdog at probe time. NOT a version pin. Operator reinstalls latest upstream on each fresh install. -->

Source: https://raw.githubusercontent.com/ThisIsJeron/openclaw-codex-watchdog/main/README.md
Snapshot UTC: 2026-05-19T04:38:27Z

# openclaw-codex-watchdog

> Status: monitoring mode. This watchdog was built for an OpenClaw instance where `openai-codex/gpt-5.4` sometimes produced text-only "work happened" replies. With GPT-5.5 behavior improving, this repo is likely to become deprecated if the watchdog is no longer needed.

A small OpenClaw plugin that blocks Codex narrative-loop replies when a run looks action-oriented but the model makes zero tool calls.

## What it does

If a Codex run:

- uses `openai-codex/gpt-5.3-codex` or `openai-codex/gpt-5.4`
- looks like the user asked for an action
- makes zero tool calls
- returns text that sounds like fake progress or completion

then the plugin blocks that reply and replaces it with an honest watchdog message.

## Why

Sometimes Codex returns text like "I'll do that" or "done" without actually using tools or performing work. This plugin is a first-pass guardrail against that failure mode.

GPT-5.5 may have improved this behavior enough that the guardrail can be removed. For now, keep this plugin enabled only where monitoring shows the older failure mode still matters.

## Install

Add the plugin path to your OpenClaw config, for example:

```json
{
  "plugins": {
    "load": {
      "paths": [
        "/path/to/openclaw-codex-watchdog"
      ]
    },
    "entries": {
      "openclaw-codex-watchdog": {
        "enabled": true
      }
    }
  }
}
```

If you use a restrictive `plugins.allow` list, include `discord` and any other bundled plugins you still want, plus this plugin if needed by your setup.

## Files

- `openclaw.plugin.json` - plugin manifest
- `dist/index.js` - plugin entry

## Status

Monitoring mode; likely to be deprecated if GPT-5.5 continues to reliably execute action-oriented requests with tool calls.

This is an early, practical first pass. It is intentionally simple and focused on blocking obviously fake "work happened" replies for affected older Codex model routes.
