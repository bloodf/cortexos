#!/usr/bin/env node
import { execFileSync } from "node:child_process";
import { createHash, randomBytes } from "node:crypto";
import { chmodSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";

const DEFAULT_DB_URL = "postgres://paperclip:paperclip@127.0.0.1:54329/paperclip";
const DEFAULT_PAPERCLIP_BIN = "/opt/cortexos/paperclip/runtime/node_modules/.bin/paperclipai";
const DEFAULT_PAPERCLIP_DATA_DIR = "/opt/cortexos/paperclip";
const DEFAULT_ORIGIN_ID = "employee-project-knowledge-bootstrap-v1";
const DEFAULT_FALLBACK_MODEL = "cx/gpt-5.5";

const args = parseArgs(process.argv.slice(2));
const apply = Boolean(args.apply);
const dbUrl = args.dbUrl || process.env.PAPERCLIP_DB_URL || process.env.DATABASE_URL || DEFAULT_DB_URL;
const originId = args.originId || DEFAULT_ORIGIN_ID;
const fallbackModel = args.fallbackModel || DEFAULT_FALLBACK_MODEL;
const paperclipBin = args.paperclipBin || process.env.PAPERCLIP_BIN || DEFAULT_PAPERCLIP_BIN;
const paperclipDataDir = args.paperclipDataDir || process.env.PAPERCLIP_DATA_DIR || DEFAULT_PAPERCLIP_DATA_DIR;
const agentKeysFile =
  args.agentKeysFile ||
  process.env.PAPERCLIP_AGENT_KEYS_FILE ||
  "/opt/cortexos/.secrets/paperclip-agent-runtime-keys.json";
const serviceName = args.serviceName || "paperclip.service";
const repairId = args.repairId || `paperclip-bootstrap-reconcile-${new Date().toISOString()}`;
const serviceControl = args.serviceControl === true;
const ensureAgentKeys = args.ensureAgentKeys !== false;

if (args.help) {
  printHelp();
  process.exit(0);
}

main().catch((error) => {
  console.error(`paperclip-reconcile-bootstrap-issues: ${error.message}`);
  if (error.stdout) console.error(String(error.stdout));
  if (error.stderr) console.error(String(error.stderr));
  process.exit(1);
});

async function main() {
  const before = loadReport();
  printReport(before, apply ? "pre-apply" : "dry-run");

  if (!apply) {
    console.log("\nDry run only. Re-run with --apply to write the repair.");
    return;
  }

  if (before.affected.length === 0 && !ensureAgentKeys) {
    console.log("\nNo affected bootstrap issues found. Nothing to repair.");
    return;
  }

  const backup = createBackup();
  console.log(`\nBackup created: ${backup}`);

  if (ensureAgentKeys) {
    const keySummary = ensureRuntimeAgentKeys();
    console.log("\nRuntime agent key summary:");
    console.log(JSON.stringify(keySummary, null, 2));
  }

  if (before.affected.length === 0) {
    console.log("\nNo affected bootstrap issues found. Runtime agent keys were checked.");
    return;
  }

  let shouldRestart = false;
  try {
    if (serviceControl) {
      shouldRestart = serviceIsActive(serviceName);
      if (shouldRestart) {
        console.log(`Stopping ${serviceName} while reconciling Paperclip state...`);
        systemctl(["stop", serviceName]);
      }
    }

    const result = applyRepair();
    console.log("\nRepair transaction result:");
    console.log(JSON.stringify(result, null, 2));
  } finally {
    if (serviceControl && shouldRestart) {
      console.log(`Starting ${serviceName}...`);
      systemctl(["start", serviceName]);
    }
  }

  const after = loadReport();
  printReport(after, "post-apply");
  assertClean(after);
  console.log("\nPaperclip bootstrap issue reconciliation completed.");
}

function parseArgs(argv) {
  const parsed = {};
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--") continue;
    if (arg === "--apply") parsed.apply = true;
    else if (arg === "--dry-run") parsed.apply = false;
    else if (arg === "--service-control") parsed.serviceControl = true;
    else if (arg === "--no-service-control") parsed.serviceControl = false;
    else if (arg === "--no-ensure-agent-keys") parsed.ensureAgentKeys = false;
    else if (arg === "--help" || arg === "-h") parsed.help = true;
    else if (arg.startsWith("--db-url=")) parsed.dbUrl = arg.slice("--db-url=".length);
    else if (arg === "--db-url") parsed.dbUrl = requireValue(argv, ++index, arg);
    else if (arg.startsWith("--origin-id=")) parsed.originId = arg.slice("--origin-id=".length);
    else if (arg === "--origin-id") parsed.originId = requireValue(argv, ++index, arg);
    else if (arg.startsWith("--fallback-model=")) parsed.fallbackModel = arg.slice("--fallback-model=".length);
    else if (arg === "--fallback-model") parsed.fallbackModel = requireValue(argv, ++index, arg);
    else if (arg.startsWith("--paperclip-bin=")) parsed.paperclipBin = arg.slice("--paperclip-bin=".length);
    else if (arg === "--paperclip-bin") parsed.paperclipBin = requireValue(argv, ++index, arg);
    else if (arg.startsWith("--paperclip-data-dir=")) {
      parsed.paperclipDataDir = arg.slice("--paperclip-data-dir=".length);
    } else if (arg === "--paperclip-data-dir") parsed.paperclipDataDir = requireValue(argv, ++index, arg);
    else if (arg.startsWith("--agent-keys-file=")) parsed.agentKeysFile = arg.slice("--agent-keys-file=".length);
    else if (arg === "--agent-keys-file") parsed.agentKeysFile = requireValue(argv, ++index, arg);
    else if (arg.startsWith("--service-name=")) parsed.serviceName = arg.slice("--service-name=".length);
    else if (arg === "--service-name") parsed.serviceName = requireValue(argv, ++index, arg);
    else if (arg.startsWith("--repair-id=")) parsed.repairId = arg.slice("--repair-id=".length);
    else if (arg === "--repair-id") parsed.repairId = requireValue(argv, ++index, arg);
    else throw new Error(`Unknown argument: ${arg}`);
  }
  return parsed;
}

function requireValue(argv, index, flag) {
  const value = argv[index];
  if (!value || value.startsWith("--")) throw new Error(`${flag} requires a value`);
  return value;
}

function printHelp() {
  console.log(`
Usage: node scripts/paperclip-reconcile-bootstrap-issues.mjs [options]

Options:
  --dry-run                         Report affected Paperclip bootstrap issues (default)
  --apply                           Backup, repair DB state, queue wakeups
  --origin-id <id>                  Issue origin id to reconcile
  --fallback-model <model>          Model assigned to failed/timed-out affected agents
  --db-url <url>                    Paperclip PostgreSQL URL
  --paperclip-bin <path>            paperclipai executable for backups
  --paperclip-data-dir <path>       Paperclip data directory
  --agent-keys-file <path>          Secure runtime key map consumed by Hermes adapter
  --no-ensure-agent-keys            Do not create/repair per-agent runtime API keys
  --service-control                 Stop/start paperclip.service around apply
  --no-service-control              Keep paperclip.service running around apply (default)
  --repair-id <id>                  Stable repair marker for comments/wakeups
`);
}

function loadReport() {
  const affected = jsonQuery(`
    with created as (
      select
        i.id,
        i.company_id,
        c.name as company_name,
        i.identifier,
        i.status as issue_status,
        i.assignee_agent_id as current_assignee_id,
        current_agent.name as current_assignee_name,
        nullif(split_part(i.origin_fingerprint, ':', 2), '')::uuid as intended_agent_id,
        intended_agent.name as intended_agent_name,
        intended_agent.status as intended_agent_status,
        intended_agent.adapter_type as intended_adapter_type,
        intended_agent.adapter_config->>'model' as intended_model,
        intended_agent.adapter_config->>'provider' as intended_provider,
        p.name as project_name,
        coalesce(active_recovery.active_count, 0)::int as active_recovery_count,
        active_recovery.recovery_kinds,
        latest_run.id as latest_run_id,
        latest_run.status as latest_run_status,
        latest_run.error_code as latest_error_code,
        case
          when i.assignee_agent_id is distinct from intended_agent.id then true
          else false
        end as assignee_drift
      from issues i
      join companies c on c.id = i.company_id
      left join projects p on p.id = i.project_id
      left join agents current_agent on current_agent.id = i.assignee_agent_id
      left join agents intended_agent on intended_agent.id = nullif(split_part(i.origin_fingerprint, ':', 2), '')::uuid
      left join lateral (
        select
          count(*) as active_count,
          string_agg(ira.kind || ':' || ira.cause, ', ' order by ira.kind, ira.created_at) as recovery_kinds
        from issue_recovery_actions ira
        where ira.source_issue_id = i.id
          and ira.status = 'active'
      ) active_recovery on true
      left join lateral (
        select hr.id, hr.status, hr.error_code
        from heartbeat_runs hr
        where hr.agent_id = intended_agent.id
        order by hr.created_at desc
        limit 1
      ) latest_run on true
      where i.origin_id = ${sqlLiteral(originId)}
        and intended_agent.id is not null
    )
    select *
    from created
    where issue_status = 'blocked'
       or active_recovery_count > 0
       or assignee_drift
    order by company_name, identifier
  `);

  const summary = jsonQuery(`
    with created as (
      select
        i.*,
        nullif(split_part(i.origin_fingerprint, ':', 2), '')::uuid as intended_agent_id
      from issues i
      where i.origin_id = ${sqlLiteral(originId)}
    ),
    active_recovery as (
      select source_issue_id, count(*)::int as count
      from issue_recovery_actions
      where status = 'active'
      group by source_issue_id
    )
    select
      count(*)::int as total_issues,
      count(*) filter (where i.status = 'blocked')::int as blocked_issues,
      count(*) filter (where i.status = 'done')::int as done_issues,
      coalesce(sum(active_recovery.count), 0)::int as active_recovery_actions,
      count(*) filter (where i.assignee_agent_id is distinct from i.intended_agent_id)::int as assignee_drift,
      count(*) filter (
        where not (
          i.execution_policy ? 'mode'
          and i.execution_policy->>'mode' in ('normal', 'manual', 'monitor')
          and jsonb_typeof(i.execution_policy->'stages') = 'array'
        )
      )::int as invalid_execution_policy,
      count(*) filter (
        where position(E'\\\\\\\\n' in coalesce(i.title, '')) > 0
           or position(E'\\\\\\\\n' in coalesce(i.description, '')) > 0
      )::int as literal_escaped_newlines
    from created i
    left join active_recovery on active_recovery.source_issue_id = i.id
  `)[0];

  const modelFailures = jsonQuery(`
    with created_agents as (
      select distinct nullif(split_part(origin_fingerprint, ':', 2), '')::uuid as agent_id
      from issues
      where origin_id = ${sqlLiteral(originId)}
    ),
    latest_run as (
      select hr.*, row_number() over(partition by hr.agent_id order by hr.created_at desc) as rn
      from heartbeat_runs hr
    )
    select
      c.name as company_name,
      a.adapter_config->>'model' as model,
      a.status as agent_status,
      latest_run.status as latest_run_status,
      latest_run.error_code as latest_error_code,
      count(*)::int as agents
    from created_agents ca
    join agents a on a.id = ca.agent_id
    join companies c on c.id = a.company_id
    left join latest_run on latest_run.agent_id = a.id and latest_run.rn = 1
    where a.status = 'error'
       or latest_run.error_code in ('adapter_failed', 'timeout')
    group by c.name, model, a.status, latest_run.status, latest_run.error_code
    order by c.name, agents desc
  `);

  return { affected, summary, modelFailures };
}

function printReport(report, label) {
  console.log(`\nPaperclip bootstrap reconciliation ${label}`);
  console.log(JSON.stringify(report.summary, null, 2));

  if (report.modelFailures.length > 0) {
    console.log("\nModel/runtime failure summary:");
    for (const row of report.modelFailures) {
      console.log(
        `- ${row.company_name}: ${row.agents} agent(s), model=${row.model}, agent=${row.agent_status}, run=${row.latest_run_status || "none"}, error=${row.latest_error_code || "none"}`,
      );
    }
  }

  if (report.affected.length === 0) {
    console.log("\nNo affected issues.");
    return;
  }

  console.log("\nAffected issues:");
  for (const row of report.affected) {
    console.log(
      [
        `- ${row.identifier}`,
        row.company_name,
        `status=${row.issue_status}`,
        `project=${row.project_name || "none"}`,
        `current=${row.current_assignee_name || "none"}`,
        `intended=${row.intended_agent_name || "none"}`,
        `agentStatus=${row.intended_agent_status || "none"}`,
        `model=${row.intended_model || "none"}`,
        `latest=${row.latest_run_status || "none"}/${row.latest_error_code || "none"}`,
        `recovery=${row.recovery_kinds || "none"}`,
      ].join(" | "),
    );
  }
}

function createBackup() {
  const output = execFileSync(
    paperclipBin,
    [
      "db:backup",
      "--data-dir",
      paperclipDataDir,
      "--filename-prefix",
      "paperclip-bootstrap-reconcile",
      "--json",
    ],
    { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] },
  ).trim();

  if (!output) return "paperclipai db:backup completed";
  try {
    const parsed = JSON.parse(output);
    return parsed.path || parsed.file || output;
  } catch {
    return output;
  }
}

function ensureRuntimeAgentKeys() {
  const agents = jsonQuery(`
    select distinct
      a.id,
      a.company_id as "companyId",
      a.name
    from issues i
    join agents a on a.id = nullif(split_part(i.origin_fingerprint, ':', 2), '')::uuid
    where i.origin_id = ${sqlLiteral(originId)}
      and a.status <> 'terminated'
    order by a.name
  `);

  mkdirSync(dirname(agentKeysFile), { recursive: true, mode: 0o700 });
  const keyStore = readAgentKeyStore(agentKeysFile);
  let generated = 0;
  let reused = 0;
  const rows = [];

  for (const agent of agents) {
    const existing = keyStore.agents[agent.id]?.apiKey;
    const apiKey = typeof existing === "string" && existing.startsWith("pcp_") ? existing : createToken();
    if (apiKey === existing) reused += 1;
    else generated += 1;

    keyStore.agents[agent.id] = {
      companyId: agent.companyId,
      name: agent.name,
      apiKey,
      updatedAt: new Date().toISOString(),
    };
    rows.push({
      agentId: agent.id,
      companyId: agent.companyId,
      keyHash: createHash("sha256").update(apiKey).digest("hex"),
    });
  }

  keyStore.version = 1;
  keyStore.updatedAt = new Date().toISOString();
  writeFileSync(agentKeysFile, `${JSON.stringify(keyStore, null, 2)}\n`, { mode: 0o600 });
  chmodSync(agentKeysFile, 0o600);

  let inserted = 0;
  if (rows.length > 0) {
    const values = rows
      .map(
        (row) =>
          `(${sqlLiteral(row.agentId)}::uuid, ${sqlLiteral(row.companyId)}::uuid, 'cortex-runtime-reconcile', ${sqlLiteral(row.keyHash)})`,
      )
      .join(",\n");
    const output = psql(`
      with input(agent_id, company_id, name, key_hash) as (
        values ${values}
      ),
      inserted as (
        insert into agent_api_keys (agent_id, company_id, name, key_hash)
        select input.agent_id, input.company_id, input.name, input.key_hash
        from input
        where not exists (
          select 1
          from agent_api_keys existing
          where existing.key_hash = input.key_hash
        )
        returning id
      )
      select count(*)::int from inserted;
    `);
    inserted = Number(output || 0);
  }

  return {
    file: agentKeysFile,
    agents: agents.length,
    generated,
    reused,
    insertedKeyRows: inserted,
  };
}

function readAgentKeyStore(path) {
  if (!existsSync(path)) return { version: 1, agents: {} };
  const raw = readFileSync(path, "utf8");
  if (!raw.trim()) return { version: 1, agents: {} };
  const parsed = JSON.parse(raw);
  if (parsed && typeof parsed === "object" && parsed.agents && typeof parsed.agents === "object") {
    return parsed;
  }
  const agents = {};
  if (Array.isArray(parsed)) {
    for (const entry of parsed) {
      if (entry?.agentId && entry?.apiKey) {
        agents[entry.agentId] = {
          companyId: entry.companyId || "",
          name: entry.name || entry.role || "",
          apiKey: entry.apiKey,
          updatedAt: entry.mintedAt || new Date().toISOString(),
        };
      }
    }
  }
  return { version: 1, agents };
}

function createToken() {
  return `pcp_${randomBytes(24).toString("hex")}`;
}

function serviceIsActive(name) {
  try {
    systemctl(["is-active", "--quiet", name]);
    return true;
  } catch {
    return false;
  }
}

function systemctl(argsList) {
  const command = process.getuid?.() === 0 ? "systemctl" : "sudo";
  const fullArgs = command === "sudo" ? ["-n", "systemctl", ...argsList] : argsList;
  return execFileSync(command, fullArgs, { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
}

function applyRepair() {
  const sql = `
    begin;

    create temporary table paperclip_bootstrap_repair_targets on commit drop as
    with created as (
      select
        i.id as issue_id,
        i.company_id,
        i.identifier,
        i.status as issue_status,
        i.assignee_agent_id as current_assignee_id,
        nullif(split_part(i.origin_fingerprint, ':', 2), '')::uuid as intended_agent_id,
        intended_agent.name as intended_agent_name,
        intended_agent.status as intended_agent_status,
        intended_agent.adapter_config->>'model' as intended_model,
        latest_run.status as latest_run_status,
        latest_run.error_code as latest_error_code,
        coalesce(active_recovery.active_count, 0)::int as active_recovery_count
      from issues i
      left join agents intended_agent on intended_agent.id = nullif(split_part(i.origin_fingerprint, ':', 2), '')::uuid
      left join lateral (
        select count(*) as active_count
        from issue_recovery_actions ira
        where ira.source_issue_id = i.id
          and ira.status = 'active'
      ) active_recovery on true
      left join lateral (
        select hr.status, hr.error_code
        from heartbeat_runs hr
        where hr.agent_id = intended_agent.id
        order by hr.created_at desc
        limit 1
      ) latest_run on true
      where i.origin_id = ${sqlLiteral(originId)}
        and intended_agent.id is not null
    )
    select *
    from created
    where issue_status = 'blocked'
       or active_recovery_count > 0
       or current_assignee_id is distinct from intended_agent_id;

    update agents a
       set status = case when a.status = 'error' then 'idle' else a.status end,
           adapter_config = case
             when a.status = 'error'
               or t.latest_error_code in ('adapter_failed', 'timeout')
               or t.intended_model in ('glm/glm-5.1')
             then jsonb_set(coalesce(a.adapter_config, '{}'::jsonb), '{model}', to_jsonb(${sqlLiteral(fallbackModel)}::text), true)
             else a.adapter_config
           end,
           updated_at = now()
      from (
        select distinct intended_agent_id, latest_error_code, intended_model
        from paperclip_bootstrap_repair_targets
      ) t
     where a.id = t.intended_agent_id;

    update agent_runtime_state ars
       set last_error = null,
           updated_at = now()
      from (
        select distinct intended_agent_id
        from paperclip_bootstrap_repair_targets
      ) t
     where ars.agent_id = t.intended_agent_id;

    update issues i
       set assignee_agent_id = t.intended_agent_id,
           status = 'in_progress',
           started_at = coalesce(i.started_at, now()),
           completed_at = null,
           cancelled_at = null,
           execution_locked_at = null,
           updated_at = now()
      from paperclip_bootstrap_repair_targets t
     where i.id = t.issue_id;

    update issue_recovery_actions ira
       set status = 'resolved',
           outcome = 'restored',
           resolution_note = ${sqlLiteral(
             `Restored by ${repairId}: assignee reset to intended employee, failed runtime state reset, and a new wakeup was queued.`,
           )},
           resolved_at = now(),
           updated_at = now()
      from paperclip_bootstrap_repair_targets t
     where ira.source_issue_id = t.issue_id
       and ira.status = 'active';

    insert into issue_comments (company_id, issue_id, body, author_type, metadata)
    select
      t.company_id,
      t.issue_id,
      ${sqlLiteral(
        `Paperclip bootstrap repair restored this issue to the intended employee and queued a new wakeup. Repair marker: ${repairId}.`,
      )},
      'system',
      jsonb_build_object('source', 'paperclip-reconcile-bootstrap-issues', 'repairId', ${sqlLiteral(repairId)})
    from paperclip_bootstrap_repair_targets t
    where not exists (
      select 1
      from issue_comments ic
      where ic.issue_id = t.issue_id
        and ic.metadata->>'source' = 'paperclip-reconcile-bootstrap-issues'
        and ic.metadata->>'repairId' = ${sqlLiteral(repairId)}
    );

    insert into agent_wakeup_requests (
      company_id,
      agent_id,
      source,
      trigger_detail,
      reason,
      payload,
      status,
      requested_by_actor_type,
      idempotency_key
    )
    select
      t.company_id,
      t.intended_agent_id,
      'paperclip-bootstrap-reconcile',
      'system',
      'issue_assigned',
      jsonb_build_object(
        'issueId', t.issue_id,
        'issueIdentifier', t.identifier,
        'repairId', ${sqlLiteral(repairId)}
      ),
      'queued',
      'system',
      'paperclip-bootstrap-reconcile:' || ${sqlLiteral(repairId)} || ':' || t.identifier
    from paperclip_bootstrap_repair_targets t
    where not exists (
      select 1
      from agent_wakeup_requests wr
      where wr.agent_id = t.intended_agent_id
        and wr.status in ('queued', 'claimed')
        and wr.reason = 'issue_assigned'
        and wr.payload->>'issueId' = t.issue_id::text
    );

    select jsonb_build_object(
      'repairId', ${sqlLiteral(repairId)},
      'issuesRepaired', (select count(*) from paperclip_bootstrap_repair_targets),
      'activeRecoveriesRemaining', (
        select count(*)
        from issue_recovery_actions ira
        join issues i on i.id = ira.source_issue_id
        where i.origin_id = ${sqlLiteral(originId)}
          and ira.status = 'active'
      ),
      'queuedWakeups', (
        select count(*)
        from agent_wakeup_requests wr
        where wr.source = 'paperclip-bootstrap-reconcile'
          and wr.payload->>'repairId' = ${sqlLiteral(repairId)}
      )
    );

    commit;
  `;

  const output = psql(sql);
  return parseLastJson(output);
}

function assertClean(report) {
  const failures = [];
  if (Number(report.summary.active_recovery_actions) !== 0) failures.push("active recovery actions remain");
  if (Number(report.summary.blocked_issues) !== 0) failures.push("blocked bootstrap issues remain");
  if (Number(report.summary.assignee_drift) !== 0) failures.push("assignee drift remains");
  if (Number(report.summary.invalid_execution_policy) !== 0) failures.push("invalid execution policies remain");
  if (Number(report.summary.literal_escaped_newlines) !== 0) failures.push("literal escaped newline formatting remains");
  if (failures.length > 0) throw new Error(`Post-repair validation failed: ${failures.join(", ")}`);
}

function jsonQuery(query) {
  const output = psql(`
    select coalesce(jsonb_agg(to_jsonb(rows)), '[]'::jsonb)
    from (${query}) rows;
  `);
  return JSON.parse(output || "[]");
}

function psql(query) {
  return execFileSync("psql", [dbUrl, "-v", "ON_ERROR_STOP=1", "-X", "-Atc", query], {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
    maxBuffer: 1024 * 1024 * 16,
  }).trim();
}

function parseLastJson(output) {
  const lines = String(output)
    .trim()
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  for (let index = lines.length - 1; index >= 0; index -= 1) {
    try {
      return JSON.parse(lines[index]);
    } catch {
      // Continue searching for the SELECT JSON row.
    }
  }
  throw new Error(`Could not parse repair result JSON from psql output: ${output}`);
}

function sqlLiteral(value) {
  return `'${String(value).replace(/'/g, "''")}'`;
}
