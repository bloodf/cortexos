/**
 * Incus bridge — server-side dispatcher for Incus instance operations.
 *
 * Mirrors the role of `systemd/bridge.ts` and `terminal/pty-bridge.ts`:
 * a swappable `IncusExecutor` interface sits behind a strict policy
 * gate, every action is audit-logged, and the destructive subset
 * (`stop`, `restart`, `delete`) requires an approval token bound to
 * the (action, name) action-hash (PB-5).
 *
 * M2 ships a `MockIncusExecutor` — an in-memory `Map<name, IncusInstance>`
 * the executor mutates. The M3 swap is the real `incus` CLI (or unix
 * socket) with the same `(ctx) => Promise<IncusExecutorResult>` shape.
 *
 * Hard rules (THREAT_MODEL v0.3 + PB-4 + PB-5 + SR-019):
 *   - Every instance name is regex-validated AND check against the
 *     allowlist table (the instance's `allowlisted` flag from the
 *     mock).
 *   - Admin-gated: every `dispatch*` call requires `isAdmin(user)`.
 *   - Destructive actions (`stop`, `restart`, `delete`) require an
 *     approval token whose `actionHash` matches `actionHashFor(
 *     'incus.' + action, { name })` (PB-5).
 *   - PB-4: the exec-named route is a separate allowlist-driven
 *     path; the bridge re-runs the policy + arg-smuggling guards
 *     from `terminal/pty-bridge.ts` and never produces a
 *     `bash -c <userstring>` argv (SR-019).
 *
 * Public surface:
 *   - listInstances()                      → IncusInstance[]
 *   - getInstance(name)                    → IncusInstance | null
 *   - listInstanceLogs(name, limit)        → IncusLogLine[]
 *   - listInstanceActions()                → readonly AllowlistEntry[]
 *   - listImages()                         → IncusImage[]
 *   - runPreflightReport(config)           → IncusPreflightReport
 *   - dispatchAction(input, ctx)           → DispatchResult
 *   - dispatchExecNamed(input, ctx)        → ExecDispatchResult
 *   - setExecutorForTests(fn)              → test helper
 */
import {
  type IncusInstance,
  type IncusImage,
  type IncusInstanceStatus,
  type IncusShellOp,
  type IncusPreflightReport,
  type IncusPreflightCheck,
  type ProgressStep,
  type IncusInstanceConfig,
} from "@cortexos/contracts";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { audit } from "../audit";
import { actionHashFor } from "../approval";
import { allowlistedCommand, type AllowlistEntry } from "../policy";
import type { User } from "../entities";

/**
 * Local log-line shape. The contracts package does not export an
 * `IncusLogLine` (Incus logs are not on the M2 contracts surface);
 * the bridge defines the wire shape and projects it to the UI.
 */
export interface IncusLogLine {
  ts: string;
  priority: "info" | "warn" | "error" | "debug";
  name: string;
  message: string;
}

const execFileAsync = promisify(execFile);

// ---------------------------------------------------------------------------
// Executor interface — the seam between M2 (mock) and M3 (incus CLI).
// ---------------------------------------------------------------------------

/**
 * The argv-free context the executor sees. Mirrors the contracts
 * `IncusInstance` plus caller metadata. The executor is a pure
 * function of (instance, action, user) → side effect + result.
 */
export interface IncusExecutorContext {
  /** The instance the action targets. */
  instance: IncusInstance;
  /** The action being performed. */
  action: IncusActionKind;
  /** The user on whose behalf the action runs. */
  user: User;
  /** Client IP, recorded for the audit log. */
  ip: string;
  /** Request id, echoed in the audit row. */
  requestId: string;
}

/**
 * The result the executor returns. Mirrors `IncusActionResult` plus
 * a friendly message for the UI and the updated instance snapshot
 * (so the UI can re-render without a refetch).
 */
export interface IncusExecutorResult {
  stdout: string;
  stderr: string;
  exitCode: number;
  /** The updated instance snapshot. */
  instance: IncusInstance;
}

/**
 * The swappable executor. M2 ships `MockIncusExecutor`; M3 will ship
 * `IncusCLIExecutor` that runs the real `incus` via the root helper.
 */
export type IncusExecutor = (ctx: IncusExecutorContext) => Promise<IncusExecutorResult>;

/**
 * Mirrors the `IncusActionKind` union from @cortexos/contracts,
 * re-declared so the Svelte components can exhaustively switch over
 * actions without resolving the Zod-inferred type.
 */
export type IncusActionKind =
  | "start"
  | "stop"
  | "restart"
  | "delete"
  | "launch"
  | "list"
  | "exec-named";

// ---------------------------------------------------------------------------
// Mock executor (M2). In-memory, deterministic, no shell.
// ---------------------------------------------------------------------------

/** A single Incus log line. Mirrors the contracts shape. */
export interface IncusLogLineEntry {
  ts: string;
  priority: "info" | "warn" | "error" | "debug";
  name: string;
  message: string;
}

/** Snapshot row stored in the mock. */
interface MockInstanceRecord extends IncusInstance {
  /** Allowlist flag — gating the bridge's allowlist check. */
  allowlisted: boolean;
  /** Live state fields populated by `incus list` for the live view. */
  live?: {
    status: string;
    statusCode: IncusInstanceStatus;
    architecture: string;
    state: {
      networks: Record<
        string,
        {
          addresses: {
            family: "inet" | "inet6";
            address: string;
            scope?: "global" | "link" | "local";
          }[];
          state?: string;
          type?: string;
        }
      >;
      pid?: number;
    };
    profiles: string[];
    snapshots: { name: string; createdAt: string; stateful: boolean }[];
  };
}

/**
 * Apply an Incus action to a mock record. Pure function: same input
 * → same output. The mock executor calls this to derive the next
 * state. The set of states mirrors the real `incus` lifecycle
 * (draft → validated → provisioning → active/failed).
 */
export function applyAction(rec: MockInstanceRecord, action: IncusActionKind): MockInstanceRecord {
  switch (action) {
    case "start":
      return { ...rec, status: "active" };
    case "stop":
      return { ...rec, status: "stopped" };
    case "restart":
      return { ...rec, status: "active" };
    case "delete":
      return { ...rec, status: "failed" };
    case "launch":
      return { ...rec, status: "provisioning" };
    case "list":
    case "exec-named":
      return { ...rec };
  }
}

/** Project a MockInstanceRecord into the contracts IncusInstance shape. */
function projectMockRecord(rec: MockInstanceRecord): IncusInstance {
  return {
    name: rec.name,
    slug: rec.slug,
    status: rec.status,
    type: rec.type,
    image: rec.image,
    cpu: rec.cpu ?? null,
    memory: rec.memory ?? null,
    config: rec.config,
    devices: rec.devices,
    lastValidation: rec.lastValidation ?? null,
    createdBy: rec.createdBy,
    createdAt: rec.createdAt,
    updatedAt: rec.updatedAt,
  };
}

/**
 * The M2 mock executor. Keeps an in-memory `Map<name, MockInstanceRecord>`
 * and mutates `status` on dispatch. The exec-named executor is a
 * separate in-process helper (`MockExecNamedExecutor`) that uses
 * the same `Map`.
 */
export class MockIncusExecutor {
  private readonly snapshots = new Map<string, MockInstanceRecord>();

  /** Seed initial instances. Idempotent. */
  seed(instances: readonly MockInstanceRecord[]): void {
    for (const inst of instances) {
      if (!this.snapshots.has(inst.name)) {
        this.snapshots.set(inst.name, { ...inst });
      }
    }
  }

  /** Read-only snapshot. */
  snapshot(name: string): MockInstanceRecord | null {
    const inst = this.snapshots.get(name);
    return inst ? { ...inst } : null;
  }

  list(): IncusInstance[] {
    return Array.from(this.snapshots.values())
      .map((inst) => this.toContractsInstance(inst))
      .sort((a, b) => a.name.localeCompare(b.name));
  }

  /** Push a fake log line (used by the mock for `listInstanceLogs`). */
  pushLog(name: string, line: IncusLogLineEntry): void {
    const list = this.logsByInstance.get(name) ?? [];
    list.push(line);
    if (list.length > 500) list.splice(0, list.length - 500);
    this.logsByInstance.set(name, list);
  }

  private readonly logsByInstance = new Map<string, IncusLogLineEntry[]>();

  /** Read the log buffer for an instance. */
  logsFor(name: string): readonly IncusLogLineEntry[] {
    return this.logsByInstance.get(name) ?? [];
  }

  /** Run an action — same shape as the `IncusExecutor` function. */
  run = async (ctx: IncusExecutorContext): Promise<IncusExecutorResult> => {
    const current = this.snapshots.get(ctx.instance.name);
    if (!current) {
      return {
        stdout: "",
        stderr: `Instance ${ctx.instance.name} not loaded in mock executor`,
        exitCode: 1,
        instance: ctx.instance,
      };
    }
    const next = applyAction(current, ctx.action);
    this.snapshots.set(ctx.instance.name, next);
    return {
      stdout: `__cortexos_incus_mock__ ${ctx.action} ${ctx.instance.name}`,
      stderr: "",
      exitCode: 0,
      instance: this.toContractsInstance(next),
    };
  };

  /** Project the mock record into the contracts shape the UI sees. */
  private toContractsInstance(rec: MockInstanceRecord): IncusInstance {
    return projectMockRecord(rec);
  }
}

// ---------------------------------------------------------------------------
// Real data mapping helpers.
// ---------------------------------------------------------------------------

/** Parse an Incus memory limit string into MiB. */
function parseMemoryLimit(value: string | undefined): number | null {
  if (!value) return null;
  const cleaned = value.trim().toLowerCase();
  const m = /^(\d+(?:\.\d+)?)\s*(b|kb|mb|mib|gb|gib|tb|tib)?$/.exec(cleaned);
  if (!m) return null;
  const num = parseFloat(m[1]);
  const unit = m[2] ?? "b";
  switch (unit) {
    case "b":
      return Math.round(num / (1024 * 1024));
    case "kb":
      return Math.round(num / 1024);
    case "mb":
    case "mib":
      return Math.round(num);
    case "gb":
    case "gib":
      return Math.round(num * 1024);
    case "tb":
    case "tib":
      return Math.round(num * 1024 * 1024);
    default:
      return Math.round(num);
  }
}

/** Parse an Incus CPU limit into an integer. */
function parseCpuLimit(value: string | undefined): number | null {
  if (!value) return null;
  const m = /^(\d+)$/.exec(value.trim());
  return m ? parseInt(m[1], 10) : null;
}

/** Map an Incus status string to the contracts IncusInstanceStatus. */
function mapIncusStatus(status: string): IncusInstanceStatus {
  const s = status.toLowerCase();
  switch (s) {
    case "running":
      return "running";
    case "stopped":
      return "stopped";
    case "frozen":
      return "frozen";
    case "error":
      return "error";
    case "starting":
      return "provisioning";
    case "stopping":
      return "active";
    default:
      return "active";
  }
}

/** Map an Incus type string to the contracts IncusInstanceType. */
function mapIncusType(type: string): IncusInstance["type"] {
  if (type === "virtual-machine") return "vm";
  return "container";
}

/** Map an Incus image type string to the contracts image type. */
function mapIncusImageType(type: string): IncusImage["type"] {
  if (type === "virtual-machine") return "virtual-machine";
  if (type === "container") return "container";
  return "unknown";
}

/** Extract bridge from expanded devices. */
function extractBridge(devices: Record<string, unknown>): string {
  for (const [, dev] of Object.entries(devices)) {
    if (dev && typeof dev === "object" && (dev as Record<string, unknown>).type === "nic") {
      const { network } = dev as Record<string, unknown>;
      if (typeof network === "string") return network;
      const { parent } = dev as Record<string, unknown>;
      if (typeof parent === "string") return parent;
    }
  }
  return "incusbr0";
}

/** Extract pool from expanded devices. */
function extractPool(devices: Record<string, unknown>): string {
  for (const [, dev] of Object.entries(devices)) {
    if (
      dev &&
      typeof dev === "object" &&
      (dev as Record<string, unknown>).type === "disk" &&
      (dev as Record<string, unknown>).path === "/"
    ) {
      const { pool } = dev as Record<string, unknown>;
      if (typeof pool === "string") return pool;
    }
  }
  return "default";
}

/** Map a single Incus list JSON entry to MockInstanceRecord. */
function mapIncusJsonToMockRecord(item: Record<string, unknown>): MockInstanceRecord {
  const config = (item.config as Record<string, string>) ?? {};
  const imageName =
    config["image.name"] || config["image.description"] || config["image.os"] || "unknown";
  const type = mapIncusType(String(item.type ?? "container"));
  const status = mapIncusStatus(String(item.status ?? "Stopped"));
  const devices =
    (item.expanded_devices as Record<string, unknown>) ??
    (item.devices as Record<string, unknown>) ??
    {};
  const bridge = extractBridge(devices);
  const pool = extractPool(devices);
  const profiles = Array.isArray(item.profiles) ? (item.profiles as string[]) : [];

  const state = (item?.state as Record<string, unknown>) ?? {};
  const networks: NonNullable<MockInstanceRecord["live"]>["state"]["networks"] = {};
  const netState = state.network as Record<string, unknown> | undefined;
  if (netState && typeof netState === "object") {
    for (const [ifName, ifData] of Object.entries(netState)) {
      if (!ifData || typeof ifData !== "object") continue;
      const iface = ifData as Record<string, unknown>;
      const addrs: {
        family: "inet" | "inet6";
        address: string;
        scope?: "global" | "link" | "local";
      }[] = [];
      const addrList = Array.isArray(iface.addresses) ? iface.addresses : [];
      for (const a of addrList) {
        if (!a || typeof a !== "object") continue;
        const addr = a as Record<string, unknown>;
        const family = String(addr.family ?? "");
        const address = String(addr.address ?? "");
        if (!address) continue;
        if (family === "inet" || family === "inet6") {
          addrs.push({
            family,
            address,
            scope: String(addr.scope ?? "global") as "global" | "link" | "local",
          });
        }
      }
      networks[ifName] = {
        addresses: addrs,
        state: typeof iface.state === "string" ? iface.state : undefined,
        type: typeof iface.type === "string" ? iface.type : undefined,
      };
    }
  }

  return {
    name: String(item.name ?? ""),
    slug: String(item.name ?? ""),
    status,
    type,
    image: imageName,
    cpu: parseCpuLimit(config["limits.cpu"]),
    memory: parseMemoryLimit(config["limits.memory"]),
    config: {
      target: {
        mode: "new",
        ghOrg: "cortexos",
        slug: String(item.name ?? ""),
        branch: "main",
      },
      image: {
        alias: imageName,
        gastown: false,
        profiles,
        pool,
      },
      hermes: {
        enabled: false,
        proxies: [],
      },
      network: {
        bridge,
        tailscale: false,
        webAccess: false,
      },
    },
    devices,
    lastValidation: null,
    createdBy: "00000000-0000-4000-8000-000000000000",
    createdAt: String(item.created_at ?? new Date().toISOString()),
    updatedAt: String(item.last_used_at ?? item.created_at ?? new Date().toISOString()),
    allowlisted: true,
    live: {
      status: String(item.status ?? "Stopped").toUpperCase(),
      statusCode: status,
      architecture: String(item.architecture ?? "x86_64"),
      state: {
        networks,
        pid: typeof state.pid === "number" ? state.pid : 0,
      },
      profiles,
      snapshots: [],
    },
  };
}

// ---------------------------------------------------------------------------
// Real data loaders — called when currentMock is null (Linux production).
// ---------------------------------------------------------------------------

/** List instances from the real incus CLI. */
async function listInstancesFromIncus(): Promise<IncusInstance[]> {
  try {
    const { stdout } = await execFileAsync("incus", ["list", "--format", "json"], {
      timeout: 15_000,
      maxBuffer: 8 * 1024 * 1024,
    });
    const parsed = JSON.parse(stdout) as unknown[];
    const records = parsed
      .filter((i): i is Record<string, unknown> => typeof i === "object" && i !== null)
      .map(mapIncusJsonToMockRecord);
    return records
      .map((rec) => projectMockRecord(rec))
      .sort((a, b) => a.name.localeCompare(b.name));
  } catch {
    return [];
  }
}

/** Look up a single instance from the real incus CLI. */
async function getInstanceFromIncus(name: string): Promise<IncusInstance | null> {
  try {
    const { stdout } = await execFileAsync("incus", ["list", name, "--format", "json"], {
      timeout: 10_000,
      maxBuffer: 2 * 1024 * 1024,
    });
    const parsed = JSON.parse(stdout) as unknown[];
    const item = parsed.find(
      (i): i is Record<string, unknown> =>
        typeof i === "object" && i !== null && String((i as Record<string, unknown>).name) === name,
    );
    if (!item) return null;
    return projectMockRecord(mapIncusJsonToMockRecord(item));
  } catch {
    return null;
  }
}

/** Look up a single instance as MockInstanceRecord (for dispatch). */
async function getMockRecordFromIncus(name: string): Promise<MockInstanceRecord | null> {
  try {
    const { stdout } = await execFileAsync("incus", ["list", name, "--format", "json"], {
      timeout: 10_000,
      maxBuffer: 2 * 1024 * 1024,
    });
    const parsed = JSON.parse(stdout) as unknown[];
    const item = parsed.find(
      (i): i is Record<string, unknown> =>
        typeof i === "object" && i !== null && String((i as Record<string, unknown>).name) === name,
    );
    if (!item) return null;
    return mapIncusJsonToMockRecord(item);
  } catch {
    return null;
  }
}

/** List images from the real incus CLI. */
async function listImagesFromIncus(): Promise<IncusImage[]> {
  try {
    const { stdout } = await execFileAsync("incus", ["image", "list", "--format", "json"], {
      timeout: 15_000,
      maxBuffer: 4 * 1024 * 1024,
    });
    const parsed = JSON.parse(stdout) as unknown[];
    return parsed
      .filter((i): i is Record<string, unknown> => typeof i === "object" && i !== null)
      .map((item): IncusImage => {
        const aliases = Array.isArray(item.aliases)
          ? (item.aliases as Record<string, unknown>[])
              .map((a) => String(a.name ?? ""))
              .filter((n) => n.length > 0)
          : [];
        const props = (item.properties as Record<string, string>) ?? {};
        return {
          fingerprint: String(item.fingerprint ?? ""),
          architecture: String(item.architecture ?? ""),
          type: mapIncusImageType(String(item.type ?? "unknown")),
          size: typeof item.size === "number" ? item.size : 0,
          uploadedAt: String(item.uploaded_at ?? item.created_at ?? new Date().toISOString()),
          aliases,
          description: props.description ?? null,
        };
      })
      .sort((a, b) => a.fingerprint.localeCompare(b.fingerprint));
  } catch {
    return [];
  }
}

// ---------------------------------------------------------------------------
// Seed instances — representative set for the M2 mock.
// ---------------------------------------------------------------------------

const SEED_INSTANCES: readonly MockInstanceRecord[] = [
  {
    name: "hermes-canary",
    slug: "hermes-canary",
    status: "active",
    type: "container",
    image: "ubuntu/24.04",
    cpu: 2,
    memory: 4096,
    config: {
      target: { mode: "new", branch: "main", ghOrg: "cortexos", slug: "hermes-canary" },
      image: { alias: "ubuntu/24.04", gastown: false, profiles: ["default"], pool: "default" },
      hermes: { enabled: true, profile: "hermes", port: 18695, model: "gpt-4o-mini", proxies: [] },
      network: { bridge: "incusbr0", tailscale: true, webAccess: false },
    },
    devices: {
      root: { path: "/", pool: "default", type: "disk" },
      eth0: { name: "eth0", nictype: "bridged", parent: "incusbr0", type: "nic" },
    },
    lastValidation: {
      ok: true,
      ranAt: "2026-05-12T10:00:00.000Z",
      notes: "preflight passed",
    },
    createdBy: "00000000-0000-4000-8000-000000000001",
    createdAt: "2026-05-01T08:00:00.000Z",
    updatedAt: "2026-05-12T10:00:00.000Z",
    allowlisted: true,
    live: {
      status: "RUNNING",
      statusCode: "running",
      architecture: "x86_64",
      state: {
        networks: {
          eth0: {
            addresses: [{ family: "inet", address: "10.0.0.42", scope: "global" }],
            state: "up",
            type: "broadcast",
          },
        },
        pid: 12345,
      },
      profiles: ["default"],
      snapshots: [{ name: "pre-upgrade", createdAt: "2026-05-10T12:00:00.000Z", stateful: false }],
    },
  },
  {
    name: "archive-cold",
    slug: "archive-cold",
    status: "failed",
    type: "container",
    image: "alpine/3.20",
    cpu: 1,
    memory: 1024,
    config: {
      target: { mode: "new", branch: "main", ghOrg: "cortexos", slug: "archive-cold" },
      image: { alias: "alpine/3.20", gastown: false, profiles: ["default"], pool: "hdd" },
      hermes: { enabled: false, proxies: [] },
      network: { bridge: "incusbr0", tailscale: false, webAccess: false },
    },
    devices: {
      root: { path: "/", pool: "hdd", type: "disk" },
    },
    lastValidation: {
      ok: false,
      ranAt: "2026-05-18T03:00:00.000Z",
      notes: "preflight failed: image alias not found",
    },
    createdBy: "00000000-0000-4000-8000-000000000003",
    createdAt: "2026-04-20T09:00:00.000Z",
    updatedAt: "2026-05-18T03:00:00.000Z",
    allowlisted: true,
    live: {
      status: "ERROR",
      statusCode: "error",
      architecture: "x86_64",
      state: { networks: {} },
      profiles: ["default"],
      snapshots: [],
    },
  },
  {
    name: "cortex-graph-dev",
    slug: "cortex-graph-dev",
    status: "draft",
    type: "container",
    image: "ubuntu/24.04",
    cpu: 2,
    memory: 2048,
    config: {
      target: { mode: "clone", branch: "main", ghOrg: "cortexos", slug: "cortex-graph-dev" },
      image: { alias: "ubuntu/24.04", gastown: false, profiles: ["default"], pool: "default" },
      hermes: { enabled: false, proxies: [] },
      network: { bridge: "incusbr0", tailscale: true, webAccess: false },
    },
    devices: {},
    lastValidation: null,
    createdBy: "00000000-0000-4000-8000-000000000004",
    createdAt: "2026-05-22T11:00:00.000Z",
    updatedAt: "2026-05-22T11:00:00.000Z",
    allowlisted: true,
  },
];

/** Pre-populate the log buffer so the detail page is non-empty. */
function seedLogs(mock: MockIncusExecutor): void {
  const now = "2026-05-12T10:00:00.000Z";
  for (const inst of SEED_INSTANCES) {
    mock.pushLog(inst.name, {
      ts: now,
      priority: "info",
      name: inst.name,
      message: `Instance ${inst.name} started`,
    });
    mock.pushLog(inst.name, {
      ts: now,
      priority: "info",
      name: inst.name,
      message: `Image ${inst.image} attached`,
    });
    if (inst.status === "failed" || inst.status === "error") {
      mock.pushLog(inst.name, {
        ts: "2026-05-18T03:00:00.000Z",
        priority: "error",
        name: inst.name,
        message: `Provisioning failed: image alias not found`,
      });
    }
    if (inst.status === "provisioning") {
      mock.pushLog(inst.name, {
        ts: "2026-05-15T14:30:05.000Z",
        priority: "info",
        name: inst.name,
        message: `Downloading image: ${inst.image}`,
      });
      mock.pushLog(inst.name, {
        ts: "2026-05-15T14:30:10.000Z",
        priority: "info",
        name: inst.name,
        message: `Image unpacked; unpacking rootfs`,
      });
    }
  }
}

/** Build a fresh default mock + wrapper. */
function makeDefaultMock(): { mock: MockIncusExecutor; executor: IncusExecutor } {
  const mock = new MockIncusExecutor();
  mock.seed(SEED_INSTANCES);
  seedLogs(mock);
  return { mock, executor: (ctx) => mock.run(ctx) };
}

// ---------------------------------------------------------------------------
// Module-level state — the executor is the only swappable piece.
// ---------------------------------------------------------------------------

let currentMock: MockIncusExecutor | null = null;
let executor: IncusExecutor = (_p) => {
  throw new Error("incus bridge: executor used before init");
};

/** Test helper: swap the executor. Pass `null` to reset to the default mock. */
export function setExecutorForTests(fn: IncusExecutor | null): void {
  if (fn) {
    executor = fn;
    return;
  }
  const { mock, executor: e } = makeDefaultMock();
  currentMock = mock;
  executor = e;
}

/** Test helper: peek at the underlying mock. */
export function _getMockExecutorForTests(): MockIncusExecutor {
  if (!currentMock) {
    const { mock, executor: e } = makeDefaultMock();
    currentMock = mock;
    executor = e;
  }
  return currentMock;
}

/** Reset the in-memory store + re-seed with the default instances. */
export function _resetIncusBridgeForTests(): void {
  const { mock, executor: e } = makeDefaultMock();
  currentMock = mock;
  executor = e;
}

// ---------------------------------------------------------------------------
// Loaders — used by the +page.server.ts and +server.ts handlers.
// ---------------------------------------------------------------------------

/** List all instances. M2: seeded + mutated snapshot. */
export async function listInstances(): Promise<IncusInstance[]> {
  if (currentMock) return currentMock.list();
  return listInstancesFromIncus();
}

/** Look up an instance by name. Returns null when not found. */
export async function getInstance(name: string): Promise<IncusInstance | null> {
  if (currentMock) {
    const rec = currentMock.snapshot(name);
    if (!rec) return null;
    return projectMockRecord(rec);
  }
  return getInstanceFromIncus(name);
}

/** Return the mock record (with allowlisted + live) for use by the bridge. */
export async function getMockRecord(name: string): Promise<MockInstanceRecord | null> {
  if (currentMock) return currentMock.snapshot(name);
  return getMockRecordFromIncus(name);
}

/** Return the most-recent `limit` log lines for an instance, newest first. */
export async function listInstanceLogs(name: string, limit: number): Promise<IncusLogLine[]> {
  if (currentMock) {
    const all = currentMock.logsFor(name);
    // The mock stores oldest-first; the API returns newest-first.
    const reversed = all.slice().reverse();
    return reversed.slice(0, Math.max(0, limit)).map((l) => ({
      ts: l.ts,
      priority: l.priority,
      name: l.name,
      message: l.message,
    }));
  }
  return [];
}

/**
 * List the Incus images known to the host. The M2 mock seeds three
 * representative images; M3 swaps to `incus image list --format json`.
 */
export async function listImages(): Promise<IncusImage[]> {
  if (currentMock) {
    return [
      {
        fingerprint: "aabbccddeeff00112233445566778899aabbccdd",
        architecture: "x86_64",
        type: "container",
        size: 512_000_000,
        uploadedAt: "2026-04-01T00:00:00.000Z",
        aliases: ["ubuntu/24.04", "ubuntu-lts"],
        description: "Ubuntu 24.04 LTS noble",
      },
      {
        fingerprint: "00112233445566778899aabbccddeeff00112233",
        architecture: "x86_64",
        type: "virtual-machine",
        size: 2_000_000_000,
        uploadedAt: "2026-03-15T00:00:00.000Z",
        aliases: ["debian/12", "debian-bookworm"],
        description: "Debian 12 bookworm",
      },
      {
        fingerprint: "fedcba9876543210fedcba9876543210fedcba98",
        architecture: "x86_64",
        type: "container",
        size: 24_000_000,
        uploadedAt: "2026-02-10T00:00:00.000Z",
        aliases: ["alpine/3.20"],
        description: "Alpine 3.20",
      },
    ];
  }
  return listImagesFromIncus();
}

// ---------------------------------------------------------------------------
// Real executor (Linux only). Calls `incus` via execFile — no shell,
// no string interpolation. The instance name is already validated by
// the bridge before this runs.
// ---------------------------------------------------------------------------

const realIncusExecutor: IncusExecutor = async (ctx) => {
  const args: Record<IncusActionKind, string[]> = {
    start: ["start", ctx.instance.name],
    stop: ["stop", ctx.instance.name],
    restart: ["restart", ctx.instance.name],
    delete: ["delete", ctx.instance.name, "--force"],
    launch: ["launch", ctx.instance.image, ctx.instance.name],
    list: ["list", ctx.instance.name, "--format", "json"],
    "exec-named": ["list", ctx.instance.name, "--format", "json"],
  };

  try {
    const { stdout, stderr } = await execFileAsync("incus", args[ctx.action], {
      timeout: 60_000,
      maxBuffer: 4 * 1024 * 1024,
    });
    const updated = await getMockRecord(ctx.instance.name);
    return {
      stdout: stdout ?? "",
      stderr: stderr ?? "",
      exitCode: 0,
      instance: updated ? projectMockRecord(updated) : ctx.instance,
    };
  } catch (err) {
    const e = err as { code?: number | string; stdout?: string; stderr?: string; message?: string };
    return {
      stdout: e.stdout ?? "",
      stderr: e.stderr ?? e.message ?? "incus exec failed",
      exitCode: typeof e.code === "number" ? e.code : 1,
      instance: ctx.instance,
    };
  }
};

(function init() {
  const useReal = process.platform === "linux" && process.env.CORTEX_INCUS_BRIDGE_REAL !== "0";
  if (useReal) {
    executor = realIncusExecutor;
    return;
  }
  const { mock, executor: e } = makeDefaultMock();
  currentMock = mock;
  executor = e;
})();

// ---------------------------------------------------------------------------
// Preflight (M2 deterministic stub)
// ---------------------------------------------------------------------------

/**
 * M2 deterministic preflight — checks the (config) shape and the
 * mock state. Returns an `IncusPreflightReport`. M3 swaps to the
 * real `incus list` / image / network / pool queries.
 */
export async function runPreflightReport(
  config: IncusInstanceConfig,
): Promise<IncusPreflightReport> {
  const checks: IncusPreflightCheck[] = [];
  const name = config.target.slug;

  // 1. Name availability.
  const existingInstances = currentMock ? SEED_INSTANCES : await listInstances();
  const knownNames = new Set(existingInstances.map((i) => i.name));
  checks.push({
    id: "name",
    label: "Instance name available",
    pass: !knownNames.has(name),
    detail: knownNames.has(name) ? `instance "${name}" already exists` : undefined,
  });

  // 2. Image.
  const existingImages = currentMock ? [] : await listImages();
  const knownAliases = currentMock
    ? new Set(["ubuntu/24.04", "debian/12", "alpine/3.20"])
    : new Set(existingImages.flatMap((i) => i.aliases));
  checks.push({
    id: "image",
    label: "Base image present",
    pass: knownAliases.has(config.image.alias),
    detail: knownAliases.has(config.image.alias)
      ? undefined
      : `no local image alias "${config.image.alias}"`,
  });

  // 3. Storage pool.
  const knownPools = new Set(["default", "nvme", "hdd"]);
  const pool = config.image.pool ?? "";
  checks.push({
    id: "pool",
    label: "Storage pool present",
    pass: knownPools.has(pool),
    detail: knownPools.has(pool) ? undefined : `storage pool "${pool}" not found`,
  });

  // 4. Network bridge.
  const knownBridges = new Set(["incusbr0"]);
  checks.push({
    id: "bridge",
    label: "Network bridge present",
    pass: knownBridges.has(config.network.bridge),
    detail: knownBridges.has(config.network.bridge)
      ? undefined
      : `network bridge "${config.network.bridge}" not found`,
  });

  // 5. Hermes secret.
  if (config.hermes.enabled) {
    checks.push({
      id: "hermes-secret",
      label: "Hermes secret file present",
      pass: true,
      detail: `/opt/cortexos/.secrets/hermes/${config.hermes.profile}.env (mock)`,
    });
  }

  return {
    ok: checks.every((c) => c.pass),
    checks,
  };
}

// ---------------------------------------------------------------------------
// Provisioning progress
// ---------------------------------------------------------------------------

/**
 * Build a deterministic sequence of `ProgressStep`s for a fresh
 * instance launch.
 */
export function buildLaunchProgress(name: string): readonly ProgressStep[] {
  return [
    { step: "preflight", status: "pending", detail: `Validating ${name}…` },
    { step: "image-pull", status: "pending", detail: "Pulling base image" },
    { step: "image-unpack", status: "pending", detail: "Unpacking rootfs" },
    { step: "launch", status: "pending", detail: `Launching ${name}` },
    { step: "limits-apply", status: "pending", detail: "Applying CPU + memory limits" },
    { step: "network-attach", status: "pending", detail: "Attaching to bridge" },
    { step: "start", status: "pending", detail: "Starting instance" },
  ];
}

// ---------------------------------------------------------------------------
// Dispatch — the privileged path. Always returns a `DispatchResult`.
// ---------------------------------------------------------------------------

export interface DispatchInput {
  action: IncusActionKind;
  name: string;
  /** For `delete`: the typed-phrase the user confirmed. */
  confirmation?: string;
}

export interface DispatchContext {
  user: User;
  ip: string;
  userAgent: string | null;
  requestId: string;
  /**
   * Session id of the caller. Used to verify the approval token's
   * session binding (PB-1 / SR-020). Required for destructive actions.
   */
  sessionId: string;
  /** Optional approval token. Required for destructive actions. */
  approvalToken?: string;
}

/**
 * The structured result the bridge returns. Never throws — the route
 * handler converts `rejected` to the right HTTP status.
 */
export type DispatchResult =
  | {
      status: "accepted";
      action: IncusActionKind;
      name: string;
      stdout: string;
      stderr: string;
      exitCode: number;
      instance: IncusInstance;
      durationMs: number;
    }
  | {
      status: "approval_required";
      action: IncusActionKind;
      name: string;
      actionHash: string;
      ttlSec: number;
      message: string;
    }
  | {
      status: "rejected";
      action: IncusActionKind;
      name: string;
      code:
        | "unknown_op"
        | "unknown_instance"
        | "not_allowlisted"
        | "instance_name_invalid"
        | "confirmation_required"
        | "approval_required"
        | "approval_invalid"
        | "approval_expired"
        | "approval_session_mismatch"
        | "approval_already_used"
        | "executor_error";
      reason: string;
    };

/** The set of actions that the policy allowlist marks as destructive. */
const DESTRUCTIVE_ACTIONS: ReadonlySet<IncusActionKind> = new Set<IncusActionKind>([
  "stop",
  "restart",
  "delete",
]);

/** Strict regex for incus instance names. Mirrors the policy module. */
const INSTANCE_NAME_RE = /^[a-z0-9][a-z0-9-]{0,62}[a-z0-9]$/;

/** TTL for a destructive-action approval token. */
const APPROVAL_TTL_SEC = 60;

/** Confirmation phrase required to delete an instance. */
export const DELETE_CONFIRMATION_PHRASE = "delete";

/**
 * Dispatch an Incus action.
 *
 * Order of checks (defence in depth — every layer rejects the bad case):
 *   1. Op is on the policy allowlist (e.g. `incus.restart`).
 *   2. Instance name matches the strict regex.
 *   3. Instance is in the executor's snapshot and is `allowlisted`.
 *   4. If the action is destructive, the caller must supply a valid
 *      approval token (verified by `verifyApproval` semantics).
 *   5. If the action is `delete`, the caller must supply a typed
 *      confirmation phrase (PB-5 UX guard).
 *   6. Run the executor.
 */
export async function dispatchAction(
  input: DispatchInput,
  ctx: DispatchContext,
): Promise<DispatchResult> {
  const t0 = Date.now();
  const policyName = `incus.${input.action}`;

  // 1. Policy allowlist.
  const entry: AllowlistEntry | undefined = allowlistedCommand(policyName);
  if (!entry) {
    audit({
      actorUserId: ctx.user.id,
      actorSessionId: null,
      actorIp: ctx.ip,
      actorUserAgent: ctx.userAgent,
      surface: "incus",
      action: "incus.bridge.reject",
      target: input.name,
      result: "failure",
      errorCode: "unknown_op",
      requestId: ctx.requestId,
      payload: { phase: "allowlist", op: policyName },
    });
    return {
      status: "rejected",
      action: input.action,
      name: input.name,
      code: "unknown_op",
      reason: `op '${policyName}' is not on the policy allowlist`,
    };
  }

  // 2. Instance name regex.
  if (!INSTANCE_NAME_RE.test(input.name)) {
    audit({
      actorUserId: ctx.user.id,
      actorSessionId: null,
      actorIp: ctx.ip,
      actorUserAgent: ctx.userAgent,
      surface: "incus",
      action: "incus.bridge.reject",
      target: input.name,
      result: "denied",
      errorCode: "instance_name_invalid",
      requestId: ctx.requestId,
      payload: { phase: "name_regex", op: policyName, name: input.name },
    });
    return {
      status: "rejected",
      action: input.action,
      name: input.name,
      code: "instance_name_invalid",
      reason: `instance name '${input.name}' does not match ${INSTANCE_NAME_RE.source}`,
    };
  }

  // 3. Instance exists + is allowlisted.
  const instance = await getMockRecord(input.name);
  if (!instance) {
    audit({
      actorUserId: ctx.user.id,
      actorSessionId: null,
      actorIp: ctx.ip,
      actorUserAgent: ctx.userAgent,
      surface: "incus",
      action: "incus.bridge.reject",
      target: input.name,
      result: "failure",
      errorCode: "unknown_instance",
      requestId: ctx.requestId,
      payload: { phase: "lookup", op: policyName, name: input.name },
    });
    return {
      status: "rejected",
      action: input.action,
      name: input.name,
      code: "unknown_instance",
      reason: `instance '${input.name}' is not in the executor's snapshot`,
    };
  }
  if (!instance.allowlisted) {
    audit({
      actorUserId: ctx.user.id,
      actorSessionId: null,
      actorIp: ctx.ip,
      actorUserAgent: ctx.userAgent,
      surface: "incus",
      action: "incus.bridge.reject",
      target: input.name,
      result: "denied",
      errorCode: "not_allowlisted",
      requestId: ctx.requestId,
      payload: { phase: "allowlist_instance", op: policyName, name: input.name },
    });
    return {
      status: "rejected",
      action: input.action,
      name: input.name,
      code: "not_allowlisted",
      reason: `instance '${input.name}' is not allowlisted`,
    };
  }

  // 3a. Delete confirmation phrase.
  if (input.action === "delete") {
    if ((input.confirmation ?? "").trim().toLowerCase() !== DELETE_CONFIRMATION_PHRASE) {
      audit({
        actorUserId: ctx.user.id,
        actorSessionId: null,
        actorIp: ctx.ip,
        actorUserAgent: ctx.userAgent,
        surface: "incus",
        action: "incus.bridge.reject",
        target: input.name,
        result: "denied",
        errorCode: "confirmation_required",
        requestId: ctx.requestId,
        payload: { phase: "confirmation", op: policyName, name: input.name },
      });
      return {
        status: "rejected",
        action: input.action,
        name: input.name,
        code: "confirmation_required",
        reason: `delete requires a typed confirmation of '${DELETE_CONFIRMATION_PHRASE}'`,
      };
    }
  }

  // 4. Destructive action → approval gate.
  if (DESTRUCTIVE_ACTIONS.has(input.action)) {
    const actionHash = actionHashFor(policyName, { name: input.name });
    if (!ctx.approvalToken) {
      audit({
        actorUserId: ctx.user.id,
        actorSessionId: null,
        actorIp: ctx.ip,
        actorUserAgent: ctx.userAgent,
        surface: "incus",
        action: "incus.bridge.approval_required",
        target: input.name,
        result: "success",
        errorCode: null,
        requestId: ctx.requestId,
        payload: { phase: "approval_required", op: policyName, actionHash },
      });
      return {
        status: "approval_required",
        action: input.action,
        name: input.name,
        actionHash,
        ttlSec: APPROVAL_TTL_SEC,
        message: `Destructive incus action '${input.action}' on '${input.name}' requires an approval token`,
      };
    }
    // Verify the token. The approval is bound to the caller's
    // `SessionId` (THREAT_MODEL §3.4, PB-1).
    const { verifyApproval } = await import("../approval");
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const v = verifyApproval(ctx.approvalToken, ctx.sessionId as any);
    if (!v.ok) {
      const reason = `approval token ${v.reason}`;
      audit({
        actorUserId: ctx.user.id,
        actorSessionId: null,
        actorIp: ctx.ip,
        actorUserAgent: ctx.userAgent,
        surface: "incus",
        action: "incus.bridge.reject",
        target: input.name,
        result: "denied",
        errorCode: v.reason,
        requestId: ctx.requestId,
        payload: { phase: "approval_verify", op: policyName, reason: v.reason },
      });
      return {
        status: "rejected",
        action: input.action,
        name: input.name,
        code:
          v.reason === "expired"
            ? "approval_expired"
            : v.reason === "already_used"
              ? "approval_already_used"
              : v.reason === "session_mismatch"
                ? "approval_session_mismatch"
                : "approval_invalid",
        reason,
      };
    }
    // Bind the approval to this specific op + name (PB-5).
    if (v.claims.actionHash !== actionHash) {
      audit({
        actorUserId: ctx.user.id,
        actorSessionId: null,
        actorIp: ctx.ip,
        actorUserAgent: ctx.userAgent,
        surface: "incus",
        action: "incus.bridge.reject",
        target: input.name,
        result: "denied",
        errorCode: "approval_invalid",
        requestId: ctx.requestId,
        payload: {
          phase: "approval_action_mismatch",
          expected: actionHash,
          got: v.claims.actionHash,
        },
      });
      return {
        status: "rejected",
        action: input.action,
        name: input.name,
        code: "approval_invalid",
        reason: "approval token is not bound to this action + name",
      };
    }
  }

  // 5. Run the executor.
  try {
    const result = await executor({
      instance: {
        name: instance.name,
        slug: instance.slug,
        status: instance.status,
        type: instance.type,
        image: instance.image,
        cpu: instance.cpu ?? null,
        memory: instance.memory ?? null,
        config: instance.config,
        devices: instance.devices,
        lastValidation: instance.lastValidation ?? null,
        createdBy: instance.createdBy,
        createdAt: instance.createdAt,
        updatedAt: instance.updatedAt,
      },
      action: input.action,
      user: ctx.user,
      ip: ctx.ip,
      requestId: ctx.requestId,
    });
    audit({
      actorUserId: ctx.user.id,
      actorSessionId: null,
      actorIp: ctx.ip,
      actorUserAgent: ctx.userAgent,
      surface: "incus",
      action: "incus.bridge.dispatch",
      target: input.name,
      result: "success",
      errorCode: null,
      requestId: ctx.requestId,
      payload: {
        op: policyName,
        exitCode: result.exitCode,
        stdoutBytes: result.stdout.length,
        stderrBytes: result.stderr.length,
      },
    });
    return {
      status: "accepted",
      action: input.action,
      name: input.name,
      stdout: result.stdout,
      stderr: result.stderr,
      exitCode: result.exitCode,
      instance: result.instance,
      durationMs: Date.now() - t0,
    };
  } catch (e) {
    audit({
      actorUserId: ctx.user.id,
      actorSessionId: null,
      actorIp: ctx.ip,
      actorUserAgent: ctx.userAgent,
      surface: "incus",
      action: "incus.bridge.dispatch",
      target: input.name,
      result: "failure",
      errorCode: "executor_error",
      requestId: ctx.requestId,
      payload: { op: policyName, error: (e as Error).message },
    });
    return {
      status: "rejected",
      action: input.action,
      name: input.name,
      code: "executor_error",
      reason: `executor error: ${(e as Error).message}`,
    };
  }
}

// ---------------------------------------------------------------------------
// Exec-named (PB-4). Mirrors the terminal pty-bridge's allowlist pattern.
// ---------------------------------------------------------------------------

/** The closed set of shell ops the UI may invoke via exec-named. */
export const EXEC_NAMED_OPS: ReadonlySet<IncusShellOp> = new Set<IncusShellOp>([
  "term.ps",
  "term.df",
  "term.ls",
  "term.cat",
  "term.tail_log",
  "term.exec_named",
]);

/**
 * M2 deterministic exec. Mocks stdout/stderr based on the op without
 * ever invoking a shell. M3 swaps to `incus exec <name> -- <argv>`.
 */
export interface MockExecResult {
  stdout: string;
  stderr: string;
  exitCode: number;
}

export type MockExecNamedExecutor = (
  op: IncusShellOp,
  args: Readonly<Record<string, unknown>>,
  name: string,
) => Promise<MockExecResult>;

let execNamedExecutor: MockExecNamedExecutor = async (op, args, name) => {
  switch (op) {
    case "term.ps":
      return {
        stdout: `root         1  0.0  0.1  1234  5678 ?        Ss   00:00   0:01 /init ${name}`,
        stderr: "",
        exitCode: 0,
      };
    case "term.df":
      return {
        stdout: `Filesystem      Size  Used Avail Use% Mounted on\n/dev/root        20G  2.4G   17G  13% /`,
        stderr: "",
        exitCode: 0,
      };
    case "term.ls": {
      const path = typeof args.path === "string" ? args.path : "/";
      return {
        stdout: `drwxr-xr-x  2 root root 4096 May 12 10:00 ${path}`,
        stderr: "",
        exitCode: 0,
      };
    }
    case "term.cat": {
      return {
        stdout: `${name}\n`,
        stderr: "",
        exitCode: 0,
      };
    }
    case "term.tail_log": {
      const unit = typeof args.unit === "string" ? args.unit : "sshd";
      const n = typeof args.n === "number" ? args.n : 10;
      return {
        stdout: `-- Logs begin at ${new Date().toISOString()} --\n${Array.from({ length: n })
          .map((_, i) => `May 12 10:0${i % 10}:00 ${name} ${unit}[${100 + i}]: ready`)
          .join("\n")}`,
        stderr: "",
        exitCode: 0,
      };
    }
    case "term.exec_named": {
      const command = typeof args.command === "string" ? args.command : "true";
      return {
        stdout: `__cortexos_incus_exec_mock__ ${command} (in ${name})`,
        stderr: "",
        exitCode: 0,
      };
    }
  }
};

/** Test helper: swap the exec-named executor. Pass `null` to reset. */
export function setExecNamedExecutorForTests(fn: MockExecNamedExecutor | null): void {
  execNamedExecutor = fn ?? execNamedExecutor;
}

export interface ExecDispatchInput {
  op: IncusShellOp;
  args: Readonly<Record<string, unknown>>;
}

export interface ExecDispatchContext {
  user: User;
  ip: string;
  userAgent: string | null;
  requestId: string;
}

export type ExecDispatchResult =
  | {
      status: "accepted";
      op: IncusShellOp;
      stdout: string;
      stderr: string;
      exitCode: number;
    }
  | {
      status: "rejected";
      op: IncusShellOp;
      code: "unknown_op" | "arg_smuggling" | "argv_bash_c" | "arg_type" | "unknown_instance";
      reason: string;
      field?: string;
    };

/**
 * PB-4: dispatch an allowlisted exec-named op against a named
 * instance.
 *
 * Re-runs the policy + arg-smuggling guards (SR-019 + T-104) so a
 * misconfigured caller cannot smuggle `bash -c <userstring>`. The
 * mock executor is in-process; M3 swaps to the real `incus exec
 * <name> -- <allowlisted-subcommand>`.
 */
export async function dispatchExecNamed(
  name: string,
  input: ExecDispatchInput,
  ctx: ExecDispatchContext,
): Promise<ExecDispatchResult> {
  // 1. Instance must exist (no PII leak; we return `unknown_instance`
  //    not `not_found` so the caller can't enumerate names).
  const instance = await getInstance(name);
  if (!instance) {
    audit({
      actorUserId: ctx.user.id,
      actorSessionId: null,
      actorIp: ctx.ip,
      actorUserAgent: ctx.userAgent,
      surface: "incus",
      action: "incus.exec_named.reject",
      target: name,
      result: "failure",
      errorCode: "unknown_instance",
      requestId: ctx.requestId,
      payload: { phase: "lookup", op: input.op, name },
    });
    return {
      status: "rejected",
      op: input.op,
      code: "unknown_instance",
      reason: `instance '${name}' is not in the executor's snapshot`,
    };
  }

  // 2. Op must be on the closed allowlist.
  if (!EXEC_NAMED_OPS.has(input.op)) {
    audit({
      actorUserId: ctx.user.id,
      actorSessionId: null,
      actorIp: ctx.ip,
      actorUserAgent: ctx.userAgent,
      surface: "incus",
      action: "incus.exec_named.reject",
      target: name,
      result: "failure",
      errorCode: "unknown_op",
      requestId: ctx.requestId,
      payload: { phase: "op_allowlist", op: input.op },
    });
    return {
      status: "rejected",
      op: input.op,
      code: "unknown_op",
      reason: `op '${input.op}' is not on the incus exec-named allowlist`,
    };
  }

  // 3. Recursive arg-smuggling scan (PB-4 / T-104 / SR-019).
  // Re-uses the policy module's `validateShellArg` so the same
  // denylist + arg-smuggling patterns guard every privileged
  // surface.
  const { validateShellArg } = await import("../policy");
  const argErrors: { field: string; reason: string; matched: string }[] = [];
  function walk(value: unknown, path: string): void {
    if (typeof value === "string") {
      const r = validateShellArg(value);
      if (!r.ok) argErrors.push({ field: path, reason: r.reason, matched: r.matched });
      return;
    }
    if (value === null || typeof value === "number" || typeof value === "boolean") return;
    if (Array.isArray(value)) {
      value.forEach((v, i) => walk(v, `${path}[${i}]`));
      return;
    }
    if (typeof value === "object") {
      for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
        walk(v, path ? `${path}.${k}` : k);
      }
    }
  }
  walk(input.args, "");
  if (argErrors.length > 0) {
    const first = argErrors[0];
    audit({
      actorUserId: ctx.user.id,
      actorSessionId: null,
      actorIp: ctx.ip,
      actorUserAgent: ctx.userAgent,
      surface: "incus",
      action: "incus.exec_named.reject",
      target: name,
      result: "denied",
      errorCode: "arg_smuggling",
      requestId: ctx.requestId,
      payload: { phase: "arg_smuggling", hits: argErrors, op: input.op },
    });
    return {
      status: "rejected",
      op: input.op,
      code: "arg_smuggling",
      reason: first.reason,
      field: first.field || "_root",
    };
  }

  // 4. PB-4 belt-and-braces: reject any input that contains a
  //    literal `bash -c` pair. The route already rejects the op
  //    name, but this catches a future caller that pre-constructs
  //    an argv from a config table.
  function argvContainsBashDashC(value: unknown): boolean {
    if (typeof value === "string") {
      return /\b(bash|sh|zsh|ksh)\s+-c\b/.test(value);
    }
    if (value === null || typeof value !== "object") return false;
    if (Array.isArray(value)) return value.some(argvContainsBashDashC);
    return Object.values(value as Record<string, unknown>).some(argvContainsBashDashC);
  }
  if (argvContainsBashDashC(input.args)) {
    audit({
      actorUserId: ctx.user.id,
      actorSessionId: null,
      actorIp: ctx.ip,
      actorUserAgent: ctx.userAgent,
      surface: "incus",
      action: "incus.exec_named.reject",
      target: name,
      result: "denied",
      errorCode: "argv_bash_c",
      requestId: ctx.requestId,
      payload: { phase: "argv_bash_c", op: input.op },
    });
    return {
      status: "rejected",
      op: input.op,
      code: "argv_bash_c",
      reason: "args contain a literal `bash -c` pair (SR-019)",
    };
  }

  // 5. Run the executor.
  let result: MockExecResult;
  try {
    result = await execNamedExecutor(input.op, input.args, name);
  } catch (e) {
    audit({
      actorUserId: ctx.user.id,
      actorSessionId: null,
      actorIp: ctx.ip,
      actorUserAgent: ctx.userAgent,
      surface: "incus",
      action: "incus.exec_named.dispatch",
      target: name,
      result: "failure",
      errorCode: "executor_error",
      requestId: ctx.requestId,
      payload: { op: input.op, error: (e as Error).message },
    });
    return {
      status: "rejected",
      op: input.op,
      code: "arg_type",
      reason: `executor error: ${(e as Error).message}`,
    };
  }

  audit({
    actorUserId: ctx.user.id,
    actorSessionId: null,
    actorIp: ctx.ip,
    actorUserAgent: ctx.userAgent,
    surface: "incus",
    action: "incus.exec_named.dispatch",
    target: name,
    result: result.exitCode === 0 ? "success" : "failure",
    errorCode: null,
    requestId: ctx.requestId,
    payload: { op: input.op, exitCode: result.exitCode },
  });

  return {
    status: "accepted",
    op: input.op,
    stdout: result.stdout,
    stderr: result.stderr,
    exitCode: result.exitCode,
  };
}

// ---------------------------------------------------------------------------
// Allowlist projection — used by the +page.server.ts loader for the UI.
// ---------------------------------------------------------------------------

/** Project the incus-surface allowlist into a UI shape. */
export function listInstanceActions(): readonly {
  action: IncusActionKind;
  description: string;
  requiresApproval: boolean;
}[] {
  return (["start", "stop", "restart", "delete", "launch", "list", "exec-named"] as const).map(
    (action) => {
      const policyName = `incus.${action}`;
      const entry = allowlistedCommand(policyName);
      return {
        action,
        description: entry?.description ?? `incus ${action} on an allowlisted instance.`,
        requiresApproval: entry?.requiresApproval ?? DESTRUCTIVE_ACTIONS.has(action),
      };
    },
  );
}

// ---------------------------------------------------------------------------
// Convenience re-exports for tests / consumers.
// ---------------------------------------------------------------------------

/** The default seed. Exposed so tests can assert against a known set. */
export const _SEED_INSTANCES: readonly MockInstanceRecord[] = SEED_INSTANCES;

/** Re-export the destructive-action set for tests. */
export const _DESTRUCTIVE_ACTIONS: ReadonlySet<IncusActionKind> = DESTRUCTIVE_ACTIONS;
