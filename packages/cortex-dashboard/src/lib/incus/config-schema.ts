/**
 * Zod schema for IncusInstanceConfig — shared by the instance API routes to
 * validate request bodies before they reach the deterministic libs.
 */
import { z } from "zod";
import { KNOWN_PROXIES, HERMES_PORT_MIN, HERMES_PORT_MAX } from "./instance-config";

export const incusInstanceConfigSchema = z.object({
	target: z.object({
		mode: z.enum(["existing", "new"]),
		repoUrl: z.string().max(512).optional(),
		branch: z.string().min(1).max(128),
		ghOrg: z.string().min(1).max(128),
		slug: z.string().min(1).max(63),
		description: z.string().max(4000).optional(),
	}),
	image: z.object({
		alias: z.string().min(1).max(256),
		gastown: z.boolean(),
		profiles: z.array(z.string().max(63)).max(16),
		cpu: z.string().max(16).optional(),
		memory: z.string().max(16).optional(),
		pool: z.string().min(1).max(128),
	}),
	hermes: z.object({
		enabled: z.boolean(),
		profile: z.string().max(63),
		port: z.number().int().min(HERMES_PORT_MIN).max(HERMES_PORT_MAX).or(z.literal(0)),
		model: z.string().max(128),
		proxies: z.array(z.enum(KNOWN_PROXIES)).max(3),
	}),
	network: z.object({
		bridge: z.string().min(1).max(128),
		tailscale: z.boolean(),
		tailscaleKeyRef: z.string().max(128).optional(),
		webAccess: z.string().max(64),
	}),
	ai: z
		.object({
			analysis: z.record(z.string(), z.unknown()).optional(),
			modelUsed: z.string().max(128).optional(),
		})
		.optional(),
});
