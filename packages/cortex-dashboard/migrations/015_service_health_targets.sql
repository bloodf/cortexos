-- 015_service_health_targets.sql
-- Align dashboard health probes with the services installed by the current
-- prompts. The dashboard runs in a container, so host-local TCP/HTTP targets use
-- 127.0.0.1; systemd-only services use the process checker.

UPDATE services
   SET health_url = 'http://127.0.0.1:11434/v1/models',
       health_type = 'http',
       updated_at = NOW()
 WHERE slug = '9router';

UPDATE services
   SET health_url = 'openviking',
       health_type = 'process',
       updated_at = NOW()
 WHERE slug = 'openviking';

UPDATE services
   SET health_url = 'http://127.0.0.1:18789/health',
       health_type = 'http',
       updated_at = NOW()
 WHERE slug = 'openclaw';

UPDATE services
   SET health_url = 'http://127.0.0.1:18800/health',
       health_type = 'http',
       updated_at = NOW()
 WHERE slug = 'agentgateway';

UPDATE services
   SET health_url = 'kernel-browser-kernel-browser-1',
       health_type = 'docker',
       updated_at = NOW()
 WHERE slug = 'kernel-browser';

UPDATE services
   SET health_url = 'http://127.0.0.1:8090/healthz',
       health_type = 'http',
       updated_at = NOW()
 WHERE slug = 'cortex-graph';

UPDATE services
   SET health_url = 'http://127.0.0.1:8091/healthz',
       health_type = 'http',
       updated_at = NOW()
 WHERE slug = 'cortex-sandbox-runner';

UPDATE services
   SET health_url = 'cortex-consumer.service',
       health_type = 'systemd',
       updated_at = NOW()
 WHERE slug = 'cortex-consumer';


UPDATE services
   SET health_url = 'http://127.0.0.1:8222/healthz',
       health_type = 'http',
       updated_at = NOW()
 WHERE slug IN ('nats', 'nats-monitor');

UPDATE services
   SET health_url = 'tcp://127.0.0.1:5432',
       health_type = 'tcp',
       updated_at = NOW()
 WHERE slug = 'postgresql';

UPDATE services
   SET health_url = 'tcp://127.0.0.1:6379',
       health_type = 'tcp',
       updated_at = NOW()
 WHERE slug = 'redis';


UPDATE services
   SET health_url = 'tcp://127.0.0.1:8080',
       health_type = 'tcp',
       updated_at = NOW()
 WHERE slug = 'caddy';

UPDATE services
   SET health_url = 'http://127.0.0.1:3080/en/login',
       health_type = 'http',
       updated_at = NOW()
 WHERE slug = 'cortex-dashboard';

UPDATE services
   SET health_url = 'http://127.0.0.1:3000/api/health',
       health_type = 'http',
       updated_at = NOW()
 WHERE slug = 'grafana';

UPDATE services
   SET health_url = 'http://127.0.0.1:9090/prometheus/-/healthy',
       health_type = 'http',
       updated_at = NOW()
 WHERE slug = 'prometheus';

UPDATE services
   SET health_url = 'http://127.0.0.1:3100/ready',
       health_type = 'http',
       updated_at = NOW()
 WHERE slug = 'loki';

UPDATE services
   SET health_url = 'monitoring-fluent-bit-1',
       health_type = 'docker',
       updated_at = NOW()
 WHERE slug = 'fluent-bit';

UPDATE services
   SET health_url = 'http://127.0.0.1:8081/cadvisor/healthz',
       health_type = 'http',
       updated_at = NOW()
 WHERE slug = 'cadvisor';

UPDATE services
   SET health_url = 'http://127.0.0.1:9100/metrics',
       health_type = 'http',
       updated_at = NOW()
 WHERE slug = 'node-exporter';

UPDATE services
   SET health_url = 'http://127.0.0.1:3001/api/public/health',
       health_type = 'http',
       updated_at = NOW()
 WHERE slug = 'langfuse';

INSERT INTO migrations (name) VALUES ('015_service_health_targets')
ON CONFLICT (name) DO NOTHING;
