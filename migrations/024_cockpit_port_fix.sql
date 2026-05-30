-- Fix cockpit health_url port: 9093 was a reconciliation guess.
-- Live host moved Cockpit off :9090 (Prometheus owns 127.0.0.1:9090) onto
-- 127.0.0.1:9091 via /etc/systemd/system/cockpit.socket.d/listen.conf.
-- See docs/rebuild/RECONCILIATION.md C2.

UPDATE services
   SET health_url = 'tcp://127.0.0.1:9091', updated_at = NOW()
 WHERE slug = 'cockpit' AND health_url = 'tcp://127.0.0.1:9093';

INSERT INTO migrations (name) VALUES ('024_cockpit_port_fix')
ON CONFLICT (name) DO NOTHING;
