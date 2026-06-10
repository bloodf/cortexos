// @ts-check
/**
 * CortexOS Terminal PTY Sidecar (WP-19)
 * ------------------------------------------------------------------------
 * A standalone Node WebSocket server that hosts an interactive admin shell
 * (node-pty) for the dashboard's xterm UI. It is a SEPARATE process from the
 * live dashboard (`cortex-dashboard.service` on :3080); it can be restarted
 * independently and cannot crash the dashboard.
 *
 * Transport: `ws` WebSocketServer bound to loopback (default 127.0.0.1:3081).
 * Caddy reverse-proxies `wss://<host>/terminal/ws` → 127.0.0.1:3081 with the
 * standard WebSocket upgrade headers.
 *
 * SECURITY MODEL (admin-only host shell):
 *   1. Cookie auth   — the `cortexos_session` HttpOnly cookie from the upgrade
 *                      request is validated against Postgres `admin_sessions`
 *                      (token + expiry). No row → close 4401.
 *   2. RBAC          — the session must be `is_admin = true`. Otherwise close 4403.
 *   3. CSRF / origin — the WS `Origin` header MUST equal ALLOWED_ORIGIN to stop
 *                      cross-site WebSocket hijacking (the cookie alone is not
 *                      enough; browsers send cookies on cross-site WS too).
 *   4. PTY           — a real shell (default /bin/bash). Admins already have host
 *                      access (same model as the legacy /api/terminal), so this
 *                      is an unrestricted server shell, gated only by the auth
 *                      checks above.
 *
 * Privacy: we log connection lifecycle (user, ip, close codes) but NEVER pty
 * content (no keystrokes, no output).
 *
 * Wire protocol (client → server, JSON text frames):
 *   { type: 'input',  data: string }
 *   { type: 'resize', cols: number, rows: number }
 * Server → client: raw pty bytes are sent as text frames (xterm writes them
 * directly). A control frame `{ type: 'exit', code }` is sent on pty exit.
 */

import { createServer } from 'node:http';
import process from 'node:process';

import { WebSocketServer } from 'ws';
import pkg from 'pg';
import * as pty from 'node-pty';

const { Client } = pkg;

// ---------------------------------------------------------------------------
// Config (all overridable via env / EnvironmentFile)
// ---------------------------------------------------------------------------

const HOST = process.env.TERMINAL_HOST || '127.0.0.1';
const PORT = parseInt(process.env.TERMINAL_PORT || '3081', 10);
const SHELL = process.env.TERMINAL_SHELL || '/bin/bash';
const CWD = process.env.TERMINAL_CWD || process.env.HOME || '/root';
const IDLE_SEC = parseInt(process.env.TERMINAL_IDLE_SEC || '900', 10);
// ALLOWED_ORIGIN is the public dashboard origin, e.g. https://cortex.example.ts.net
// If unset, origin enforcement is skipped with a loud warning (dev only).
const ALLOWED_ORIGIN = process.env.ALLOWED_ORIGIN || '';

const SESSION_COOKIE = 'cortexos_session';

// ---------------------------------------------------------------------------
// Structured logging (NEVER logs pty content)
// ---------------------------------------------------------------------------

/** @param {string} msg @param {Record<string, unknown>} [fields] */
function log(msg, fields) {
  const ts = new Date().toISOString();
  const extra = fields
    ? ` ${Object.entries(fields)
        .map(([k, v]) => `${k}=${JSON.stringify(v)}`)
        .join(' ')}`
    : '';
  process.stdout.write(`[${ts}] cortex-terminal: ${msg}${extra}\n`);
}

// ---------------------------------------------------------------------------
// Postgres session validation
// ---------------------------------------------------------------------------

/**
 * Build a pg connection config from the same DB_* env the dashboard uses
 * (supplied via EnvironmentFile=/opt/cortexos/.secrets/dashboard.env).
 * @returns {import('pg').ClientConfig}
 */
function dbConfig() {
  if (!process.env.DB_PASSWORD && !process.env.DATABASE_URL) {
    throw new Error('DB_PASSWORD (or DATABASE_URL) is required');
  }
  if (process.env.DATABASE_URL) {
    return { connectionString: process.env.DATABASE_URL };
  }
  return {
    host: process.env.DB_HOST || '127.0.0.1',
    port: parseInt(process.env.DB_PORT || '5432', 10),
    database: process.env.DB_NAME || 'cortex_dashboard',
    user: process.env.DB_USER || 'dashboard',
    password: process.env.DB_PASSWORD,
  };
}

/**
 * Parse a Cookie header into a flat map. Defensive: never throws.
 * @param {string | undefined} header
 * @returns {Record<string, string>}
 */
function parseCookies(header) {
  /** @type {Record<string, string>} */
  const out = {};
  if (!header) return out;
  for (const part of header.split(';')) {
    const idx = part.indexOf('=');
    if (idx === -1) continue;
    const k = part.slice(0, idx).trim();
    const v = part.slice(idx + 1).trim();
    if (k) out[k] = decodeURIComponent(v);
  }
  return out;
}

/**
 * Validate the session token against `admin_sessions`. A fresh short-lived
 * pg Client is used per upgrade (low volume, avoids a stale pool on a server
 * that mostly idles). Returns null on any failure.
 * @param {string} token
 * @returns {Promise<{ isAdmin: boolean, username: string } | null>}
 */
async function validateSession(token) {
  const client = new Client(dbConfig());
  try {
    await client.connect();
    const res = await client.query(
      'select s.is_admin, u.username from admin_sessions s ' +
        'join pam_users u on u.id = s.user_id ' +
        'where s.token = $1 and s.expires_at > now()',
      [token],
    );
    if (res.rowCount === 0) return null;
    const row = res.rows[0];
    return { isAdmin: row.is_admin === true, username: String(row.username) };
  } catch (err) {
    log('session validation error', {
      error: err instanceof Error ? err.message : String(err),
    });
    return null;
  } finally {
    await client.end().catch(() => {});
  }
}

/**
 * Best-effort client IP from the upgrade request (X-Forwarded-For aware, since
 * Caddy proxies). Never used as an auth signal — forensic only.
 * @param {import('node:http').IncomingMessage} req
 */
function clientIp(req) {
  const xff = req.headers['x-forwarded-for'];
  if (typeof xff === 'string' && xff.length > 0) {
    return xff.split(',')[0].trim();
  }
  return req.socket.remoteAddress || 'unknown';
}

// ---------------------------------------------------------------------------
// HTTP + WebSocket server
// ---------------------------------------------------------------------------

const httpServer = createServer((req, res) => {
  // Tiny health endpoint so the orchestrator can probe liveness without a WS.
  if (req.url === '/healthz') {
    res.writeHead(200, { 'content-type': 'text/plain' });
    res.end('ok\n');
    return;
  }
  res.writeHead(426, { 'content-type': 'text/plain' });
  res.end('upgrade required\n');
});

// noServer: we own the upgrade so we can authenticate BEFORE accepting the WS.
const wss = new WebSocketServer({ noServer: true });

httpServer.on('upgrade', (req, socket, head) => {
  // Wrap everything so a malformed upgrade can never crash the process.
  (async () => {
    const ip = clientIp(req);

    // 1. Origin / CSRF check — reject cross-site WS hijacking. Browsers send
    // cookies on cross-site WS too, so the cookie alone is not enough.
    //   - ALLOWED_ORIGIN set to a concrete origin → require exact match.
    //   - ALLOWED_ORIGIN unset or "same-origin" → require the Origin's host to
    //     equal the Host being connected to (correct behind Caddy :80/Tailscale
    //     where there is no single fixed public origin). No Origin → reject.
    const { origin } = req.headers;
    const sameOriginMode = !ALLOWED_ORIGIN || ALLOWED_ORIGIN === 'same-origin';
    if (!sameOriginMode) {
      if (origin !== ALLOWED_ORIGIN) {
        log('rejected: origin mismatch', { ip, origin: origin || null });
        return abortHandshake(socket, 403);
      }
    } else {
      let originHost = null;
      try {
        originHost = origin ? new URL(origin).host : null;
      } catch {
        originHost = null;
      }
      if (!originHost || originHost !== req.headers.host) {
        log('rejected: cross-origin WS (same-origin enforced)', {
          ip,
          origin: origin || null,
          host: req.headers.host || null,
        });
        return abortHandshake(socket, 403);
      }
    }

    // 2. Cookie → session token.
    const cookies = parseCookies(req.headers.cookie);
    const token = cookies[SESSION_COOKIE];
    if (!token) {
      log('rejected: no session cookie', { ip });
      return abortHandshake(socket, 401);
    }

    // 3. Validate session + admin.
    const session = await validateSession(token);
    if (!session) {
      // Accept the WS only to send a clean close code the UI can read.
      acceptThenClose(req, socket, head, 4401, 'unauthorized', ip);
      return;
    }
    if (!session.isAdmin) {
      log('rejected: not admin', { ip, user: session.username });
      acceptThenClose(req, socket, head, 4403, 'forbidden', ip);
      return;
    }

    // 4. Authenticated — accept the WS and spawn the PTY.
    wss.handleUpgrade(req, socket, head, (ws) => {
      handleSession(ws, session.username, ip);
    });
  })().catch((err) => {
    log('upgrade handler error', {
      error: err instanceof Error ? err.message : String(err),
    });
    try {
      abortHandshake(socket, 500);
    } catch {
      /* socket already gone */
    }
  });
});

/**
 * Reject a raw upgrade socket with an HTTP status before the WS is established.
 * @param {import('node:stream').Duplex} socket
 * @param {number} status
 */
function abortHandshake(socket, status) {
  const text =
    { 401: 'Unauthorized', 403: 'Forbidden', 500: 'Internal Server Error' }[status] || 'Error';
  try {
    socket.write(
      `HTTP/1.1 ${status} ${text}\r\n` + 'connection: close\r\n' + 'content-length: 0\r\n' + '\r\n',
    );
  } catch {
    /* socket already gone */
  }
  socket.destroy();
}

/**
 * Accept the WS handshake then immediately close with an app-level code so
 * the browser's xterm UI can distinguish 4401/4403 and show the right state.
 * @param {import('node:http').IncomingMessage} req
 * @param {import('node:stream').Duplex} socket
 * @param {Buffer} head
 * @param {number} code
 * @param {string} reason
 * @param {string} ip
 */
function acceptThenClose(req, socket, head, code, reason, ip) {
  wss.handleUpgrade(req, socket, head, (ws) => {
    log('rejected after upgrade', { ip, code, reason });
    try {
      ws.close(code, reason);
    } catch {
      ws.terminate();
    }
  });
}

// ---------------------------------------------------------------------------
// Per-connection PTY session
// ---------------------------------------------------------------------------

/**
 * @param {import('ws').WebSocket} ws
 * @param {string} user
 * @param {string} ip
 */
function handleSession(ws, user, ip) {
  /** @type {import('node-pty').IPty | null} */
  let term = null;
  /** @type {NodeJS.Timeout | null} */
  let idleTimer = null;

  const resetIdle = () => {
    if (idleTimer) clearTimeout(idleTimer);
    if (IDLE_SEC > 0) {
      idleTimer = setTimeout(() => {
        log('idle timeout — killing pty', { user, ip, idleSec: IDLE_SEC });
        cleanup();
        try {
          ws.close(4408, 'idle timeout');
        } catch {
          ws.terminate();
        }
      }, IDLE_SEC * 1000);
    }
  };

  const cleanup = () => {
    if (idleTimer) {
      clearTimeout(idleTimer);
      idleTimer = null;
    }
    if (term) {
      const t = term;
      term = null;
      try {
        t.kill();
      } catch {
        /* already dead */
      }
    }
  };

  try {
    term = pty.spawn(SHELL, [], {
      name: 'xterm-color',
      cols: 80,
      rows: 24,
      cwd: CWD,
      env: { ...process.env, TERM: 'xterm-color' },
    });
  } catch (err) {
    log('pty spawn failed', {
      user,
      ip,
      error: err instanceof Error ? err.message : String(err),
    });
    try {
      ws.close(4500, 'pty spawn failed');
    } catch {
      ws.terminate();
    }
    return;
  }

  log('session opened', { user, ip, pid: term.pid });
  resetIdle();

  // PTY → WS. Raw bytes are forwarded as text frames; xterm writes them as-is.
  term.onData((data) => {
    if (ws.readyState === ws.OPEN) {
      try {
        ws.send(data);
      } catch {
        /* peer gone; close handler will clean up */
      }
    }
  });

  term.onExit(({ exitCode }) => {
    log('pty exited', { user, ip, exitCode });
    if (ws.readyState === ws.OPEN) {
      try {
        ws.send(JSON.stringify({ type: 'exit', code: exitCode }));
      } catch {
        /* ignore */
      }
      try {
        ws.close(4000, 'pty exited');
      } catch {
        ws.terminate();
      }
    }
    cleanup();
  });

  // WS → PTY. Never crash on a malformed message.
  ws.on('message', (raw) => {
    resetIdle();
    if (!term) return;
    let msg;
    try {
      msg = JSON.parse(typeof raw === 'string' ? raw : raw.toString('utf8'));
    } catch {
      return; // ignore non-JSON frames
    }
    if (!msg || typeof msg !== 'object') return;

    if (msg.type === 'input' && typeof msg.data === 'string') {
      try {
        term.write(msg.data);
      } catch {
        /* pty gone */
      }
    } else if (msg.type === 'resize') {
      const cols = Number(msg.cols);
      const rows = Number(msg.rows);
      if (
        Number.isInteger(cols) &&
        Number.isInteger(rows) &&
        cols > 0 &&
        rows > 0 &&
        cols <= 1000 &&
        rows <= 1000
      ) {
        try {
          term.resize(cols, rows);
        } catch {
          /* pty gone */
        }
      }
    }
  });

  ws.on('close', (code) => {
    log('session closed', { user, ip, code });
    cleanup();
  });

  ws.on('error', (err) => {
    log('ws error', {
      user,
      ip,
      error: err instanceof Error ? err.message : String(err),
    });
    cleanup();
  });
}

// ---------------------------------------------------------------------------
// Startup banner / config sanity (reads dashboard.env values from env)
// ---------------------------------------------------------------------------

function startupCheck() {
  // Touch dbConfig so a missing DB_PASSWORD fails fast at boot, not on first WS.
  try {
    dbConfig();
  } catch (err) {
    log('FATAL: db config invalid', {
      error: err instanceof Error ? err.message : String(err),
    });
    process.exit(1);
  }
  if (!ALLOWED_ORIGIN) {
    log('WARNING: ALLOWED_ORIGIN is not set; cross-site WS protection disabled');
  }
}

// ---------------------------------------------------------------------------
// Graceful shutdown
// ---------------------------------------------------------------------------

let shuttingDown = false;
function shutdown(signal) {
  if (shuttingDown) return;
  shuttingDown = true;
  log('shutdown', { signal });
  for (const client of wss.clients) {
    try {
      client.close(1012, 'server restarting');
    } catch {
      client.terminate();
    }
  }
  wss.close(() => {
    httpServer.close(() => process.exit(0));
  });
  // Hard exit if anything hangs.
  setTimeout(() => process.exit(0), 5000).unref();
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
// Never let an unexpected error take the whole sidecar down silently.
process.on('uncaughtException', (err) => {
  log('uncaughtException', { error: err.message });
});
process.on('unhandledRejection', (reason) => {
  log('unhandledRejection', { reason: String(reason) });
});

startupCheck();
httpServer.listen(PORT, HOST, () => {
  log('listening', {
    host: HOST,
    port: PORT,
    shell: SHELL,
    idleSec: IDLE_SEC,
    originEnforced: Boolean(ALLOWED_ORIGIN),
  });
});
