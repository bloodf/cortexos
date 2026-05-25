# Setup Guide

Use this order:

1. Read [AI-REPLICATION.md](AI-REPLICATION.md).
2. Run [../prompts/00-bootstrap.md](../prompts/00-bootstrap.md).
3. Follow [../prompts/tools/_order.md](../prompts/tools/_order.md).
4. Run [../prompts/tools/99-final-validation.md](../prompts/tools/99-final-validation.md).

The only active agent path is:

```text
Paperclip -> Hermes profile -> Honcho memory
```

Model calls go through 9Router. Do not install retired workflow services or
custom orchestration sidecars.
