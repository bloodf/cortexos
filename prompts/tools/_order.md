# Tool Prompt Order

## Chat Input Gate

This prompt follows `prompts/CHAT-INPUT-CONTRACT.md` and the prompt skeleton in `docs/SCRIPT-PROMPT-POLICY.md`. Ask required operator-specific values through a **STOP — input question** before emitting commands that use them.

This is the canonical linear order for reproducing a CortexOS machine.
Optional prompts are listed separately and should only run when that service is
wanted on the target.

## Core

1. `00-preflight.md`
2. `10-os-hardening.md`
3. `09-homebrew.md`
4. `11-docker.md`
5. `12-tailscale.md`
6. `12a-sops-bootstrap.md`
7. `13-tailscale-serve.md`
8. `14-postgresql.md`
9. `15-redis.md`
10. `17-dnsmasq.md`
11. `18-fail2ban.md`
12. `20-prometheus.md`
13. `21-loki.md`
14. `22-grafana.md`
15. `23-fluent-bit.md`
16. `24-cadvisor.md`
17. `25-node-exporter.md`
18. `26-cockpit.md`
19. `26a-otel-collector.md`
20. `26b-webmin.md`
21. `27-dockhand.md`
22. `28-floci.md`
23. `31-9router.md`
24. `32-honcho.md`
25. `34-kernel-browser.md`
26. `40-hermes.md`
27. `41-hermes-profiles.md`
28. `42-hermes-honcho.md`
29. `42a-hermes-mcp.md`
30. `43-paperclip-hermes.md`
31. `44-api-exposure.md`
32. `47a-cortex-sandbox.md`
33. `49-memory-import-prep.md`
34. `55-langfuse.md`
35. `62-paperclip.md`
36. `70-dashboard.md`
37. `80-agent-factory.md`
38. `99-final-validation.md`

## Optional

- `14a-home-assistant.md`
- `14b-jellyfin.md`
- `16-mongodb.md`
- `16a-mysql.md`
- `56-pgadmin.md`
- `57-redisinsight.md`
- `58-mongo-express.md`
- `59-phpmyadmin.md`
- `81-projects.md` (only when onboarding a private project after the base
  machine is healthy)
- `82-mail-guardian.md`

## Rules

- Run prompts from `/opt/cortexos`.
- Every prompt is chat-driven: ask the operator for required values and wait
  before generating commands that use them.
- Do not require env variables to be defined before a prompt starts.
- Keep secrets in `/opt/cortexos/.secrets`.
- Keep dashboard seeds generic.
- Use 9Router for all model calls.
- Use Paperclip as the only workflow surface.
