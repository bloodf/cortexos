/**
 * Service registry entities: Service, ServiceCheck, ServiceHealthSnapshot.
 *
 * Source: `/api/services` (default GET returns ServiceCheck[]; admin
 * CRUD returns full Service). `kind` is the discriminator the M0-A audit
 * uses to fold docker/systemd/process into the same registry surface.
 */

import { z } from 'zod';
import { asServiceId, type ServiceId } from '../primitives';
import {
	SERVICE_CATEGORIES,
	SERVICE_HEALTH_TYPES,
	SERVICE_KINDS,
	SERVICE_STATUSES,
} from '../enums';

export const badgeRefSchema = z.object({
	slug: z.string().min(1),
	label: z.string().min(1),
	color: z.string(),
});
export type BadgeRef = z.infer<typeof badgeRefSchema>;

const baseServiceFields = {
	id: z.string().min(1),
	slug: z.string().min(1),
	name: z.string().min(1),
	description: z.string().default(''),
	category: z.enum(SERVICE_CATEGORIES),
	status: z.enum(SERVICE_STATUSES),
	responseTime: z.number().int().nonnegative(),
	iconColor: z.string().nullable(),
	iconImage: z.string().nullable(),
	openUrl: z.string().url().nullable(),
	healthUrl: z.string().url().nullable(),
	healthType: z.enum(SERVICE_HEALTH_TYPES),
	kind: z.enum(SERVICE_KINDS),
	envSource: z.string().nullable(),
	isActive: z.boolean(),
	hasWebui: z.boolean(),
	showInHealthcheck: z.boolean(),
	showInWebui: z.boolean(),
	sortOrder: z.number().int(),
	iconType: z.enum(['lucide', 'image', 'mono']),
	badges: z.array(badgeRefSchema),
	createdAt: z.string().datetime(),
	updatedAt: z.string().datetime(),
};

export const serviceSchema = z.object(baseServiceFields);
export type Service = z.infer<typeof serviceSchema> & { id: ServiceId; slug: string };

/**
 * ServiceCheck = the "live" view of a Service after the registry has
 * probed it. Drops registry-only fields. Returned by the default
 * `GET /api/services` (with `?raw=1` adding back the registry fields).
 */
export const serviceCheckSchema = z.object({
	slug: z.string().min(1),
	name: z.string().min(1),
	category: z.enum(SERVICE_CATEGORIES),
	status: z.enum(SERVICE_STATUSES),
	responseTime: z.number().int().nonnegative(),
	iconColor: z.string().nullable(),
	iconImage: z.string().nullable(),
	description: z.string().default(''),
	openUrl: z.string().url().nullable(),
	badges: z.array(badgeRefSchema),
	kind: z.enum(SERVICE_KINDS),
});
export type ServiceCheck = z.infer<typeof serviceCheckSchema>;

export const serviceHealthSnapshotSchema = z.object({
	id: z.string().min(1),
	serviceId: z.string().min(1),
	status: z.enum(SERVICE_STATUSES),
	latencyMs: z.number().int().nonnegative(),
	checkedAt: z.string().datetime(),
});
export type ServiceHealthSnapshot = z.infer<typeof serviceHealthSnapshotSchema>;

export const brandService = (s: z.infer<typeof serviceSchema>): Service => ({
	...s,
	id: asServiceId(s.id),
});
