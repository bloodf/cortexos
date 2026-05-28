# 70 - Dashboard

The dashboard is the LAN/tailnet control console for the rebuilt host.

Required surfaces:

- Host service catalog from rebuild migrations.
- Protected Hermes visibility.
- Incus/project visibility.
- Root-helper command execution with audit metadata.
- Monitoring and backup evidence.

Validation:

```bash
pnpm --dir packages/cortex-dashboard test
pnpm --dir packages/cortex-dashboard run build:next
```
