# Security

CortexOS is Tailscale-first. Dashboard, Hermes, Honcho, Paperclip, and Langfuse
should be reachable only through authenticated tailnet routes or loopback.

Controls:

- secrets live in `/opt/cortexos/.secrets/` with mode `0600`
- dashboard env browsing is allowlisted
- Paperclip webhook secrets and Hermes API keys are rotated through SOPS
- approval actions are recorded in the dashboard audit log
- sandbox execution is isolated from the agent workflow path

Retired agent communication services must not be exposed or restarted.
