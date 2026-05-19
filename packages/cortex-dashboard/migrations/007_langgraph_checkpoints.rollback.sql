-- Rollback for 007_langgraph_checkpoints.
-- Drops indexes first, then tables in reverse FK-free order.
-- Operator warning: this destroys all resumable LangGraph run state. Run
-- only when the cortex-graph sidecar is stopped and no in-flight runs
-- need to resume.

DROP INDEX IF EXISTS idx_checkpoint_writes_thread;
DROP INDEX IF EXISTS idx_checkpoints_thread;

DROP TABLE IF EXISTS checkpoint_writes;
DROP TABLE IF EXISTS checkpoint_blobs;
DROP TABLE IF EXISTS checkpoints;
DROP TABLE IF EXISTS checkpoint_migrations;

DELETE FROM migrations WHERE name = '007_langgraph_checkpoints';
