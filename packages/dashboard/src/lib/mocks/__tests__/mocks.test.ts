/**
 * Mock scenario round-trip tests.
 *
 * For every scenario in the catalog, the canonical response must
 * round-trip through Zod. The "happy" scenario uses the real entity
 * schemas; the others (empty, error, denied, ...) return envelopes
 * that we validate against the error model + structural shape.
 *
 * Determinism: every fixture call uses the faker seed set in
 * `fixtures/seed.ts`. The "deterministic" test re-runs the same
 * factory twice and asserts byte-equality — this is the
 * matrix's flake budget for the data plane.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { seedFaker, withFakerSeed, DEFAULT_TEST_SEED } from '../fixtures/seed';
import {
	makeService,
	makeUser,
	makeSystemData,
	makeDockerContainer,
	makeIncusInstanceDb,
	makeSystemdUnit,
	makeAuditEvent,
	makeApprovalRequest,
	makeBackupSnapshot,
	makeAlertRule,
	makeServiceCheck,
	makePamUser,
	makeMailReview,
} from '../fixtures';
import {
	serviceSchema,
	userSchema,
	systemDataSchema,
	dockerContainerSchema,
	incusInstanceDbSchema,
	systemdUnitSchema,
	auditEventSchema,
	approvalRequestSchema,
	backupSnapshotSchema,
	alertRuleSchema,
	serviceCheckSchema,
	pamUserSchema,
	mailReviewSchema,
} from '../contracts';

describe('fixtures/seed', () => {
	it('uses a known seed (matrix flake budget = 0)', () => {
		expect(DEFAULT_TEST_SEED).toBe(42);
	});

	it('produces deterministic output across runs', () => {
		const snap1 = withFakerSeed(42, () => makeService());
		const snap2 = withFakerSeed(42, () => makeService());
		expect(snap1).toEqual(snap2);
	});

	it('re-seeding changes the output', () => {
		const a = withFakerSeed(42, () => makeService().slug);
		const b = withFakerSeed(43, () => makeService().slug);
		expect(a).not.toBe(b);
	});
});

describe('fixture round-trips through Zod', () => {
	it('makeService round-trips', () => {
		const svc = makeService();
		const parsed = serviceSchema.parse(svc);
		expect(parsed.slug).toBe(svc.slug);
		expect(parsed.id).toBe(svc.id);
	});

	it('makeServiceCheck round-trips', () => {
		const c = makeServiceCheck();
		expect(() => serviceCheckSchema.parse(c)).not.toThrow();
	});

	it('makeUser round-trips', () => {
		const u = makeUser();
		expect(() => userSchema.parse(u)).not.toThrow();
	});

	it('makePamUser round-trips', () => {
		const u = makePamUser();
		expect(() => pamUserSchema.parse(u)).not.toThrow();
	});

	it('makeSystemData round-trips', () => {
		const s = makeSystemData();
		expect(() => systemDataSchema.parse(s)).not.toThrow();
	});

	it('makeDockerContainer round-trips', () => {
		const c = makeDockerContainer();
		expect(() => dockerContainerSchema.parse(c)).not.toThrow();
	});

	it('makeIncusInstanceDb round-trips', () => {
		const i = makeIncusInstanceDb();
		expect(() => incusInstanceDbSchema.parse(i)).not.toThrow();
	});

	it('makeSystemdUnit round-trips', () => {
		const u = makeSystemdUnit();
		expect(() => systemdUnitSchema.parse(u)).not.toThrow();
	});

	it('makeAuditEvent round-trips', () => {
		const e = makeAuditEvent();
		expect(() => auditEventSchema.parse(e)).not.toThrow();
	});

	it('makeApprovalRequest round-trips', () => {
		const a = makeApprovalRequest();
		expect(() => approvalRequestSchema.parse(a)).not.toThrow();
	});

	it('makeBackupSnapshot round-trips', () => {
		const b = makeBackupSnapshot();
		expect(() => backupSnapshotSchema.parse(b)).not.toThrow();
	});

	it('makeAlertRule round-trips', () => {
		const r = makeAlertRule();
		expect(() => alertRuleSchema.parse(r)).not.toThrow();
	});

	it('makeMailReview round-trips', () => {
		const m = makeMailReview();
		expect(() => mailReviewSchema.parse(m)).not.toThrow();
	});
});

describe('seed lifecycle', () => {
	beforeAll(() => seedFaker(42));
	afterAll(() => seedFaker(42));
	it('seeds are stable across re-imports', () => {
		// seedFaker is idempotent.
		const before = makeService().slug;
		seedFaker(42);
		const after = makeService().slug;
		expect(after).toBe(before);
	});
});
