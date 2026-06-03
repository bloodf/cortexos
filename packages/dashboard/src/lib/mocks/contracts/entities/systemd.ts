/**
 * Systemd entities: SystemdUnit.
 *
 * Source: `/api/systemd` returns `{ services: SystemdUnit[] }`.
 * Aligned with the M0-C matrix §8 (SYSTEMD-001..022).
 */

import { z } from 'zod';
import { asSystemdUnitName } from '../primitives';
import { SYSTEMD_ACTIVE_STATES, SYSTEMD_LOAD_STATES } from '../enums';

export const systemdUnitSchema = z.object({
	name: z.string().min(1),
	description: z.string(),
	load: z.enum(SYSTEMD_LOAD_STATES),
	active: z.enum(SYSTEMD_ACTIVE_STATES),
	sub: z.string(),
	enabled: z.boolean(),
	pid: z.number().int().positive().optional(),
	jobId: z.number().int().nonnegative().optional(),
	path: z.string().optional(),
});
export type SystemdUnit = z.infer<typeof systemdUnitSchema> & { name: ReturnType<typeof asSystemdUnitName> };

export const brandSystemdUnit = (u: z.infer<typeof systemdUnitSchema>): SystemdUnit => ({
	...u,
	name: asSystemdUnitName(u.name),
});
