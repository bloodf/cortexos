# Setup Guide

Use this order:

1. Paste [AI-INSTALLER-PROMPT.md](AI-INSTALLER-PROMPT.md) into the AI agent
   that will run the install.
2. Read [AI-REPLICATION.md](AI-REPLICATION.md).
3. Run [../prompts/00-bootstrap.md](../prompts/00-bootstrap.md).
4. Follow [../prompts/tools/_order.md](../prompts/tools/_order.md).
5. Run [../prompts/tools/99-final-validation.md](../prompts/tools/99-final-validation.md).

The only active agent path is:

```text
Paperclip -> Hermes profile -> 9Router -> model
                         |
                         -> Honcho memory
```

Model calls go through 9Router. Do not install retired workflow services or
custom orchestration sidecars.
