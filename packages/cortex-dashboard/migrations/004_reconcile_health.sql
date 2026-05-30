-- Migration 004: Reconcile service health checks to deployed reality.
--
-- Several seeded services were shown as permanently OFFLINE because their
-- health check targeted 127.0.0.1 on a port that is actually bound to the
-- host's Tailscale interface, or targeted a port/endpoint
-- that the service no longer exposes on the host net namespace. The dashboard
-- runs the checks from the host process, so a localhost HTTP/TCP probe to a
-- service that binds a different interface (or runs only inside a container)
-- reads as offline even though the service is healthy.
--
-- Fix strategy (host-agnostic, same pattern as 3e2f0a8 "reconcile to deployed
-- reality"): switch each affected service to the check type that reflects how
-- it is actually deployed:
--   * native systemd services  -> health_type='systemd', health_url=<unit>
--   * containerized services    -> health_type='docker',  health_url=<container name>
--   * services not deployed here -> is_active=false (mirrors the cadvisor precedent)
--
-- All statements are idempotent (UPDATE ... WHERE slug=...), so re-applying or
-- running against a fresh seed is safe.

-- Caddy: binds the Tailscale interface :443, not 127.0.0.1:80. Native systemd unit.
UPDATE services
   SET health_type = 'systemd', health_url = 'caddy', updated_at = NOW()
 WHERE slug = 'caddy';

-- Webmin: binds the Tailscale interface :10000, not 127.0.0.1. Native systemd unit.
UPDATE services
   SET health_type = 'systemd', health_url = 'webmin', updated_at = NOW()
 WHERE slug = 'webmin';

-- Prometheus: binds the Tailscale interface :9090, not 127.0.0.1. Runs as the
-- cortex-prometheus container -> use a docker liveness check.
UPDATE services
   SET health_type = 'docker', health_url = 'cortex-prometheus', updated_at = NOW()
 WHERE slug = 'prometheus';

-- Kernel Browser: 9222 is not published on the host net namespace; the
-- cortex-kernel-browser container is the source of truth.
UPDATE services
   SET health_type = 'docker', health_url = 'cortex-kernel-browser', updated_at = NOW()
 WHERE slug = 'kernel-browser';

-- Cockpit: socket-activated (cockpit.socket is active) rather than a long-running
-- listener, so a TCP probe to :9091 is unreliable. Use the systemd socket unit.
UPDATE services
   SET health_type = 'systemd', health_url = 'cockpit.socket', updated_at = NOW()
 WHERE slug = 'cockpit';

-- Hermes Dashboard: retired (nothing listening on :9119, no container). Deactivate
-- so it is not surfaced as a hard failure; re-enable + re-point if reintroduced.
UPDATE services
   SET is_active = false, updated_at = NOW()
 WHERE slug = 'hermes-dashboard';

-- NOTE: intentionally NO self-record here. The migration runner
-- (src/lib/db/migrate.ts) records the filename itself after executing the file,
-- and adding our own INSERT would risk a UNIQUE violation against migrations.name.
-- All statements above are idempotent, so re-running is harmless even if a
-- psql-loop runner (which does not record) applies this file repeatedly.
