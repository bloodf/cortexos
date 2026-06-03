/**
 * Docker entities: Container, Image, Volume, Network.
 *
 * Source: `/api/docker` returns `{ containers: {data, error?}, ... }`;
 * the inner `data` is the entity list. The audit's M0-C matrix mocks
 * these per DOCKER-001..037.
 */

import { z } from 'zod';
import { asContainerId, asImageId, asVolumeName, asNetworkId } from '../primitives';
import { DOCKER_STATES } from '../enums';

export const dockerContainerSchema = z.object({
	id: z.string().min(1),
	name: z.string().min(1),
	image: z.string().min(1),
	status: z.string(),
	state: z.enum(DOCKER_STATES),
	ports: z.array(z.string()),
	created: z.string().datetime(),
	createdBy: z.string().nullable().optional(),
	mounts: z.array(z.string()).optional(),
	networkMode: z.string().nullable().optional(),
	env: z.record(z.string(), z.string()).optional(),
});
export type DockerContainer = z.infer<typeof dockerContainerSchema> & { id: string };

export const dockerImageSchema = z.object({
	id: z.string().min(1),
	repo: z.string().min(1),
	tag: z.string().min(1),
	size: z.number().nonnegative(),
	created: z.string().datetime(),
});
export type DockerImage = z.infer<typeof dockerImageSchema> & { id: string };

export const dockerVolumeSchema = z.object({
	name: z.string().min(1),
	driver: z.string(),
	mountpoint: z.string(),
	size: z.number().nonnegative().nullable(),
});
export type DockerVolume = z.infer<typeof dockerVolumeSchema> & { name: string };

export const dockerNetworkSchema = z.object({
	id: z.string().min(1),
	name: z.string().min(1),
	driver: z.string(),
	scope: z.string(),
	createdAt: z.string().datetime().optional(),
});
export type DockerNetwork = z.infer<typeof dockerNetworkSchema> & { id: string };

export const brandDockerContainer = (
	c: z.infer<typeof dockerContainerSchema>,
): z.infer<typeof dockerContainerSchema> & { id: ReturnType<typeof asContainerId> } => ({
	...c,
	id: asContainerId(c.id),
});
export const brandDockerImage = (
	i: z.infer<typeof dockerImageSchema>,
): z.infer<typeof dockerImageSchema> & { id: ReturnType<typeof asImageId> } => ({
	...i,
	id: asImageId(i.id),
});
export const brandDockerVolume = (
	v: z.infer<typeof dockerVolumeSchema>,
): z.infer<typeof dockerVolumeSchema> & { name: ReturnType<typeof asVolumeName> } => ({
	...v,
	name: asVolumeName(v.name),
});
export const brandDockerNetwork = (
	n: z.infer<typeof dockerNetworkSchema>,
): z.infer<typeof dockerNetworkSchema> & { id: ReturnType<typeof asNetworkId> } => ({
	...n,
	id: asNetworkId(n.id),
});
