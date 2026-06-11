# MP-024 — wire /backups and /scheduler to live data (currently MOCK)

Evidence: recon Q4 — both routes import "@/mocks/api" (static seed).

Tasks (kimi; one route at a time, each with its own commit):
1. /scheduler → LIVE: new server domain src/server/scheduler/ reading
   systemd timers (`systemctl list-timers --all --output=json` via the
   established host-exec pattern used by the systemd domain); server-fn
   listSchedulerJobs (GET, auth any, surface scheduler); route/feature
   consumes it (name, schedule, next run, last run, unit state). Mock
   import removed.
   Commit: feat(dashboard-next): /scheduler live from systemd timers (MP-024a)
2. /backups → LIVE: mini-recon FIRST (in-report): inspect what
   cortex-backup/cortex-auto-update write (journalctl -u cortex-backup,
   BACKUP_ROOT contents /mnt/hdd/backups, marker/log files) and quote.
   Then: server domain src/server/backups/ listing recent backup runs
   (timestamp, target, size, status) from the discovered source;
   server-fn + route wiring; mock import removed. If the backup state
   source is genuinely insufficient for a truthful page, IMPL-BLOCKED
   with the evidence and a proposal.
   Commit: feat(dashboard-next): /backups live from backup run state (MP-024b)
Gates per commit: tsc 0; suite zero failures (new tests for the new
repos/server-fns per the established node-env harness); build; screens.
