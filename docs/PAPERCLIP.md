# Paperclip

Paperclip is the only agent workflow layer in CortexOS.

Execution path:

```text
Paperclip run → hermes-paperclip-adapter → Hermes profile → Honcho memory
```

The dashboard tracks Paperclip runs in `paperclip_ticket_link` with
`adapter_ref` values such as `hermes:primary` or `hermes:secondary`.
