"use strict";
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));

// server.ts
var import_http = require("http");
var import_next = __toESM(require("next"));
var import_socket = require("socket.io");

// src/lib/host-exec.ts
var import_child_process = require("child_process");
var import_fs = require("fs");
var import_util = require("util");
var IN_CONTAINER = (0, import_fs.existsSync)("/.dockerenv");
var _execFileAsync = (0, import_util.promisify)(import_child_process.execFile);
function hostExec(cmd, timeout = 5e3) {
  if (!IN_CONTAINER) {
    return (0, import_child_process.execSync)(cmd, { encoding: "utf-8", timeout });
  }
  const escaped = cmd.replace(/'/g, "'\\''");
  return (0, import_child_process.execSync)(`nsenter --target 1 --mount --net -- sh -c '${escaped}'`, {
    encoding: "utf-8",
    timeout
  });
}

// src/lib/db/client.ts
var pg = __toESM(require("pg"));
var cachedPool = null;
function getPoolCtor() {
  const mod = pg;
  const ctor = mod.Pool ?? mod.default?.Pool;
  if (!ctor) {
    throw new TypeError("pg.Pool constructor unavailable");
  }
  return ctor;
}
function getPool() {
  if (!cachedPool) {
    if (!process.env.DB_PASSWORD) {
      throw new Error("DB_PASSWORD environment variable is required");
    }
    const PoolCtor = getPoolCtor();
    cachedPool = new PoolCtor({
      host: process.env.DB_HOST || "127.0.0.1",
      port: parseInt(process.env.DB_PORT || "5432", 10),
      database: process.env.DB_NAME || "cortex_dashboard",
      user: process.env.DB_USER || "dashboard",
      password: process.env.DB_PASSWORD,
      max: 20,
      idleTimeoutMillis: 3e4,
      connectionTimeoutMillis: 5e3
    });
  }
  return cachedPool;
}
async function query(text, params) {
  const result = await getPool().query(text, params);
  return result.rows;
}
async function queryResult(text, params) {
  return getPool().query(text, params);
}
async function queryOne(text, params) {
  const rows = await query(text, params);
  return rows[0] ?? null;
}
async function execute(text, params) {
  await queryResult(text, params);
}

// src/lib/db/alerts.ts
async function getEnabledAlertRules() {
  return query(
    "SELECT id, service_id, name, condition, threshold_ms, enabled, created_at, updated_at FROM alert_rules WHERE enabled = true ORDER BY created_at DESC"
  );
}
async function insertAlertHistory(ruleId, serviceId, status, message) {
  const row = await queryOne(
    `INSERT INTO alert_history (rule_id, service_id, status, message)
     VALUES ($1, $2, $3, $4)
     RETURNING id, rule_id, service_id, status, message, created_at`,
    [ruleId, serviceId, status, message]
  );
  if (!row) throw new Error("Failed to insert alert history");
  return row;
}

// src/lib/db/admin.ts
async function getSessionByToken(token) {
  return queryOne(
    `SELECT s.id, s.user_id, s.token, s.expires_at, s.created_at, s.is_admin, u.username
     FROM admin_sessions s
     JOIN pam_users u ON u.id = s.user_id
     WHERE s.token = $1 AND s.expires_at > NOW()`,
    [token]
  );
}

// src/lib/socket-server.ts
var INTERVALS = {
  services: 1e4,
  system: 5e3,
  processes: 5e3,
  network: 5e3,
  docker: 1e4,
  alerts: 1e4
};
var RETENTION_INTERVAL_MS = 6 * 60 * 60 * 1e3;
var SESSION_COOKIE_RE = /(?:^|;)\s*session_token=([^;]+)/;
async function fetchInternal(port2, path) {
  try {
    const res = await fetch(`http://localhost:${port2}${path}`, {
      cache: "no-store"
    });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}
function getSessionToken(cookieHeader) {
  if (!cookieHeader) return "";
  const match = cookieHeader.match(SESSION_COOKIE_RE);
  return match?.[1] ? decodeURIComponent(match[1]) : "";
}
async function runRetentionCleanup() {
  try {
    await execute("DELETE FROM service_health_log WHERE checked_at < NOW() - INTERVAL '30 days'");
    await execute("DELETE FROM alert_history WHERE created_at < NOW() - INTERVAL '90 days'");
  } catch (error) {
    console.error("[retention-cleanup] failed", error);
  }
}
function getDockerStatus() {
  try {
    const stdout = hostExec(
      "docker ps --format '{{.Names}}|{{.Status}}'",
      5e3
    );
    const containers = stdout.trim().split("\n").filter(Boolean).map((line) => {
      const [name, status] = line.split("|");
      return { name, status };
    });
    return { containers, timestamp: Date.now() };
  } catch {
    return { containers: [], timestamp: Date.now() };
  }
}
function initSocketServer(io, port2) {
  io.use(async (socket, next2) => {
    try {
      const token = getSessionToken(socket.handshake.headers.cookie);
      if (!token) return next2(new Error("Unauthorized"));
      const session = await getSessionByToken(token);
      if (!session) return next2(new Error("Unauthorized"));
      return next2();
    } catch {
      return next2(new Error("Unauthorized"));
    }
  });
  io.on("connection", (socket) => {
    socket.on("disconnect", () => {
    });
  });
  const timers = [];
  runRetentionCleanup();
  timers.push(setInterval(runRetentionCleanup, RETENTION_INTERVAL_MS));
  const previousStatuses = /* @__PURE__ */ new Map();
  timers.push(
    setInterval(async () => {
      const data = await fetchInternal(port2, "/api/services?raw=1");
      if (data) io.emit("services:status", data);
    }, INTERVALS.services)
  );
  timers.push(
    setInterval(async () => {
      const data = await fetchInternal(port2, "/api/system");
      if (data) io.emit("system:metrics", data);
    }, INTERVALS.system)
  );
  timers.push(
    setInterval(async () => {
      const data = await fetchInternal(port2, "/api/processes");
      if (data) io.emit("processes:list", data);
    }, INTERVALS.processes)
  );
  timers.push(
    setInterval(async () => {
      const data = await fetchInternal(port2, "/api/network");
      if (data) io.emit("network:stats", data);
    }, INTERVALS.network)
  );
  timers.push(
    setInterval(() => {
      const data = getDockerStatus();
      io.emit("docker:status", data);
    }, INTERVALS.docker)
  );
  timers.push(
    setInterval(async () => {
      const data = await fetchInternal(port2, "/api/services");
      if (!data || !Array.isArray(data.services)) return;
      const rules = await getEnabledAlertRules().catch(() => []);
      const rulesByService = /* @__PURE__ */ new Map();
      for (const rule of rules) {
        const list = rulesByService.get(rule.service_id) || [];
        list.push(rule);
        rulesByService.set(rule.service_id, list);
      }
      for (const svc of data.services) {
        const prev = previousStatuses.get(svc.id);
        const curr = svc.status;
        previousStatuses.set(svc.id, curr);
        if (prev && prev !== curr) {
          const serviceRules2 = rulesByService.get(svc.id) || [];
          for (const rule of serviceRules2) {
            let triggered = false;
            let message = "";
            if (rule.condition === "offline" && curr === "offline") {
              triggered = true;
              message = `${svc.name} is offline`;
            } else if (rule.condition === "online" && curr === "online") {
              triggered = true;
              message = `${svc.name} is back online`;
            }
            if (triggered) {
              try {
                await insertAlertHistory(rule.id, svc.id, curr, message);
              } catch {
              }
              io.emit("alert:triggered", {
                ruleId: rule.id,
                ruleName: rule.name,
                serviceId: svc.id,
                serviceName: svc.name,
                status: curr,
                message,
                timestamp: Date.now()
              });
            }
          }
        }
        const serviceRules = rulesByService.get(svc.id) || [];
        for (const rule of serviceRules) {
          if (rule.condition === "response_time" && rule.threshold_ms != null && typeof svc.responseTime === "number" && svc.responseTime > rule.threshold_ms) {
            const message = `${svc.name} response time ${svc.responseTime}ms exceeds ${rule.threshold_ms}ms`;
            try {
              await insertAlertHistory(rule.id, svc.id, curr, message);
            } catch {
            }
            io.emit("alert:triggered", {
              ruleId: rule.id,
              ruleName: rule.name,
              serviceId: svc.id,
              serviceName: svc.name,
              status: curr,
              message,
              timestamp: Date.now()
            });
          }
        }
      }
    }, INTERVALS.alerts)
  );
  process.on("SIGINT", () => {
    timers.forEach(clearInterval);
    io.close(() => process.exit(0));
  });
}

// server.ts
var dev = process.env.NODE_ENV !== "production";
var port = parseInt(process.env.PORT || "3000", 10);
var hostname = process.env.HOSTNAME || "0.0.0.0";
var app = (0, import_next.default)({ dev, port, hostname, turbopack: dev });
var handle = app.getRequestHandler();
app.prepare().then(() => {
  const server = (0, import_http.createServer)((req, res) => {
    handle(req, res);
  });
  const originEnv = process.env.DASHBOARD_ORIGIN;
  const allowedOrigins = dev ? [`http://localhost:${port}`, `http://127.0.0.1:${port}`] : originEnv ? originEnv.split(",").map((s) => s.trim()).filter(Boolean) : [`http://localhost:${port}`];
  const io = new import_socket.Server(server, {
    path: "/socket.io",
    cors: {
      origin: allowedOrigins,
      methods: ["GET", "POST"],
      credentials: true
    }
  });
  initSocketServer(io, port);
  server.listen(port, hostname, () => {
    console.log(`> Ready on http://${hostname}:${port}`);
  });
});
