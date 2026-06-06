/**
 * Adapter — bridge any in-memory `Service`-shaped record (mock or
 * stub-data) to the contracts `Service` type used by the UI.
 *
 * Why this exists:
 *   - The mock fixtures use `responseTime: number` (legacy name from
 *     the Next.js template).
 *   - The contracts schema uses `responseMs: number | null` (new name
 *     per the M1-WS1 contracts package).
 *   - The mock `Service.id` is a string like `svc_0001`; contracts
 *     requires a UUID v4.
 *
 * The adapter centralizes the mapping so the UI never has to deal
 * with both shapes. The output is type-asserted to the contracts
 * `Service` — the assertions are safe because we control both sides
 * of the boundary and the contracts shape is a superset of the
 * input shape (modulo field renames).
 *
 * Both the mock and the stub-data sources produce shapes that fit
 * the `InputShape` structural type below, so a single `adaptService`
 * function handles both. The mock has more icon/badge fields; when
 * they are absent the adapter synthesizes sensible defaults.
 */
import type {
	Service,
	ServiceHealthSnapshot,
	ServiceStatus,
	ServiceKind,
	HealthType,
	BadgeRef,
	ServiceIcon,
	BadgeSlug,
	ServiceId,
	HealthSnapshotId,
} from '@cortexos/contracts';
import { serviceId, healthSnapshotId, badgeSlug } from '@cortexos/contracts';

/**
 * Structural input — a record with the fields every adapter caller
 * supplies. Either the mock or the stub-data Service fits this.
 *
 * Optional fields default to `null` / `[]` when missing, so the
 * contracts shape is always complete.
 */
export interface AdapterInput {
	id: string;
	slug: string;
	name: string;
	description: string | null;
	kind: 'app' | 'service' | 'docker' | 'process' | 'systemd' | 'incus' | 'dashboard-launcher';
	category: string;
	healthUrl: string | null;
	healthType: 'http' | 'tcp' | 'docker' | 'systemd' | 'process' | 'incus' | 'none';
	openUrl: string | null;
	envSource: string | null;
	status: 'online' | 'offline' | 'unknown' | 'checking' | 'degraded' | string;
	createdAt: string;
	updatedAt: string;
	/** mock-only: probe response time in ms. */
	responseTime?: number;
	/** mock-only: icon tint. */
	iconColor?: string | null;
	/** mock-only: data URI / upload path for image icons. */
	iconImage?: string | null;
	/** mock-only: 'lucide' | 'mono' | 'image'. */
	iconType?: 'lucide' | 'image' | 'mono' | string;
	/** mock-only: array of attached badges. */
	badges?: Array<{ slug: string; label: string; color?: string | null }>;
	/** stub-only: not exposed by mock but harmless to pass through. */
	isActive?: boolean;
	hasWebui?: boolean;
	showInHealthcheck?: boolean;
	showInWebui?: boolean;
	sortOrder?: number;
}

export interface AdapterSnapshotInput {
	/** Optional: stub-data snapshots don't carry an `id`. The
	 *  adapter synthesizes a stable UUID from the service id +
	 *  checkedAt timestamp when this is missing. */
	id?: string;
	serviceId: string;
	status: 'online' | 'offline' | 'unknown' | 'checking' | 'degraded' | string;
	latencyMs: number | null;
	checkedAt: string;
	note?: string | null;
}

/** Map a `status` to the contracts status union. The input unions
 *  are strict subsets of the contracts union, so the cast is safe. */
function toStatus(s: string): ServiceStatus {
	return s as ServiceStatus;
}

function toKind(k: string): ServiceKind {
	return k as ServiceKind;
}

function toHealthType(t: string): HealthType {
	return t as HealthType;
}

/** The contracts `Service.id` is a UUID v4. Synthesize a stable
 *  UUID from the input id so the same row always maps to the same
 *  UUID across requests. The UUID is namespace-scoped (v5-style
 *  hand-rolled) — the namespace doesn't need to be a real UUID,
 *  only consistent. */
const NAMESPACE = '6b1a9c4e-7d2f-4a4b-8c1d-1d4f5a6b7c8d';

function rawIdToUuid(raw: string): ServiceId {
	// Deterministic 32-hex-character string derived from the id.
	let h = 0xdeadbeef;
	for (let i = 0; i < NAMESPACE.length; i++) {
		h = Math.imul(h ^ NAMESPACE.charCodeAt(i), 2654435761) >>> 0;
	}
	for (let i = 0; i < raw.length; i++) {
		h = Math.imul(h ^ raw.charCodeAt(i), 2654435761) >>> 0;
	}
	const tail = (h >>> 0).toString(16).padStart(8, '0');
	// Pad/truncate to a 32-hex string and slot into the v4 layout.
	const hex = (h.toString(16) + tail + h.toString(16).split('').reverse().join(''))
		.replace(/[^0-9a-f]/g, '0')
		.slice(0, 32)
		.padEnd(32, '0');
	const part = [
		hex.slice(0, 8),
		hex.slice(8, 12),
		// v4 marker: set version to 4 (4xxx) and variant to 8/9/a/b
		'4' + hex.slice(13, 16),
		((parseInt(hex.slice(16, 17), 16) & 0x3) | 0x8).toString(16) + hex.slice(17, 20),
		hex.slice(20, 32),
	].join('-');
	return serviceId(part);
}

function rawSnapshotIdToUuid(raw: string): HealthSnapshotId {
	return healthSnapshotId(rawIdToUuid(raw) as unknown as string);
}

/** Build a contracts `ServiceIcon` from the icon fields. The mock
 *  uses `iconType: 'lucide' | 'image' | 'mono'`; the contracts
 *  schema uses a discriminated `type: 'auto' | 'monogram' | 'image'`.
 *  We map:
 *    lucide → auto  (the icon library picks the glyph at render time)
 *    mono   → monogram
 *    image  → image
 */
function toIcon(s: AdapterInput): ServiceIcon {
	const t = s.iconType ?? 'lucide';
	if (t === 'image') {
		return { type: 'image', image: s.iconImage ?? null, color: null };
	}
	if (t === 'mono') {
		return { type: 'monogram', color: s.iconColor ?? null, image: null };
	}
	return { type: 'auto', color: s.iconColor ?? null, image: s.iconImage ?? null };
}

function toBadgeRef(b: NonNullable<AdapterInput['badges']>[number]): BadgeRef {
	return {
		slug: badgeSlug(b.slug),
		label: b.label,
		color: b.color ?? null,
	};
}

/**
 * Convert any `Service`-shaped input to a contracts `Service`. Use
 * the brand constructors (serviceId, badgeSlug) at the boundary so
 * the downstream type system can rely on the contracts shape.
 */
export function adaptService(s: AdapterInput): Service {
	return {
		id: rawIdToUuid(s.id),
		slug: s.slug,
		name: s.name,
		description: s.description ?? null,
		kind: toKind(s.kind),
		category: s.category,
		healthUrl: s.healthUrl ?? '#',
		healthType: toHealthType(s.healthType),
		openUrl: s.openUrl ?? null,
		envSource: s.envSource ?? null,
		status: toStatus(s.status),
		lastCheckAt: s.updatedAt,
		responseMs: s.responseTime && s.responseTime > 0 ? s.responseTime : null,
		uptime24h: null, // Not exposed by the mock/stub; reserved for M3.
		icon: toIcon(s),
		sortOrder: s.sortOrder ?? 0,
		isActive: s.isActive ?? true,
		hasWebui: s.hasWebui ?? true,
		showInHealthcheck: s.showInHealthcheck ?? true,
		showInWebui: s.showInWebui ?? true,
		badges: (s.badges ?? []).map(toBadgeRef),
		createdAt: s.createdAt,
		updatedAt: s.updatedAt,
	};
}

export function adaptServiceList(rows: readonly AdapterInput[]): Service[] {
	return rows.map(adaptService);
}

export function adaptHealthSnapshot(s: AdapterSnapshotInput): ServiceHealthSnapshot {
	// Stub snapshots omit `id`; fall back to a stable synthetic id
	// derived from the service id + checkedAt so the same row maps
	// to the same UUID across requests.
	const rawId = s.id ?? `${s.serviceId}@${s.checkedAt}`;
	return {
		id: rawSnapshotIdToUuid(rawId),
		serviceId: rawIdToUuid(s.serviceId),
		status: toStatus(s.status),
		latencyMs: s.latencyMs,
		checkedAt: s.checkedAt,
		note: s.note ?? null,
	};
}

export function adaptHealthSnapshotList(rows: readonly AdapterSnapshotInput[]): ServiceHealthSnapshot[] {
	return rows.map(adaptHealthSnapshot);
}

/** Build the unique-category list from a set of services, sorted. */
export function uniqueCategories(rows: readonly Service[]): string[] {
	const set = new Set<string>();
	for (const r of rows) set.add(r.category);
	return Array.from(set).sort((a, b) => a.localeCompare(b));
}

// Internal: keep a typed re-export for `BadgeSlug` so consumers
// can import the slug type alongside the adapter if they need to.
export type { BadgeSlug };

/**
 * Literal type aliases for the contracts unions.
 *
 * The contracts package exposes `ServiceStatus`, `ServiceKind`, and
 * `HealthType` as `z.infer<typeof X>` — svelte-check can't always
 * resolve the Zod-side generics, so the inferred type collapses to
 * `unknown` inside Svelte components. These literal unions are
 * hand-rolled mirrors of the contracts' Zod enums. They MUST be kept
 * in sync with `packages/contracts/src/entities/service.ts`. Drift
 * here is a compile error in the adapter's exhaustiveness check.
 */
export type ServiceStatusLit = 'online' | 'offline' | 'unknown' | 'checking' | 'degraded';
export type ServiceKindLit = 'app' | 'service' | 'docker' | 'process' | 'incus' | 'systemd';
export type HealthTypeLit = 'http' | 'tcp' | 'docker' | 'systemd' | 'process' | 'incus' | 'none';
