-- 018_service_catalog_webui_fixes.sql
-- Reconcile WebUI catalog entries with probed local services and Tailscale Serve ports.

UPDATE services
   SET health_type = 'http',
       health_url = 'http://127.0.0.1:3333/json/version',
       open_url = '#',
       has_webui = FALSE,
       show_in_webui = FALSE
 WHERE slug = 'kernel-browser';

UPDATE services
   SET health_type = 'http',
       health_url = 'http://127.0.0.1:8090/healthz',
       open_url = 'https://cortexos.tailfd052e.ts.net:8090/docs',
       has_webui = TRUE,
       show_in_webui = TRUE
 WHERE slug = 'cortex-graph';

UPDATE services
   SET health_type = 'http',
       health_url = 'http://127.0.0.1:3100/ready',
       open_url = 'https://cortexos.tailfd052e.ts.net:3100/ready',
       has_webui = TRUE,
       show_in_webui = TRUE
 WHERE slug = 'loki';

UPDATE services SET health_type = 'docker', health_url = 'cortex-fluent-bit' WHERE slug = 'fluent-bit';
UPDATE services SET health_type = 'docker', health_url = 'cortex-mongo-express', has_webui = TRUE, show_in_webui = TRUE WHERE slug = 'mongo-express';
UPDATE services SET health_type = 'docker', health_url = 'cortex-phpmyadmin', has_webui = TRUE, show_in_webui = TRUE WHERE slug = 'phpmyadmin';
UPDATE services SET health_type = 'docker', health_url = 'cortex-mongodb' WHERE slug = 'mongodb';
UPDATE services SET health_type = 'docker', health_url = 'cortex-mysql' WHERE slug = 'mysql';
UPDATE services SET health_type = 'docker', health_url = 'cortex-watchtower' WHERE slug = 'watchtower';

UPDATE services SET open_url = 'https://cortexos.tailfd052e.ts.net:5050/' WHERE slug = 'pgadmin';
UPDATE services SET open_url = 'https://cortexos.tailfd052e.ts.net:5540/' WHERE slug = 'redisinsight';
UPDATE services SET open_url = 'https://cortexos.tailfd052e.ts.net:8083/' WHERE slug = 'mongo-express';
UPDATE services SET open_url = 'https://cortexos.tailfd052e.ts.net:8082/' WHERE slug = 'phpmyadmin';
UPDATE services SET open_url = 'https://cortexos.tailfd052e.ts.net:3001/' WHERE slug = 'langfuse';

INSERT INTO migrations (name) VALUES
  ('018_service_catalog_webui_fixes'),
  ('028_service_catalog_webui_fixes')
ON CONFLICT (name) DO NOTHING;
