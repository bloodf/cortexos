/**
 * Error model — discriminated union matching the M0-E threat model
 * (PB-1 through PB-5) and the M1-WS4 server-side `apiError` mapping.
 *
 * The mock scenarios emit these via the standard `Response` shape:
 *   { error: "Forbidden", code: "PERMISSION_DENIED", details?: {...} }
 *   with the matching HTTP status (401/403/404/409/422/429/500/...).
 */

import { z } from 'zod';

export const errorCodes = [
	'VALIDATION_ERROR',
	'AUTH_ERROR',
	'PERMISSION_DENIED',
	'NOT_FOUND',
	'CONFLICT',
	'RATE_LIMITED',
	'APPROVAL_REQUIRED',
	'MFA_REQUIRED',
	'RHT_2FA_REQUIRED',
	'AUDIT_CHAIN_INVALID',
	'TIMEOUT',
	'INTERNAL_ERROR',
] as const;
export type ErrorCode = (typeof errorCodes)[number];

const baseErrorFields = {
	code: z.enum(errorCodes),
	message: z.string().min(1),
	details: z.record(z.string(), z.unknown()).optional(),
	requestId: z.string().optional(),
};

export const validationErrorSchema = z.object({
	...baseErrorFields,
	code: z.literal('VALIDATION_ERROR'),
	fieldErrors: z
		.array(
			z.object({
				path: z.array(z.union([z.string(), z.number()])),
				message: z.string(),
				code: z.string().optional(),
			}),
		)
		.optional(),
});
export type ValidationError = z.infer<typeof validationErrorSchema>;

export const authErrorSchema = z.object({
	...baseErrorFields,
	code: z.literal('AUTH_ERROR'),
});
export type AuthError = z.infer<typeof authErrorSchema>;

export const permissionDeniedErrorSchema = z.object({
	...baseErrorFields,
	code: z.literal('PERMISSION_DENIED'),
	requiredRole: z.string().optional(),
	requiredGroup: z.string().optional(),
});
export type PermissionDeniedError = z.infer<typeof permissionDeniedErrorSchema>;

export const notFoundErrorSchema = z.object({
	...baseErrorFields,
	code: z.literal('NOT_FOUND'),
	resource: z.string().optional(),
});
export type NotFoundError = z.infer<typeof notFoundErrorSchema>;

export const conflictErrorSchema = z.object({
	...baseErrorFields,
	code: z.literal('CONFLICT'),
	existingId: z.string().optional(),
});
export type ConflictError = z.infer<typeof conflictErrorSchema>;

export const rateLimitErrorSchema = z.object({
	...baseErrorFields,
	code: z.literal('RATE_LIMITED'),
	retryAfter: z.number().int().nonnegative(),
	limit: z.number().int().positive(),
	windowSec: z.number().int().positive(),
});
export type RateLimitError = z.infer<typeof rateLimitErrorSchema>;

export const approvalRequiredErrorSchema = z.object({
	...baseErrorFields,
	code: z.literal('APPROVAL_REQUIRED'),
	action: z.string().min(1),
	approvalRequestId: z.string().min(1).optional(),
	confirmationTokenHeader: z.string().default('X-Cortex-Confirmation-Token'),
});
export type ApprovalRequiredError = z.infer<typeof approvalRequiredErrorSchema>;

export const mfaRequiredErrorSchema = z.object({
	...baseErrorFields,
	code: z.literal('MFA_REQUIRED'),
	challengeId: z.string().min(1),
	method: z.enum(['totp', 'webauthn', 'sms']).default('totp'),
});
export type MfaRequiredError = z.infer<typeof mfaRequiredErrorSchema>;

export const rht2faRequiredErrorSchema = z.object({
	...baseErrorFields,
	code: z.literal('RHT_2FA_REQUIRED'),
	challengeId: z.string().min(1),
});
export type Rht2faRequiredError = z.infer<typeof rht2faRequiredErrorSchema>;

export const auditChainInvalidErrorSchema = z.object({
	...baseErrorFields,
	code: z.literal('AUDIT_CHAIN_INVALID'),
	brokenAtEventId: z.string().min(1),
});
export type AuditChainInvalidError = z.infer<typeof auditChainInvalidErrorSchema>;

export const timeoutErrorSchema = z.object({
	...baseErrorFields,
	code: z.literal('TIMEOUT'),
	timeoutMs: z.number().int().positive(),
});
export type TimeoutError = z.infer<typeof timeoutErrorSchema>;

export const internalErrorSchema = z.object({
	...baseErrorFields,
	code: z.literal('INTERNAL_ERROR'),
});
export type InternalError = z.infer<typeof internalErrorSchema>;

export const cortexErrorSchema = z.discriminatedUnion('code', [
	validationErrorSchema,
	authErrorSchema,
	permissionDeniedErrorSchema,
	notFoundErrorSchema,
	conflictErrorSchema,
	rateLimitErrorSchema,
	approvalRequiredErrorSchema,
	mfaRequiredErrorSchema,
	rht2faRequiredErrorSchema,
	auditChainInvalidErrorSchema,
	timeoutErrorSchema,
	internalErrorSchema,
]);
export type CortexError = z.infer<typeof cortexErrorSchema>;

export const errorStatusMap: Record<ErrorCode, number> = {
	VALIDATION_ERROR: 422,
	AUTH_ERROR: 401,
	PERMISSION_DENIED: 403,
	NOT_FOUND: 404,
	CONFLICT: 409,
	RATE_LIMITED: 429,
	APPROVAL_REQUIRED: 403,
	MFA_REQUIRED: 401,
	RHT_2FA_REQUIRED: 401,
	AUDIT_CHAIN_INVALID: 500,
	TIMEOUT: 504,
	INTERNAL_ERROR: 500,
};
