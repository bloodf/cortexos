-- Remove catalog/schema residue from the pre-rebuild orchestration stack on
-- existing dashboard databases. Fresh databases do not create these rows or
-- tables anymore; this migration keeps upgraded databases aligned.

DELETE FROM service_badges
WHERE service_id IN (
  SELECT id FROM services
   WHERE slug IN (
     'paperclip','nats','nats-monitor','openviking','leann','openclaw',
     'cortex-consumer','cortex-graph','floci','langfuse','opik'
   )
);

DELETE FROM services
 WHERE slug IN (
   'paperclip','nats','nats-monitor','openviking','leann','openclaw',
   'cortex-consumer','cortex-graph','floci','langfuse','opik'
 );

DROP TABLE IF EXISTS agent_factories;
DROP TABLE IF EXISTS langgraph_checkpoints;
DROP TABLE IF EXISTS paperclip_ticket_link;

INSERT INTO migrations (name) VALUES ('017_retired_infra_cleanup')
ON CONFLICT (name) DO NOTHING;
