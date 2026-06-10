/**
 * Scoped file operations for Hermes agent profile directories (WP-21).
 *
 * All writes are constrained to the profile's `home` directory.
 * Path traversal is double-checked: once before resolve (reject `..` and
 * absolute paths) and once after resolve (resolved path must be a child of
 * `agentDir`). Both checks are required — skipping either allows symlink or
 * encoded-slash attacks.
 */

import fs from "node:fs";
import path from "node:path";

// ---------------------------------------------------------------------------
// Path traversal guard
// ---------------------------------------------------------------------------

/**
 * Validate a caller-supplied filename relative to `agentDir`.
 * Returns the resolved absolute target path.
 * Throws Error('path_traversal') if the path is unsafe.
 * Throws Error('path_traversal') if the path escapes `agentDir`.
 */
export function validateFilePath(agentDir: string, filename: string): string {
  // Belt-and-suspenders: reject before resolve
  if (filename.includes("..") || filename.startsWith("/")) {
    throw new Error("path_traversal");
  }
  const target = path.resolve(agentDir, filename);
  // After resolve: resolved path must still be inside agentDir
  if (!target.startsWith(agentDir + path.sep) && target !== agentDir) {
    throw new Error("path_traversal");
  }
  return target;
}

// ---------------------------------------------------------------------------
// File operations
// ---------------------------------------------------------------------------

/**
 * List non-hidden files in the profile directory (non-recursive).
 * Returns empty array if the directory does not exist.
 */
export function listAgentFiles(agentDir: string): string[] {
  if (!fs.existsSync(agentDir)) return [];
  return fs
    .readdirSync(agentDir)
    .filter((name) => !name.startsWith("."))
    .sort();
}

/**
 * Write `data` to `filename` inside `agentDir`.
 * Creates intermediate directories if needed.
 * Throws Error('path_traversal') if the resolved path escapes `agentDir`.
 */
export function writeAgentFile(agentDir: string, filename: string, data: Buffer): void {
  const target = validateFilePath(agentDir, filename);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, data);
}

/**
 * Delete `filename` inside `agentDir`.
 * Throws Error('path_traversal') if unsafe.
 * Throws Error('not_found') if the file does not exist.
 */
export function deleteAgentFile(agentDir: string, filename: string): void {
  const target = validateFilePath(agentDir, filename);
  if (!fs.existsSync(target)) throw new Error("not_found");
  fs.unlinkSync(target);
}
