-- LangGraph Postgres checkpointer tables.
--
-- Owned by the V7 cortex-graph sidecar (stacks/cortex-graph). The Python
-- `langgraph-checkpoint-postgres` library calls `AsyncPostgresSaver.setup()`
-- at boot which creates these tables itself, but pre-provisioning them in
-- the dashboard migration pipeline gives operators:
--   1. A canonical schema reviewable in Git.
--   2. A deterministic upgrade path (no race between sidecar boot and
--      first run when the schema is empty).
--   3. A clean rollback path via the matching `.rollback.sql`.
--
-- Column types mirror upstream `langgraph-checkpoint-postgres` >= 2.0.
-- Operator note: when upgrading the python package, re-run setup() in a
-- staging environment first — schema drift here is the only break path.

CREATE TABLE IF NOT EXISTS checkpoint_migrations (
  v INTEGER PRIMARY KEY
);

CREATE TABLE IF NOT EXISTS checkpoints (
  thread_id           TEXT NOT NULL,
  checkpoint_ns       TEXT NOT NULL DEFAULT '',
  checkpoint_id       TEXT NOT NULL,
  parent_checkpoint_id TEXT,
  type                TEXT,
  checkpoint          JSONB NOT NULL,
  metadata            JSONB NOT NULL DEFAULT '{}'::jsonb,
  PRIMARY KEY (thread_id, checkpoint_ns, checkpoint_id)
);

CREATE TABLE IF NOT EXISTS checkpoint_blobs (
  thread_id     TEXT NOT NULL,
  checkpoint_ns TEXT NOT NULL DEFAULT '',
  channel       TEXT NOT NULL,
  version       TEXT NOT NULL,
  type          TEXT NOT NULL,
  blob          BYTEA,
  PRIMARY KEY (thread_id, checkpoint_ns, channel, version)
);

CREATE TABLE IF NOT EXISTS checkpoint_writes (
  thread_id     TEXT NOT NULL,
  checkpoint_ns TEXT NOT NULL DEFAULT '',
  checkpoint_id TEXT NOT NULL,
  task_id       TEXT NOT NULL,
  idx           INTEGER NOT NULL,
  channel       TEXT NOT NULL,
  type          TEXT,
  blob          BYTEA NOT NULL,
  task_path     TEXT NOT NULL DEFAULT '',
  PRIMARY KEY (thread_id, checkpoint_ns, checkpoint_id, task_id, idx)
);

CREATE INDEX IF NOT EXISTS idx_checkpoints_thread
  ON checkpoints (thread_id);

CREATE INDEX IF NOT EXISTS idx_checkpoint_writes_thread
  ON checkpoint_writes (thread_id, checkpoint_id);

INSERT INTO migrations (name) VALUES ('007_langgraph_checkpoints') ON CONFLICT DO NOTHING;
