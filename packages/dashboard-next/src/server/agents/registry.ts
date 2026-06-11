/**
 * Hermes profiles registry reader (WP-21).
 *
 * Reads HERMES_PROFILES_REGISTRY (default /opt/cortexos/hermes/profiles.json)
 * and exposes the parsed profile list. Each entry from the registry JSON is
 * typed; the `home` field is the profile directory used for scoped file ops.
 *
 * No caching — reads the filesystem on every call (Wave-4 optimisation).
 */

import fs from "node:fs";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const DEFAULT_REGISTRY_PATH = "/opt/cortexos/hermes/profiles.json";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** A single entry from profiles.json `profiles` array. */
export interface HermesProfile {
  /** Profile slug — e.g. "default", "cleo". */
  profile: string;
  /** Absolute path to this profile's home directory. */
  home: string;
  /** Hermes API port for this profile. */
  apiPort?: number;
  /** Model ID, e.g. "cx/gpt-5.5". */
  model?: string;
  /** Reasoning level, e.g. "medium". */
  reasoning?: string;
  /** Honcho workspace name. */
  honchoWorkspace?: string;
  /** Path to secrets env file. */
  secretPath?: string;
  /** Associated app slugs. */
  apps?: string[];
}

/** Shape of profiles.json. */
interface ProfilesRegistry {
  profiles: HermesProfile[];
}

// ---------------------------------------------------------------------------
// Registry path
// ---------------------------------------------------------------------------

export function getRegistryPath(): string {
  return process.env.HERMES_PROFILES_REGISTRY ?? DEFAULT_REGISTRY_PATH;
}

// ---------------------------------------------------------------------------
// Readers
// ---------------------------------------------------------------------------

/**
 * Read and parse the profiles registry JSON.
 * Returns an empty array if the file is missing or unreadable.
 */
export function readRegistry(): HermesProfile[] {
  const registryPath = getRegistryPath();
  try {
    const raw = fs.readFileSync(registryPath, "utf8");
    const parsed = JSON.parse(raw) as ProfilesRegistry;
    if (!Array.isArray(parsed?.profiles)) return [];
    return parsed.profiles.filter(
      (p) => typeof p.profile === "string" && typeof p.home === "string",
    );
  } catch {
    return [];
  }
}

/**
 * Find a single profile by slug. Returns null if not found.
 */
export function findProfileBySlug(slug: string): HermesProfile | null {
  return readRegistry().find((p) => p.profile === slug) ?? null;
}
