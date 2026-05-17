import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
  // Test files: loosen rules so mock typing doesn't block CI.
  {
    files: [
      "**/*.test.ts",
      "**/*.test.tsx",
      "**/__tests__/**/*.ts",
      "**/__tests__/**/*.tsx",
      "vitest.setup.ts",
    ],
    rules: {
      "@typescript-eslint/no-explicit-any": "off",
      "@typescript-eslint/no-unused-vars": "warn",
      "@typescript-eslint/no-require-imports": "off",
    },
  },
  // Pre-compiled CJS migration runner ships with the standalone bundle.
  {
    files: ["scripts/migrate.js"],
    rules: {
      "@typescript-eslint/no-require-imports": "off",
    },
  },
  // TODO: refactor useEffect patterns; see .tmp-validation/REPORT.md action item #7.
  {
    rules: {
      "react-hooks/set-state-in-effect": "warn",
      "react-hooks/static-components": "warn",
      "react-hooks/immutability": "warn",
    },
  },
]);

export default eslintConfig;
