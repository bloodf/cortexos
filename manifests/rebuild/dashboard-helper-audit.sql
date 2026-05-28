-- Audit schema for the trusted Cortex Dashboard root helper.
-- Secret values and command stdout/stderr bodies are not stored here by default.

create table if not exists dashboard_command_audit (
  id bigserial primary key,
  request_id uuid not null,
  requested_at timestamptz not null default now(),
  started_at timestamptz,
  finished_at timestamptz,
  requested_by text not null default 'trusted-dashboard',
  source_ip inet,
  source_user_agent text,
  dashboard_session_id text,
  command text not null,
  argv jsonb not null default '[]'::jsonb,
  cwd text,
  env_allowlist jsonb not null default '{}'::jsonb,
  stdin_sha256 text,
  stdout_sha256 text,
  stderr_sha256 text,
  stdout_bytes bigint not null default 0,
  stderr_bytes bigint not null default 0,
  exit_code integer,
  signal text,
  timeout_ms integer,
  approved_policy text not null default 'trusted-lan-tailnet',
  mutation_class text not null default 'unknown',
  target_scope text not null default 'host',
  dry_run boolean not null default false,
  status text not null default 'created',
  error text,
  journald_cursor text,
  metadata jsonb not null default '{}'::jsonb
);

create index if not exists dashboard_command_audit_requested_at_idx
  on dashboard_command_audit (requested_at desc);

create index if not exists dashboard_command_audit_request_id_idx
  on dashboard_command_audit (request_id);

create index if not exists dashboard_command_audit_status_idx
  on dashboard_command_audit (status);
