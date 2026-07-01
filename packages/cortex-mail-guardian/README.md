# Cortex Mail Guardian

Cortex-owned IMAP spam guardian. It watches configured inboxes, classifies new
messages through an OpenAI-compatible chat endpoint, moves high-confidence spam
to Trash, and asks the owner through the Cortex Telegram bot when confidence is
not high enough.

Passwords are loaded from base64-encoded environment variables so shell env
parsing is safe. Base64 is encoding, not encryption; keep the env file mode
`0600`.

## Commands

```bash
cortex-mail-guardian smoke
cortex-mail-guardian sweep
cortex-mail-guardian listen
cortex-mail-guardian telegram-discover-owner
```

`listen` starts IMAP IDLE loops and Telegram callback polling. `sweep` performs
a one-shot reconciliation pass for missed messages.
