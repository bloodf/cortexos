# Services

Service placement is declared in `manifests/rebuild/service-placement.tsv`.

The dashboard catalog is seeded from
`packages/cortex-dashboard/migrations/002_seed.sql` and cleaned for upgraded
databases by `017_retired_infra_cleanup.sql`.

Project workloads belong in Incus instances unless `PLAN.md` explicitly says a
service is part of the host control/data plane.
