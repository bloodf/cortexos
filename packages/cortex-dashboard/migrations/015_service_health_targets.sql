-- Align dashboard health probes with the rebuild host catalog.

UPDATE services SET health_url = 'http://127.0.0.1:11434/v1/models', health_type = 'http', updated_at = NOW()
 WHERE slug = '9router';
UPDATE services SET health_url = 'http://127.0.0.1:11434/api/tags', health_type = 'http', updated_at = NOW()
 WHERE slug = 'ollama';
UPDATE services SET health_url = 'honcho', health_type = 'process', updated_at = NOW()
 WHERE slug = 'honcho';
UPDATE services SET health_url = 'honcho-mcp', health_type = 'process', updated_at = NOW()
 WHERE slug = 'honcho-mcp';
UPDATE services SET health_url = 'ollama-honcho-embeddings-proxy', health_type = 'process', updated_at = NOW()
 WHERE slug = 'ollama-honcho-embeddings-proxy';
UPDATE services SET health_url = 'http://127.0.0.1:8090/', health_type = 'http', updated_at = NOW()
 WHERE slug = 'obot';
UPDATE services SET health_url = 'http://127.0.0.1:9222/json/version', health_type = 'http', updated_at = NOW()
 WHERE slug = 'kernel-browser';
UPDATE services SET health_url = 'http://127.0.0.1:8091/healthz', health_type = 'http', updated_at = NOW()
 WHERE slug = 'cortex-sandbox-runner';

UPDATE services SET health_url = 'tcp://127.0.0.1:80', health_type = 'tcp', updated_at = NOW()
 WHERE slug = 'caddy';
UPDATE services SET health_url = 'tailscaled', health_type = 'process', updated_at = NOW()
 WHERE slug = 'tailscale';
UPDATE services SET health_url = 'incusd', health_type = 'process', updated_at = NOW()
 WHERE slug = 'incus';
UPDATE services SET health_url = 'http://127.0.0.1:3080/en/login', health_type = 'http', updated_at = NOW()
 WHERE slug = 'cortex-dashboard';
UPDATE services SET health_url = 'cortex-dashboard-root-helper.socket', health_type = 'systemd', updated_at = NOW()
 WHERE slug = 'cortex-dashboard-root-helper';

UPDATE services SET health_url = 'tcp://127.0.0.1:5432', health_type = 'tcp', updated_at = NOW()
 WHERE slug = 'postgresql';
UPDATE services SET health_url = 'tcp://127.0.0.1:3306', health_type = 'tcp', updated_at = NOW()
 WHERE slug = 'mysql';
UPDATE services SET health_url = 'tcp://127.0.0.1:6379', health_type = 'tcp', updated_at = NOW()
 WHERE slug = 'redis';
UPDATE services SET health_url = 'tcp://127.0.0.1:27017', health_type = 'tcp', updated_at = NOW()
 WHERE slug = 'mongodb';
-- minio and rabbitmq health targets removed (not deployed on host)

UPDATE services SET health_url = 'http://127.0.0.1:3000/api/health', health_type = 'http', updated_at = NOW()
 WHERE slug = 'grafana';
UPDATE services SET health_url = 'http://127.0.0.1:9090/-/healthy', health_type = 'http', updated_at = NOW()
 WHERE slug = 'prometheus';
UPDATE services SET health_url = 'http://127.0.0.1:3100/ready', health_type = 'http', updated_at = NOW()
 WHERE slug = 'loki';
UPDATE services SET health_url = 'http://127.0.0.1:9100/metrics', health_type = 'http', updated_at = NOW()
 WHERE slug = 'node-exporter';
UPDATE services SET health_url = 'http://127.0.0.1:8081/cadvisor/healthz', health_type = 'http', updated_at = NOW()
 WHERE slug = 'cadvisor';
UPDATE services SET health_url = 'http://127.0.0.1:8083', health_type = 'http', updated_at = NOW()
 WHERE slug = 'mongo-express';
UPDATE services SET health_url = 'http://127.0.0.1:9187/metrics', health_type = 'http', updated_at = NOW()
 WHERE slug = 'pg-exporter';
UPDATE services SET health_url = 'http://127.0.0.1:9104/metrics', health_type = 'http', updated_at = NOW()
 WHERE slug = 'mysql-exporter';
UPDATE services SET health_url = 'http://127.0.0.1:9121/metrics', health_type = 'http', updated_at = NOW()
 WHERE slug = 'redis-exporter';
UPDATE services SET health_url = 'http://127.0.0.1:9216/metrics', health_type = 'http', updated_at = NOW()
 WHERE slug = 'mongo-exporter';

INSERT INTO migrations (name) VALUES ('015_service_health_targets')
ON CONFLICT (name) DO NOTHING;
