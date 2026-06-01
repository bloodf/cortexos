#!/usr/bin/env node
import { createHash, randomBytes } from "node:crypto";
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, writeFileSync } from "node:fs";

const envPath = process.env.PAPERCLIP_ENV_FILE || "/opt/cortexos/.secrets/paperclip.env";
const contextPath = process.env.PAPERCLIP_CONTEXT || "/opt/cortexos/paperclip/context.json";
const dbUrl =
  process.env.PAPERCLIP_DB_URL ||
  process.env.DATABASE_URL ||
  "postgres://paperclip:paperclip@127.0.0.1:54329/paperclip";
const checkOnly = process.argv.includes("--check");

function readEnvFile(path) {
  const out = {};
  if (!existsSync(path)) return out;
  const raw = readFileSync(path, "utf8");
  for (const line of raw.split(/\r?\n/)) {
    const match = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)=(.*)\s*$/);
    if (!match) continue;
    let value = match[2].trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    out[match[1]] = value;
  }
  return out;
}

function writeEnvValue(path, key, value) {
  const quoted = `${key}="${String(value).replace(/(["\\$`])/g, "\\$1")}"`;
  const raw = existsSync(path) ? readFileSync(path, "utf8") : "";
  const lines = raw ? raw.split(/\r?\n/) : [];
  let found = false;
  const next = lines.map((line) => {
    if (line.match(new RegExp(`^\\s*${key}=`))) {
      found = true;
      return quoted;
    }
    return line;
  });
  if (!found) next.push(quoted);
  writeFileSync(path, `${next.filter((line, index) => line || index < next.length - 1).join("\n")}\n`, {
    mode: 0o600,
  });
}

function sql(query) {
  return execFileSync("psql", [dbUrl, "-v", "ON_ERROR_STOP=1", "-Atc", query], {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  }).trim();
}

function sqlLiteral(value) {
  return `'${String(value).replace(/'/g, "''")}'`;
}

function readContextCompanyId() {
  if (!existsSync(contextPath)) return "";
  try {
    const context = JSON.parse(readFileSync(contextPath, "utf8"));
    const profile = context.profiles?.[context.currentProfile || "default"];
    return typeof profile?.companyId === "string" ? profile.companyId : "";
  } catch {
    return "";
  }
}

function rowExists(query) {
  return sql(query) === "1";
}

function chooseUserId() {
  const preferred = sql(
    "select id from \"user\" where email = 'admin@cortexos.local' order by created_at limit 1;",
  );
  if (preferred) return preferred;
  const local = sql("select id from \"user\" where id = 'local-board' limit 1;");
  if (local) return local;
  return sql("select id from \"user\" order by created_at limit 1;");
}

function companyAccessible(companyId, userId) {
  if (!companyId) return false;
  return rowExists(`
    select 1
      from company_memberships
     where company_id = ${sqlLiteral(companyId)}
       and principal_type = 'user'
       and principal_id = ${sqlLiteral(userId)}
       and status = 'active'
     limit 1;
  `);
}

function chooseCompanyId(envCompanyId, userId) {
  if (companyAccessible(envCompanyId, userId)) return envCompanyId;
  const contextCompanyId = readContextCompanyId();
  if (companyAccessible(contextCompanyId, userId)) return contextCompanyId;
  const owned = sql(`
    select company_id
      from company_memberships
     where principal_type = 'user'
       and principal_id = ${sqlLiteral(userId)}
       and status = 'active'
     order by created_at desc
     limit 1;
  `);
  if (owned) return owned;
  return sql("select id from companies where status = 'active' order by created_at desc limit 1;");
}

function ensureBoardKey(apiKey, userId) {
  const keyHash = createHash("sha256").update(apiKey).digest("hex");
  if (checkOnly) {
    if (
      !rowExists(`
        select 1 from board_api_keys
         where key_hash = ${sqlLiteral(keyHash)}
           and revoked_at is null
           and (expires_at is null or expires_at > now())
         limit 1;
      `)
    ) {
      throw new Error("PAPERCLIP_API_KEY is not an active board API key");
    }
    return;
  }
  sql(`
    insert into board_api_keys (user_id, name, key_hash)
    values (${sqlLiteral(userId)}, 'CortexOS readiness key', ${sqlLiteral(keyHash)})
    on conflict (key_hash) do update
      set revoked_at = null,
          expires_at = null,
          last_used_at = null;
  `);
}

const env = readEnvFile(envPath);
const userId = chooseUserId();
if (!userId) throw new Error("No Paperclip user exists for board API key ownership");

const apiKey = env.PAPERCLIP_API_KEY || `pcp_board_${randomBytes(32).toString("hex")}`;
const companyId = chooseCompanyId(env.PAPERCLIP_COMPANY_ID, userId);
if (!companyId) throw new Error("No active Paperclip company exists for readiness checks");
if (!companyAccessible(companyId, userId)) {
  throw new Error(`Selected Paperclip user ${userId} does not have access to company ${companyId}`);
}

if (!checkOnly) {
  writeEnvValue(envPath, "PAPERCLIP_API_KEY", apiKey);
  writeEnvValue(envPath, "PAPERCLIP_COMPANY_ID", companyId);
}
ensureBoardKey(apiKey, userId);

console.log(
  JSON.stringify({
    ok: true,
    envPath,
    companyId,
    userId,
    mode: checkOnly ? "check" : "repair",
  }),
);
