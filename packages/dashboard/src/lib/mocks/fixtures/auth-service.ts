/**
 * Auth + service fixture factories.
 *
 * Every factory returns a Zod-parseable value (verified by the
 * `mocks.test.ts` round-trip tests) and is deterministic given the
 * global faker seed.
 */

import { faker } from '@faker-js/faker';
import { FROZEN_NOW, FROZEN_NOW_EPOCH, nextIdValue } from './seed';
import {
	brandUser,
	brandPamUser,
	GROUP_MEMBERSHIPS,
	type User,
	type PamUser,
	type Session,
	brandService,
	brandAlertRule,
	brandAlertEvent,
	type Service,
	type ServiceCheck,
	type ServiceHealthSnapshot,
	type AlertRule,
	type AlertHistory,
	type AlertEvent,
} from '../contracts';
import { SERVICE_CATEGORIES, SERVICE_HEALTH_TYPES, SERVICE_KINDS, SERVICE_STATUSES } from '../contracts/enums';

const nextId = (prefix: string) =>
	`${prefix}_${nextIdValue().toString().padStart(4, '0')}`;

export const makeUser = (overrides: Partial<User> = {}): User => {
	const groups = faker.helpers.arrayElements(GROUP_MEMBERSHIPS, { min: 0, max: 2 });
	const isAdmin = groups.some((g) => g === 'cortexos-admin' || g === 'sudo');
	return brandUser({
		id: nextId('usr'),
		username: faker.internet.username().toLowerCase().replace(/[^a-z0-9_]/g, ''),
		isAdmin,
		isActive: true,
		groupMemberships: groups,
		createdAt: FROZEN_NOW,
		lastLoginAt: FROZEN_NOW,
		email: faker.internet.email().toLowerCase(),
		...overrides,
	});
};

export const makeAdminUser = (): User =>
	makeUser({ isAdmin: true, groupMemberships: ['cortexos-admin'] });
export const makeStandardUser = (): User => makeUser({ isAdmin: false, groupMemberships: [] });

export const makeSession = (overrides: Partial<Session> = {}): Session => ({
	id: nextId('sess'),
	userId: 'usr_default',
	csrfToken: faker.string.alphanumeric(64),
	expiresAt: new Date(FROZEN_NOW_EPOCH + 3_600_000).toISOString(),
	ua: faker.internet.userAgent(),
	ip: faker.internet.ipv4(),
	createdAt: FROZEN_NOW,
	...overrides,
});

export const makePamUser = (overrides: Partial<PamUser> = {}): PamUser => {
	const u = makeUser();
	return brandPamUser({
		id: u.id,
		username: u.username,
		createdAt: FROZEN_NOW,
		activeSessions: faker.number.int({ min: 0, max: 3 }),
		lastLoginAt: FROZEN_NOW,
		groups: u.groupMemberships as string[],
		isAdmin: u.isAdmin,
		...overrides,
	});
};

const APP_NAMES = [
	'grafana',
	'prometheus',
	'9router',
	'paperclip',
	'home-assistant',
	'jellyfin',
	'nextcloud',
	'caddy',
	'ollama',
	'cortexos-mail-guardian',
];

export const makeService = (overrides: Partial<Service> = {}): Service => {
	const slug = overrides.slug ?? faker.helpers.arrayElement(APP_NAMES);
	const isHealthy = faker.datatype.boolean({ probability: 0.8 });
	return brandService({
		id: nextId('svc'),
		slug,
		name: slug.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()),
		description: faker.lorem.sentence({ min: 4, max: 10 }),
		category: faker.helpers.arrayElement(SERVICE_CATEGORIES),
		status: isHealthy ? 'online' : faker.helpers.arrayElement(['offline', 'degraded'] as const),
		responseTime: isHealthy ? faker.number.int({ min: 5, max: 250 }) : 0,
		iconColor: faker.helpers.arrayElement(['emerald', 'teal', 'amber', 'cortex'] as const),
		iconImage: null,
		openUrl: faker.internet.url(),
		healthUrl: `https://${slug}.local/healthz`,
		healthType: faker.helpers.arrayElement(SERVICE_HEALTH_TYPES),
		kind: faker.helpers.arrayElement(SERVICE_KINDS),
		envSource: null,
		isActive: true,
		hasWebui: true,
		showInHealthcheck: faker.datatype.boolean({ probability: 0.7 }),
		showInWebui: true,
		sortOrder: faker.number.int({ min: 0, max: 100 }),
		iconType: faker.helpers.arrayElement(['lucide', 'image', 'mono'] as const),
		badges: [],
		createdAt: FROZEN_NOW,
		updatedAt: FROZEN_NOW,
		...overrides,
	});
};

export const makeServiceCheck = (overrides: Partial<ServiceCheck> = {}): ServiceCheck => {
	const svc = makeService();
	return {
		slug: svc.slug,
		name: svc.name,
		category: svc.category,
		status: svc.status,
		responseTime: svc.responseTime,
		iconColor: svc.iconColor,
		iconImage: svc.iconImage,
		description: svc.description,
		openUrl: svc.openUrl,
		badges: svc.badges,
		kind: svc.kind,
		...overrides,
	};
};

export const makeServiceHealthSnapshot = (
	overrides: Partial<ServiceHealthSnapshot> = {},
): ServiceHealthSnapshot => ({
	id: nextId('snap'),
	serviceId: 'svc_0001',
	status: faker.helpers.arrayElement(SERVICE_STATUSES),
	latencyMs: faker.number.int({ min: 0, max: 1000 }),
	checkedAt: FROZEN_NOW,
	...overrides,
});

export const makeAlertRule = (overrides: Partial<AlertRule> = {}): AlertRule => {
	const svc = makeService();
	return brandAlertRule({
		id: nextId('rule'),
		name: `${svc.name} offline`,
		serviceId: svc.id,
		condition: faker.helpers.arrayElement(['offline', 'online', 'response_time'] as const),
		thresholdMs: faker.helpers.arrayElement([100, 250, 500, 1000]),
		enabled: faker.datatype.boolean({ probability: 0.7 }),
		severity: faker.helpers.arrayElement(['info', 'warning', 'critical'] as const),
		channels: ['email'],
		createdAt: FROZEN_NOW,
		updatedAt: FROZEN_NOW,
		...overrides,
	});
};

export const makeAlertHistory = (overrides: Partial<AlertHistory> = {}): AlertHistory => {
	const rule = makeAlertRule();
	return {
		id: nextId('hist'),
		ruleName: rule.name,
		serviceName: 'grafana',
		status: faker.helpers.arrayElement(['fired', 'resolved', 'info'] as const),
		message: faker.lorem.sentence(),
		severity: rule.severity,
		timestamp: FROZEN_NOW,
		resolvedAt: faker.helpers.arrayElement([null, FROZEN_NOW]),
		...overrides,
	};
};

export const makeAlertEvent = (overrides: Partial<AlertEvent> = {}): AlertEvent => {
	const rule = makeAlertRule();
	return brandAlertEvent({
		id: nextId('evt'),
		ruleId: rule.id,
		severity: rule.severity,
		status: faker.helpers.arrayElement(['fired', 'resolved', 'info'] as const),
		message: faker.lorem.sentence(),
		firedAt: FROZEN_NOW,
		resolvedAt: faker.helpers.arrayElement([null, FROZEN_NOW]),
		...overrides,
	});
};

export const makeMany = <T>(factory: () => T, count: number): T[] => {
	const out: T[] = [];
	for (let i = 0; i < count; i++) out.push(factory());
	return out;
};

/**
 * List-factory aliases used by canonical.ts. These exist so handlers
 * and scenarios can keep list sizes in one place; tweaking the count
 * here changes the E2E matrix's row coverage (e.g. overview widget
 * tests need N>1 to exercise the "list not empty" branch).
 */
export const makeServiceList = (n = 6) => makeMany(makeService, n);
export const makeServiceCheckList = (n = 6) => makeMany(makeServiceCheck, n);
export const makeAlertRuleList = (n = 4) => makeMany(makeAlertRule, n);
export const makeAlertHistoryList = (n = 4) => makeMany(makeAlertHistory, n);
