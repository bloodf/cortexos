-- Rollback 024_cockpit_port_fix: restore cockpit health_url to the prior guess.
UPDATE services
   SET health_url = 'tcp://127.0.0.1:9093', updated_at = NOW()
 WHERE slug = 'cockpit' AND health_url = 'tcp://127.0.0.1:9091';

DELETE FROM migrations WHERE name = '024_cockpit_port_fix';
