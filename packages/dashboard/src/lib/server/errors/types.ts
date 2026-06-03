/**
 * Local error model — mirrors the contracts package's
 * `packages/contracts/src/errors.ts` discriminated union.
 *
 * Once the contracts package is in place, swap to importing from there and
 * delete this file.
 */

export interface ValidationError {
  readonly kind: 'validation';
  readonly message: string;
  /** Field-level details: `{ field: string, message: string }[]`. */
  readonly details: ReadonlyArray<{ field: string; message: string }>;
}

export interface AuthError {
  readonly kind: 'auth';
  readonly message: string;
}

export interface PermissionError {
  readonly kind: 'permission';
  readonly message: string;
}

export interface NotFoundError {
  readonly kind: 'not_found';
  readonly message: string;
  readonly resource?: string;
}

export interface RateLimitError {
  readonly kind: 'rate_limit';
  readonly message: string;
  /** Seconds the client should wait before retrying. */
  readonly retryAfter: number;
}

export interface ApprovalRequiredError {
  readonly kind: 'approval_required';
  readonly message: string;
  /** Action hash the client should request an approval token for. */
  readonly actionHash: string;
  /** Optional TTL hint in seconds. */
  readonly ttlSec: number;
}

export interface SystemError {
  readonly kind: 'system';
  readonly message: string;
  /** Optional cause (not serialized to clients). */
  readonly cause?: unknown;
}

export type ApiError =
  | ValidationError
  | AuthError
  | PermissionError
  | NotFoundError
  | RateLimitError
  | ApprovalRequiredError
  | SystemError;

/** Type guard: is this an `ApiError` (vs a plain Error or unknown throw)? */
export function isApiError(e: unknown): e is ApiError {
  if (typeof e !== 'object' || e === null) return false;
  const k = (e as { kind?: unknown }).kind;
  return (
    k === 'validation' ||
    k === 'auth' ||
    k === 'permission' ||
    k === 'not_found' ||
    k === 'rate_limit' ||
    k === 'approval_required' ||
    k === 'system'
  );
}

/** Helper constructors — return typed `ApiError` values. */
export const validationError = (
  message: string,
  details: ReadonlyArray<{ field: string; message: string }> = [],
): ValidationError => ({ kind: 'validation', message, details });

export const authError = (message = 'Authentication required'): AuthError => ({
  kind: 'auth',
  message,
});

export const permissionError = (
  message = 'Insufficient permissions',
): PermissionError => ({ kind: 'permission', message });

export const notFoundError = (
  message = 'Not found',
  resource?: string,
): NotFoundError => ({ kind: 'not_found', message, ...(resource ? { resource } : {}) });

export const rateLimitError = (retryAfter: number): RateLimitError => ({
  kind: 'rate_limit',
  message: 'Too many requests',
  retryAfter,
});

export const approvalRequiredError = (
  actionHash: string,
  ttlSec = 60,
): ApprovalRequiredError => ({
  kind: 'approval_required',
  message: 'This action requires an approval token',
  actionHash,
  ttlSec,
});

export const systemError = (message: string, cause?: unknown): SystemError => ({
  kind: 'system',
  message,
  ...(cause !== undefined ? { cause } : {}),
});
