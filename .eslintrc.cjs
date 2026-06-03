// CortexOS — legacy ESLint config (.eslintrc.cjs)
//
// ESLint 9 uses flat config (eslint.config.js) as the canonical format.
// This file exists ONLY for forward-compat with any tooling (e.g. older
// editor integrations, npm scripts that hardcode `--ext`) that still
// expects a .eslintrc file.
//
// All real configuration lives in `eslint.config.js` at the repo root.
// This file is a no-op that defers to flat config.
//
// The `root: true` flag tells ESLint to stop looking for config files
// in parent directories.

module.exports = {
  root: true,
  // Intentionally empty — see eslint.config.js for the real config.
  rules: {},
  // Force-extend from the flat config if a tool loads this file:
  extends: [],
};
