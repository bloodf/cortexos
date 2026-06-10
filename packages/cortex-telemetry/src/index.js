// @cortexos/telemetry — thin wrapper over @traceloop/node-server-sdk and
// langfuse. One-call `instrument({ service, env })` initialises OpenLLMetry
// + a singleton Langfuse client. `traceLLMCall` wraps an LLM invocation so
// inputs / outputs / latency / token-usage land on a Langfuse trace.
//
// Hard requirement: when LANGFUSE_HOST is unset the entire module becomes a
// no-op. Services that import this package must remain safe to boot in
// dev/test environments where no observability stack is running.

import process from 'node:process';

let __initialized = false;
let __traceloop = null;
let __langfuse = null;
let __config = null;

function envFlag(name, fallback = false) {
  const v = process.env[name];
  if (v === undefined || v === '') return fallback;
  return v === '1' || v.toLowerCase() === 'true';
}

function readConfig({ service, env } = {}) {
  const host = process.env.LANGFUSE_HOST || '';
  const publicKey = process.env.LANGFUSE_PUBLIC_KEY || '';
  const secretKey = process.env.LANGFUSE_SECRET_KEY || '';
  return {
    enabled: Boolean(host && publicKey && secretKey),
    host,
    publicKey,
    secretKey,
    service: service || process.env.CORTEX_TELEMETRY_SERVICE || 'cortexos',
    env: env || process.env.CORTEX_TELEMETRY_ENV || process.env.NODE_ENV || 'production',
    disabledByFlag: envFlag('CORTEX_TELEMETRY_DISABLED', false),
  };
}

function langfuseOtelHeaders(publicKey, secretKey) {
  return {
    Authorization: `Basic ${Buffer.from(`${publicKey}:${secretKey}`).toString('base64')}`,
    'x-langfuse-ingestion-version': '4',
  };
}

/**
 * Initialise OpenLLMetry + Langfuse. Idempotent. Safe to call from every
 * service boot path — second and subsequent calls are no-ops. When
 * `LANGFUSE_HOST` is unset or `CORTEX_TELEMETRY_DISABLED=1`, the function
 * returns without loading any SDK.
 *
 * @param {{ service?: string, env?: string }} [opts]
 * @returns {{ enabled: boolean, service: string, env: string }}
 */
export function instrument(opts = {}) {
  if (__initialized) {
    return { enabled: Boolean(__config?.enabled), service: __config?.service, env: __config?.env };
  }
  const cfg = readConfig(opts);
  __config = cfg;
  __initialized = true;
  if (cfg.disabledByFlag || !cfg.enabled) {
    return { enabled: false, service: cfg.service, env: cfg.env };
  }
  try {
    // Lazy-load so the dependency cost is paid only when telemetry is on.

    const traceloopMod = requireOptional('@traceloop/node-server-sdk');
    const langfuseMod = requireOptional('langfuse');
    if (!traceloopMod || !langfuseMod) {
      __config = { ...cfg, enabled: false };
      return { enabled: false, service: cfg.service, env: cfg.env };
    }
    traceloopMod.initialize({
      appName: cfg.service,
      apiKey: cfg.secretKey,
      baseUrl: `${cfg.host.replace(/\/$/, '')}/api/public/otel`,
      headers: langfuseOtelHeaders(cfg.publicKey, cfg.secretKey),
      disableBatch: cfg.env !== 'production',
    });
    const LangfuseCtor =
      langfuseMod.Langfuse || langfuseMod.default?.Langfuse || langfuseMod.default;
    __langfuse = new LangfuseCtor({
      publicKey: cfg.publicKey,
      secretKey: cfg.secretKey,
      baseUrl: cfg.host,
      flushAt: 1,
    });
    __traceloop = traceloopMod;
    return { enabled: true, service: cfg.service, env: cfg.env };
  } catch (err) {
    process.stderr.write(`[telemetry] init failed: ${err.message}\n`);
    __config = { ...cfg, enabled: false };
    return { enabled: false, service: cfg.service, env: cfg.env };
  }
}

function requireOptional(name) {
  try {
    // Use createRequire so the package stays ESM-pure while still allowing
    // optional dependency loading.

    const { createRequire } = globalThis.__cortexTelemetryRequire || _loadCreateRequire();
    const req = createRequire(import.meta.url);
    return req(name);
  } catch {
    return null;
  }
}

function _loadCreateRequire() {
  // Hoist to avoid repeated dynamic import cost. Stored on globalThis so the
  // test suite can swap it for a stub.

  const mod = { createRequire: undefined };
  try {
    // node:module is built-in; require() it via Node's CJS shim.
    const m = process.getBuiltinModule ? process.getBuiltinModule('node:module') : null;
    if (m && typeof m.createRequire === 'function') {
      mod.createRequire = m.createRequire;
    }
  } catch {
    /* fall through */
  }
  globalThis.__cortexTelemetryRequire = mod;
  return mod;
}

/**
 * Wrap an LLM invocation with a Langfuse generation span. The handler runs
 * regardless of telemetry state. When telemetry is disabled the call passes
 * through with zero overhead beyond a single boolean check.
 *
 * @template T
 * @param {{
 *   name: string,
 *   model?: string,
 *   input?: unknown,
 *   metadata?: Record<string, unknown>,
 *   userId?: string,
 *   sessionId?: string,
 *   tags?: string[],
 * }} spec
 * @param {() => Promise<T>} handler
 * @returns {Promise<T>}
 */
export async function traceLLMCall(spec, handler) {
  if (typeof handler !== 'function') {
    throw new TypeError('traceLLMCall: handler must be a function');
  }
  if (!__initialized) instrument();
  if (!__config?.enabled || !__langfuse) {
    return handler();
  }
  const startedAt = new Date();
  const trace = __langfuse.trace({
    name: spec.name,
    userId: spec.userId,
    sessionId: spec.sessionId,
    tags: spec.tags,
    metadata: { ...(spec.metadata || {}), service: __config.service, env: __config.env },
  });
  const generation = trace.generation({
    name: spec.name,
    model: spec.model,
    input: spec.input,
    startTime: startedAt,
  });
  try {
    const result = await handler();
    const output = extractOutput(result);
    const usage = extractUsage(result);
    generation.end({
      endTime: new Date(),
      output,
      usage,
    });
    return result;
  } catch (err) {
    generation.end({
      endTime: new Date(),
      level: 'ERROR',
      statusMessage: err?.message || String(err),
    });
    throw err;
  }
}

function extractOutput(result) {
  if (!result || typeof result !== 'object') return result;
  if ('output' in result) return result.output;
  if ('text' in result) return result.text;
  if ('content' in result) return result.content;
  return result;
}

function extractUsage(result) {
  if (!result || typeof result !== 'object') return undefined;
  const u = result.usage || result.token_usage || result.tokenUsage;
  if (!u || typeof u !== 'object') return undefined;
  return {
    input: u.input ?? u.prompt_tokens ?? u.inputTokens,
    output: u.output ?? u.completion_tokens ?? u.outputTokens,
    total: u.total ?? u.total_tokens ?? u.totalTokens,
    unit: u.unit || 'TOKENS',
  };
}

/**
 * Force-flush buffered telemetry. Call from graceful-shutdown handlers so
 * in-flight spans land before the process exits.
 */
export async function shutdown() {
  if (!__initialized || !__config?.enabled) return;
  try {
    if (__langfuse?.shutdownAsync) await __langfuse.shutdownAsync();
  } catch {
    /* best effort */
  }
  try {
    if (__traceloop?.forceFlush) await __traceloop.forceFlush();
  } catch {
    /* best effort */
  }
}

/** Internal: test reset hook. */
export function __resetForTests() {
  __initialized = false;
  __traceloop = null;
  __langfuse = null;
  __config = null;
}

/** Internal: peek at the resolved configuration. */
export function __getConfigForTests() {
  return __config;
}
