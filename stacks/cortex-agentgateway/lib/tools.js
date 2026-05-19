// Tool registry: loads tools.json, exposes lookup, and resolves role-based
// permissions. Pure module — no I/O beyond initial file read.

import { readFileSync } from "node:fs";

export function loadToolsConfig(path) {
  const raw = readFileSync(path, "utf8");
  const parsed = JSON.parse(raw);
  if (!parsed || typeof parsed !== "object") {
    throw new Error(`invalid tools config at ${path}`);
  }
  if (!Array.isArray(parsed.tools)) {
    throw new Error(`tools config missing 'tools' array at ${path}`);
  }
  const byName = new Map();
  for (const t of parsed.tools) {
    if (!t.name || typeof t.name !== "string") {
      throw new Error("tool entry missing 'name'");
    }
    byName.set(t.name, t);
  }
  return {
    raw: parsed,
    policyVersion: parsed.policy_version,
    toolClasses: parsed.tool_classes || {},
    roles: parsed.roles || {},
    tools: parsed.tools,
    byName,
  };
}

/**
 * Resolve whether a role may invoke a tool. Returns:
 *   { allowed: boolean, reason?: string, toolClass?: string }
 * Implements:
 *   - unknown tool → deny
 *   - unknown role → deny
 *   - safe role list may be "*" (wildcard) or array; matched against tool name
 *   - privileged / destructive lists are explicit arrays only
 *   - tool class is taken from the tool definition; role declarations are
 *     allow-list scopes within the class
 */
export function resolvePermission(config, { role, tool }) {
  if (!tool || typeof tool !== "string") {
    return { allowed: false, reason: "tool required" };
  }
  const def = config.byName.get(tool);
  if (!def) return { allowed: false, reason: "unknown tool" };

  const roleDef = config.roles[role];
  if (!roleDef) return { allowed: false, reason: "unknown role", toolClass: def.class };

  const toolClass = def.class;
  const scope = roleDef[toolClass];
  if (scope === undefined) {
    return { allowed: false, reason: `role lacks ${toolClass} scope`, toolClass };
  }
  if (scope === "*") return { allowed: true, toolClass };
  if (Array.isArray(scope) && scope.includes(tool)) {
    return { allowed: true, toolClass };
  }
  return { allowed: false, reason: "tool not in role allow-list", toolClass };
}
