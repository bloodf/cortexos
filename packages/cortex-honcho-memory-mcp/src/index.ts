#!/usr/bin/env node
import process from 'node:process';
import pc from 'picocolors';
import { runStdioServer } from './server.js';

function getEnv(): { cwd: string; baseUrl: string; apiKey?: string } {
  const cwd = process.env.CORTEX_HONCHO_CWD ?? process.cwd();
  const baseUrl = process.env.HONCHO_BASE_URL ?? 'http://127.0.0.1:18690';
  const apiKey = process.env.HONCHO_API_KEY;

  if (!baseUrl) {
    console.error(pc.red('[cortex-honcho-memory] HONCHO_BASE_URL is not set'));
    process.exit(1);
  }

  return { cwd, baseUrl, apiKey };
}

async function main(): Promise<void> {
  const env = getEnv();
  await runStdioServer(env);
}

main().catch((err: unknown) => {
  console.error(pc.red('[cortex-honcho-memory] fatal error'), err);
  process.exit(1);
});
