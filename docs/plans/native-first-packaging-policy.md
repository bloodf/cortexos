# Native-first packaging policy

CortexOS installs host applications natively under systemd by default. Docker is reserved for databases, database admin tools, isolation workloads, cAdvisor, kernel-browser, Watchtower, and Langfuse.

Native services use:

- source or build artifacts under `/opt/cortexos`;
- plaintext runtime env under `/opt/cortexos/.secrets/*.env`;
- systemd units from `templates/systemd/`;
- loopback-only listeners fronted by Caddy/Tailscale where a UI is needed.

Do not add Docker Compose as the primary deployment path for new non-isolation application services without updating this policy and `SETUP.md`.
