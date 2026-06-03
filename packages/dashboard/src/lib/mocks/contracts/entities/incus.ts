/**
 * Incus entities: IncusInstance (live and DB shapes), IncusImage,
 * IncusInstanceConfig, WizardDefaults, IncusPreflightReport,
 * ProgressStep, IncusInstanceDetail.
 *
 * Two distinct "IncusInstance" shapes exist in the audit:
 *   - Live:  from `incus list` — name, status, status_code, type,
 *     architecture, created_at, state.networks, profiles, snapshots.
 *   - DB:    from `/api/incus/instances` — name, slug, status
 *     (draft/validated/provisioning/active/failed), type, image,
 *     cpu, memory, config, devices, last_validation, created_at.
 *
 * We model both as separate types so the matrix's two list endpoints
 * have unambiguous schemas.
 */

import { z } from 'zod';
import {
	asIncusInstanceId,
	asIncusImageFingerprint,
	type IncusInstanceId,
	type IncusImageFingerprint,
} from '../primitives';
import { INCUS_INSTANCE_STATUSES, INCUS_INSTANCE_TYPES } from '../enums';

export const incusImageSchema = z.object({
	fingerprint: z.string().min(1),
	architecture: z.string().min(1),
	type: z.string().min(1),
	size: z.number().nonnegative(),
	uploadedAt: z.string().datetime(),
	aliases: z.array(z.string()),
	description: z.string().optional(),
	os: z.string().optional(),
	release: z.string().optional(),
});
export type IncusImage = z.infer<typeof incusImageSchema> & {
	fingerprint: IncusImageFingerprint;
};

const instanceTargetSchema = z.object({
	mode: z.enum(['new', 'clone']),
	repoUrl: z.string().nullable().optional(),
	branch: z.string().min(1),
	ghOrg: z.string().min(1),
	slug: z.string().min(1),
	description: z.string().optional(),
});
const instanceImageSchema = z.object({
	alias: z.string().min(1),
	gastown: z.boolean().default(false),
	profiles: z.array(z.string()).default([]),
	cpu: z.number().int().positive().optional(),
	memory: z.number().int().positive().optional(),
	pool: z.string().min(1),
});
const instanceHermesSchema = z.object({
	enabled: z.boolean(),
	profile: z.string().nullable(),
	port: z.number().int().positive().nullable(),
	model: z.string().nullable(),
	proxies: z.array(z.string()),
});
const instanceNetworkSchema = z.object({
	bridge: z.string().min(1),
	tailscale: z.boolean(),
	tailscaleKeyRef: z.string().nullable().optional(),
	webAccess: z.boolean(),
});

export const incusInstanceConfigSchema = z.object({
	target: instanceTargetSchema,
	image: instanceImageSchema,
	hermes: instanceHermesSchema,
	network: instanceNetworkSchema,
});
export type IncusInstanceConfig = z.infer<typeof incusInstanceConfigSchema>;

/** Live shape from `incus list`. */
export const incusInstanceLiveSchema = z.object({
	name: z.string().min(1),
	status: z.string(),
	statusCode: z.number().int(),
	type: z.string(),
	architecture: z.string(),
	createdAt: z.string().datetime(),
	state: z.object({
		networks: z.object({
			addresses: z.array(z.string()),
		}),
		pid: z.number().int().optional(),
	}),
	profiles: z.array(z.string()),
	snapshots: z.array(z.string()).default([]),
});
export type IncusInstanceLive = z.infer<typeof incusInstanceLiveSchema>;

/** DB shape from `/api/incus/instances`. */
export const incusInstanceDbSchema = z.object({
	name: z.string().min(1),
	slug: z.string().min(1),
	status: z.enum(INCUS_INSTANCE_STATUSES),
	type: z.enum(INCUS_INSTANCE_TYPES),
	image: z.string().min(1),
	cpu: z.number().int().positive().nullable(),
	memory: z.number().int().positive().nullable(),
	config: incusInstanceConfigSchema,
	devices: z.record(z.string(), z.unknown()),
	lastValidation: z.unknown().nullable(),
	createdBy: z.string().nullable(),
	createdAt: z.string().datetime(),
	updatedAt: z.string().datetime(),
	lastRequestId: z.string().nullable().optional(),
	liveStatus: z.string().nullable().optional(),
});
export type IncusInstanceDb = z.infer<typeof incusInstanceDbSchema> & { name: IncusInstanceId };

/** Admin detail page shape. */
export const incusInstanceDetailSchema = z.object({
	name: z.string().min(1),
	slug: z.string().nullable().optional(),
	status: z.enum(INCUS_INSTANCE_STATUSES),
	config: incusInstanceConfigSchema,
	devices: z.record(z.string(), z.unknown()),
	lastValidation: z.unknown().nullable().optional(),
	lastRequestId: z.string().nullable().optional(),
	createdBy: z.string().nullable().optional(),
	createdAt: z.string().datetime(),
	updatedAt: z.string().datetime(),
	liveStatus: z.string().nullable().optional(),
});
export type IncusInstanceDetail = z.infer<typeof incusInstanceDetailSchema> & {
	name: IncusInstanceId;
};

export const wizardDefaultsSchema = z.object({
	image: z.string().min(1),
	ghOrg: z.string().min(1),
	bridge: z.string().min(1),
	pool: z.string().min(1),
	branch: z.string().min(1),
	proxies: z.array(z.string()),
});
export type WizardDefaults = z.infer<typeof wizardDefaultsSchema>;

export const incusPreflightReportSchema = z.object({
	ok: z.boolean(),
	checks: z.array(
		z.object({
			id: z.string().min(1),
			label: z.string().min(1),
			pass: z.boolean(),
			detail: z.string().optional(),
		}),
	),
});
export type IncusPreflightReport = z.infer<typeof incusPreflightReportSchema>;

export const progressStepSchema = z.object({
	step: z.string().min(1),
	status: z.string(),
	n: z.number().int().nonnegative().optional(),
	total: z.number().int().nonnegative().optional(),
	detail: z.string().optional(),
});
export type ProgressStep = z.infer<typeof progressStepSchema>;

export const incusShellResultSchema = z.object({
	stdout: z.string(),
	stderr: z.string(),
	exitCode: z.number().int().optional(),
});
export type IncusShellResult = z.infer<typeof incusShellResultSchema>;

export const brandIncusInstanceDb = (i: z.infer<typeof incusInstanceDbSchema>): IncusInstanceDb => ({
	...i,
	name: asIncusInstanceId(i.name),
});
export const brandIncusInstanceDetail = (
	i: z.infer<typeof incusInstanceDetailSchema>,
): IncusInstanceDetail => ({ ...i, name: asIncusInstanceId(i.name) });
export const brandIncusImage = (i: z.infer<typeof incusImageSchema>): IncusImage => ({
	...i,
	fingerprint: asIncusImageFingerprint(i.fingerprint),
});
