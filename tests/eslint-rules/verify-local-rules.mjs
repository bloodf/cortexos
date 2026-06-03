#!/usr/bin/env node
// tests/eslint-rules/verify-local-rules.mjs
//
// One-shot verification of the three local ESLint rules. Runs the rules
// against fixture files and asserts each one fires as expected.
//
// Usage:  node tests/eslint-rules/verify-local-rules.mjs
//
// Exit 0 = all rules fired correctly.
// Exit 1 = something didn't match expectations.

import { Linter } from 'eslint';
import customRules from '../../packages/dashboard/eslint-rules/index.js';

const linter = new Linter();

const pluginConfig = {
  files: ['**/*.ts', '**/*.svelte', '**/*.js'],
  plugins: { local: { rules: customRules } },
  languageOptions: { ecmaVersion: 2024, sourceType: 'module' },
};

const cases = [
  {
    name: 'no-bash-c-in-template: simple Literal',
    code: `const x = 'bash -c "id"';`,
    filename: 'fixture.js',
    expectRule: 'local/no-bash-c-in-template',
    expectCount: 1,
  },
  {
    name: 'no-bash-c-in-template: template literal',
    code: 'const x = `bash -c "rm -rf /"`;',
    filename: 'fixture.js',
    expectRule: 'local/no-bash-c-in-template',
    expectCount: 1,
  },
  {
    name: 'no-bash-c-in-template: safe string passes',
    code: `const x = 'id'; const y = 'whoami';`,
    filename: 'fixture.js',
    expectRule: 'local/no-bash-c-in-template',
    expectCount: 0,
  },
  {
    name: 'require-admin-on-privileged-route: missing guard',
    code: `export const GET = async () => { const rows = []; return rows; };`,
    filename: 'fixture.ts',
    expectRule: 'local/require-admin-on-privileged-route',
    expectCount: 1,
  },
  {
    name: 'require-admin-on-privileged-route: with guard passes',
    code: `import { requireAdmin } from 'auth';
export const GET = async () => { await requireAdmin(); return []; };`,
    filename: 'fixture.ts',
    expectRule: 'local/require-admin-on-privileged-route',
    expectCount: 0,
  },
  {
    name: 'no-requireauth-in-admin: requireAuth fires',
    code: `import { requireAuth } from 'auth';
export const GET = async () => { await requireAuth(); return []; };`,
    filename: 'fixture.ts',
    expectRule: 'local/no-requireauth-in-admin',
    expectCount: 1,
  },
  {
    name: 'no-requireauth-in-admin: requireAdmin does not fire',
    code: `import { requireAdmin } from 'auth';
export const GET = async () => { await requireAdmin(); return []; };`,
    filename: 'fixture.ts',
    expectRule: 'local/no-requireauth-in-admin',
    expectCount: 0,
  },
];

let failures = 0;
for (const c of cases) {
  const messages = linter.verify(
    c.code,
    [{ ...pluginConfig, rules: { [c.expectRule]: 'error' } }],
    { filename: c.filename },
  );
  const matched = messages.filter((m) => m.ruleId === c.expectRule);
  const ok = matched.length === c.expectCount;
  const status = ok ? 'PASS' : 'FAIL';
  console.log(`[${status}] ${c.name} — got ${matched.length}, expected ${c.expectCount}`);
  if (!ok) {
    failures += 1;
    for (const m of messages) {
      console.log(`    ${m.ruleId}: ${m.message}`);
    }
  }
}

if (failures > 0) {
  console.error(`\n${failures} case(s) failed.`);
  process.exit(1);
}
console.log(`\nAll ${cases.length} cases passed.`);
