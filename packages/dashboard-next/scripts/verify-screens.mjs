#!/usr/bin/env node
/**
 * verify-screens.mjs — headless-browser RENDER verification of the live
 * dashboard-next app (:3080). Proves each authed screen actually renders real
 * content, not just returns HTTP 200.
 *
 * READ-ONLY against app source. This script only mints a throwaway admin
 * session row in Postgres (deleted in a finally block), drives a real Chromium
 * via Playwright, and screenshots every route.
 *
 * Usage:
 *   node scripts/verify-screens.mjs
 *
 * Requirements (dev-only tooling, already installed):
 *   - playwright + chromium  (pnpm --filter @cortexos/dashboard-next add -D playwright)
 *   - pg (transitive dep)
 *   - DB_* creds sourced into env (see /opt/cortexos/.secrets/dashboard.env)
 *
 * Exit code: 0 if every route PASSes, 1 if any FAILs (or a fatal setup error).
 */

import { chromium } from 'playwright';
import pg from 'pg';
import { randomBytes } from 'node:crypto';
import { mkdirSync } from 'node:fs';

const BASE_URL = process.env.BASE_URL ?? 'http://127.0.0.1:3080';
const SHOT_DIR = '/tmp/pw-verify';
const USER_ID = 3; // 'cortexos' — an admin
const NAV_TIMEOUT = 20_000;

// The authed routes to verify, with the landmark each must render.
// `landmark` is a Playwright locator string asserted visible after load.
const ROUTES = [
  { path: '/overview', landmark: 'main#main-content' },
  { path: '/apps', landmark: 'main#main-content' },
  { path: '/healthcheck', landmark: 'main#main-content' },
  { path: '/docker', landmark: 'main#main-content' },
  { path: '/incus', landmark: 'main#main-content' },
  { path: '/systemd', landmark: 'main#main-content' },
  { path: '/network', landmark: 'main#main-content' },
  { path: '/storage', landmark: 'main#main-content' },
  { path: '/processes', landmark: 'main#main-content' },
  { path: '/mail-guardian', landmark: 'main#main-content' },
  { path: '/approvals', landmark: 'main#main-content' },
  { path: '/audit', landmark: 'main#main-content' },
  { path: '/alerts', landmark: 'main#main-content' },
  { path: '/agents', landmark: 'main#main-content' },
  { path: '/admin/services', landmark: 'main#main-content' },
  { path: '/admin/env-browser', landmark: 'main#main-content' },
  { path: '/admin/account', landmark: 'main#main-content' },
  { path: '/terminal', landmark: 'main#main-content' },
];

// Error-boundary signatures (root + per-route) that count as a render FAIL.
const ERROR_SIGNATURES = [
  "This page didn't load", // __root.tsx ErrorComponent
  'Something went wrong', // i18n error string / lib/error-page
  'Failed to load', // common per-route errorComponent copy
  'Unable to load',
];

function fileFor(routePath) {
  const slug = routePath.replace(/^\//, '').replace(/\//g, '_') || 'root';
  return `${SHOT_DIR}/${slug}.png`;
}

async function mintSession(client, token, csrf) {
  const nowMs = Date.now();
  await client.query(
    `INSERT INTO admin_sessions
       (user_id, token, expires_at, created_at, is_admin, csrf_token, ip, user_agent, last_role_check_at, touched_at)
     VALUES
       ($1, $2, now() + interval '2 hours', now(), true, $3, '127.0.0.1', 'pw-verify', $4, now())`,
    [USER_ID, token, csrf, nowMs],
  );
}

async function deleteSession(client, token) {
  await client.query(`DELETE FROM admin_sessions WHERE token = $1`, [token]);
}

async function main() {
  mkdirSync(SHOT_DIR, { recursive: true });

  const dbCfg = {
    host: process.env.DB_HOST ?? '127.0.0.1',
    port: Number(process.env.DB_PORT ?? 5432),
    database: process.env.DB_NAME ?? 'cortex_dashboard',
    user: process.env.DB_USER ?? 'dashboard',
    password: process.env.DB_PASSWORD,
  };
  if (!dbCfg.password) {
    console.error('FATAL: DB_PASSWORD not in env. Source /opt/cortexos/.secrets/dashboard.env first.');
    process.exit(1);
  }

  const client = new pg.Client(dbCfg);
  await client.connect();

  const token = randomBytes(32).toString('base64url');
  const csrf = randomBytes(32).toString('base64url');

  // Playwright cannot install its own Chromium on this OS (ubuntu26.04-x64 is
  // unsupported by the prebuilt binaries). Drive the system snap Chromium's
  // *raw* binary directly (bypassing the snap wrapper, which has mount-ns
  // confinement issues). CHROME_BIN can override.
  const executablePath =
    process.env.CHROME_BIN ?? '/snap/chromium/current/usr/lib/chromium-browser/chrome';
  const browser = await chromium.launch({
    headless: true,
    executablePath,
    args: ['--no-sandbox', '--disable-gpu', '--disable-dev-shm-usage'],
  });
  const results = [];

  try {
    await mintSession(client, token, csrf);

    const context = await browser.newContext({
      baseURL: BASE_URL,
      ignoreHTTPSErrors: true,
    });
    await context.addCookies([
      { name: 'cortexos_session', value: token, domain: '127.0.0.1', path: '/' },
      { name: 'cortexos_csrf', value: csrf, domain: '127.0.0.1', path: '/' },
    ]);

    for (const route of ROUTES) {
      const page = await context.newPage();
      const consoleErrors = [];
      const failedRequests = [];

      page.on('console', (msg) => {
        if (msg.type() === 'error') consoleErrors.push(msg.text());
      });
      page.on('pageerror', (err) => {
        consoleErrors.push(`[pageerror] ${err.message}`);
      });
      page.on('requestfailed', (req) => {
        const f = req.failure();
        failedRequests.push(`${req.method()} ${req.url()} — ${f ? f.errorText : 'unknown'}`);
      });
      const badResponses = [];
      page.on('response', async (resp) => {
        const status = resp.status();
        const url = resp.url();
        // Flag any non-2xx/3xx response to a same-origin server-fn / data call.
        // Static assets (js/css/png/woff) are ignored — only API-ish calls.
        const isAsset = /\.(js|css|png|jpg|jpeg|svg|woff2?|ico|map)(\?|$)/.test(url);
        if (status >= 400 && !isAsset) {
          let body = '';
          try {
            body = (await resp.text()).slice(0, 400);
          } catch {
            body = '<unreadable>';
          }
          badResponses.push({
            status,
            method: resp.request().method(),
            url,
            body,
          });
        }
        if (status >= 500) {
          failedRequests.push(`HTTP ${status} ${resp.request().method()} ${url}`);
        }
      });

      const reasons = [];
      let finalUrl = '';
      try {
        const resp = await page.goto(route.path, {
          waitUntil: 'networkidle',
          timeout: NAV_TIMEOUT,
        });
        // Allow late client renders / query settling.
        await page.waitForTimeout(1200);
        finalUrl = page.url();

        // 1. No redirect to /login.
        if (/\/login(\?|$)/.test(finalUrl)) {
          reasons.push(`redirected to login (${finalUrl}) — cookie/session not accepted`);
        }

        // HTTP status of the document.
        if (resp && resp.status() >= 400) {
          reasons.push(`document HTTP ${resp.status()}`);
        }

        // 2. No error boundary text on screen.
        const bodyText = (await page.locator('body').innerText().catch(() => '')) || '';
        for (const sig of ERROR_SIGNATURES) {
          if (bodyText.includes(sig)) {
            reasons.push(`error-boundary text present: "${sig}"`);
          }
        }

        // 4. Landmark renders with real content (only meaningful if not redirected).
        if (!/\/login(\?|$)/.test(finalUrl)) {
          const landmark = page.locator(route.landmark).first();
          const visible = await landmark.isVisible().catch(() => false);
          if (!visible) {
            reasons.push(`landmark not visible: ${route.landmark}`);
          } else {
            const inner = (await landmark.innerText().catch(() => '')) || '';
            if (inner.trim().length < 2) {
              reasons.push(`landmark empty (no rendered content)`);
            }
          }
        }

        // 3. Console errors / failed requests are FAILs.
        if (consoleErrors.length > 0) {
          reasons.push(`${consoleErrors.length} console error(s)`);
        }
        if (badResponses.length > 0) {
          reasons.push(`${badResponses.length} 4xx/5xx server-fn response(s)`);
        }
        if (failedRequests.length > 0) {
          reasons.push(`${failedRequests.length} failed/5xx request(s)`);
        }
      } catch (err) {
        reasons.push(`navigation threw: ${err.message}`);
        finalUrl = page.url();
      }

      const shot = fileFor(route.path);
      await page.screenshot({ path: shot, fullPage: true }).catch(() => {});

      results.push({
        path: route.path,
        pass: reasons.length === 0,
        finalUrl,
        reasons,
        consoleErrors: consoleErrors.slice(0, 8),
        failedRequests: failedRequests.slice(0, 8),
        badResponses: badResponses.slice(0, 8),
        shot,
      });

      await page.close();
    }

    await context.close();
  } finally {
    await deleteSession(client, token).catch((e) =>
      console.error('cleanup: failed to delete session row:', e.message),
    );
    await browser.close().catch(() => {});
    await client.end().catch(() => {});
  }

  // ---- Report ----
  const pad = (s, n) => String(s).padEnd(n);
  console.log('\n=== PER-ROUTE VERDICT ===\n');
  console.log(pad('ROUTE', 22) + pad('VERDICT', 9) + 'DETAIL');
  console.log('-'.repeat(80));
  let failCount = 0;
  for (const r of results) {
    const verdict = r.pass ? 'PASS' : 'FAIL';
    if (!r.pass) failCount++;
    const detail = r.pass ? `(${r.finalUrl})` : r.reasons.join('; ');
    console.log(pad(r.path, 22) + pad(verdict, 9) + detail);
  }

  console.log('\n=== FAIL DETAIL ===');
  const fails = results.filter((r) => !r.pass);
  if (fails.length === 0) {
    console.log('none — all routes rendered.');
  } else {
    for (const r of fails) {
      console.log(`\n## ${r.path}  (final: ${r.finalUrl})`);
      console.log(`  reasons: ${r.reasons.join('; ')}`);
      if (r.consoleErrors.length) {
        console.log('  console errors:');
        for (const e of r.consoleErrors) console.log(`    - ${e}`);
      }
      if (r.failedRequests.length) {
        console.log('  failed/5xx requests:');
        for (const f of r.failedRequests) console.log(`    - ${f}`);
      }
      console.log(`  screenshot: ${r.shot}`);
    }
  }

  console.log(`\n=== SUMMARY: ${results.length - failCount}/${results.length} PASS, ${failCount} FAIL ===`);
  console.log(`Screenshots: ${SHOT_DIR}/`);
  process.exit(failCount === 0 ? 0 : 1);
}

main().catch((err) => {
  console.error('FATAL:', err);
  process.exit(1);
});
