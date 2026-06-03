/**
 * Admin-side entities: Badge, Project, Agent, PamUser, MailReview.
 *
 * Source: `/api/badges`, `/api/projects`, `/api/agents`,
 * `/api/admin/users`, `/api/mail-guardian/reviews`.
 */

import { z } from 'zod';
import { asBadgeSlug, asProjectSlug, asAgentSlug, asMailReviewId } from '../primitives';
import { MAIL_DECISIONS, MAIL_VERDICTS } from '../enums';

export const badgeSchema = z.object({
	slug: z.string().min(1),
	label: z.string().min(1),
	color: z.string(),
	textColor: z.string().optional(),
	createdAt: z.string().datetime().optional(),
});
export type Badge = z.infer<typeof badgeSchema> & { slug: ReturnType<typeof asBadgeSlug> };

export const projectSchema = z.object({
	slug: z.string().min(1),
	name: z.string().min(1),
	repoUrl: z.string().url().nullable(),
	branch: z.string().min(1).default('main'),
	messagingMode: z.enum(['single', 'distributed']),
	description: z.string().default(''),
	createdAt: z.string().datetime(),
});
export type Project = z.infer<typeof projectSchema> & { slug: ReturnType<typeof asProjectSlug> };

export const agentFileSchema = z.object({
	name: z.string().min(1),
	path: z.string().min(1),
	language: z.string().optional(),
	content: z.string().optional(),
	size: z.number().int().nonnegative().optional(),
});
export type AgentFile = z.infer<typeof agentFileSchema>;

export const agentSchema = z.object({
	slug: z.string().min(1),
	name: z.string().min(1),
	description: z.string().default(''),
	project: z.string().min(1).optional(),
	files: z.array(agentFileSchema),
});
export type Agent = z.infer<typeof agentSchema> & { slug: ReturnType<typeof asAgentSlug> };

export const mailReviewSchema = z.object({
	id: z.string().min(1),
	accountSlug: z.string().min(1),
	messageUid: z.string().min(1),
	messageId: z.string().nullable(),
	fromAddr: z.string().nullable(),
	subject: z.string().nullable(),
	modelVerdict: z.enum(MAIL_VERDICTS),
	modelConfidence: z.number().min(0).max(1),
	ownerDecision: z.enum(MAIL_DECISIONS).nullable(),
	approver: z.string().nullable(),
	requestedAt: z.string().datetime(),
	resolvedAt: z.string().datetime().nullable(),
	processedAction: z.string().nullable(),
	queuedDecision: z.enum(MAIL_DECISIONS).nullable(),
	queuedStatus: z.string().nullable(),
	queuedError: z.string().nullable(),
});
export type MailReview = z.infer<typeof mailReviewSchema> & { id: ReturnType<typeof asMailReviewId> };

export const brandBadge = (b: z.infer<typeof badgeSchema>): Badge => ({ ...b, slug: asBadgeSlug(b.slug) });
export const brandProject = (p: z.infer<typeof projectSchema>): Project => ({
	...p,
	slug: asProjectSlug(p.slug),
});
export const brandAgent = (a: z.infer<typeof agentSchema>): Agent => ({ ...a, slug: asAgentSlug(a.slug) });
export const brandMailReview = (m: z.infer<typeof mailReviewSchema>): MailReview => ({
	...m,
	id: asMailReviewId(m.id),
});
