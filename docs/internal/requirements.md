# Requirements

Canonical requirements are now maintained in `PLAN.md` and
`manifests/rebuild/`.

Hard requirements:

- Ubuntu version matches the current host.
- Full backup and restore verification precede destructive cleanup.
- Protected Hermes profiles remain host-resident.
- Incus project instances are unprivileged by default.
- Secrets stay out of git; the repo tracks manifests and validation rules only.
