# CortexOS Rebuild Manifests

These files are the machine-readable source of truth for the CortexOS rebuild.
They intentionally contain decisions and identifiers, not secret values.

The Bash tools under `scripts/rebuild/` read these manifests.

## Files

- `service-placement.tsv` - target location/runtime for each known service.
- `retired-systems.txt` - systems that must be removed after backup and gates.
- `protected-hermes.txt` - Hermes profiles that must remain host-resident.
- `projects.tsv` - first Incus project instances and migration policy.
- `backup-scope.tsv` - backup/export targets and validation expectations.
- `secrets.manifest.tsv` - expected secret file categories without values.
- `validation-gates.tsv` - phase gates that must pass before progression.
- `mcp-global-allowlist.txt` - global MCP proxy allowlist.
- `tmux-plugins.txt` - tmux plugin set for the host and Incus base image.
- `tmux-session-model.tsv` - expected tmux session boundaries.
- `incus-base-image.tsv` - reusable Incus image component manifest.
- `dashboard-helper-audit.sql` - root helper audit table schema.
- `dashboard-helper-log-format.json` - root helper command log contract.
- `runtime-retired.tsv` - live host units/stacks/paths to remove after backup.
- `runtime-protected.tsv` - live host identities and services not to touch.
