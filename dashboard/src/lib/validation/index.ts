/**
 * V11 — boundary validation.
 *
 * Centralized zod schemas + helpers used by server actions and route
 * handlers. Every external input crossing into a server action MUST be
 * parsed via `parseInput` (or a direct `safeParse`) and rejected with a
 * structured error on failure. Failures are logged with a stable shape so
 * operators can grep `boundary_validation_error` in the dashboard logs.
 */
import { z } from "zod";

export { z };

// Legacy constants (formerly src/lib/validation.ts) — kept here so existing
// `@/lib/validation` imports continue to resolve after V11.
export const VALID_HEALTH_TYPES = new Set(["http", "tcp", "docker", "process"]);
export const SLUG_RE = /^[a-z0-9][a-z0-9._-]{0,62}$/;
export const HEX_COLOR_RE = /^#[0-9a-fA-F]{6}$/;
export const DATA_IMAGE_PREFIX = "data:image/";
export const MAX_ICON_IMAGE_LENGTH = 350 * 1024;

export interface ValidationError {
	ok: false;
	error: string;
	code: "EVALIDATION";
	issues: Array<{ path: string; message: string }>;
}

export interface ValidationOk<T> {
	ok: true;
	data: T;
}

export type ValidationResult<T> = ValidationOk<T> | ValidationError;

function flattenIssues(err: z.ZodError): ValidationError["issues"] {
	return err.issues.map((i) => ({
		path: i.path.join("."),
		message: i.message,
	}));
}

/**
 * Parse `input` with `schema`. On failure, emit a structured log line and
 * return a tagged `ValidationError` instead of throwing — callers decide
 * how to surface to the UI.
 */
export function parseInput<T>(
	schema: z.ZodType<T>,
	input: unknown,
	context: { action: string },
): ValidationResult<T> {
	const result = schema.safeParse(input);
	if (result.success) {
		return { ok: true, data: result.data };
	}
	const issues = flattenIssues(result.error);
	// Structured log — JSON line for ingestion.
	console.error(
		JSON.stringify({
			event: "boundary_validation_error",
			action: context.action,
			issues,
		}),
	);
	return {
		ok: false,
		error: "Invalid input",
		code: "EVALIDATION",
		issues,
	};
}

// ---------------------------------------------------------------------------
// Shared schemas.
// ---------------------------------------------------------------------------

/** ISO 8601 datetime with offset (matches existing audit verify route). */
export const isoDateString = z.string().datetime({ offset: true });

/** Audit query params for paginated viewer. */
export const auditViewerQuerySchema = z.object({
	page: z
		.union([z.string(), z.number()])
		.optional()
		.transform((v) => {
			if (v === undefined) return 1;
			const n = typeof v === "number" ? v : parseInt(v, 10);
			if (!Number.isFinite(n) || n < 1) return 1;
			return Math.min(n, 100_000);
		}),
});

/** Synthetic alert / notify-test action input. */
export const notifyTestInputSchema = z.object({
	title: z.string().trim().min(1).max(200).optional(),
	body: z.string().max(2000).optional(),
	source: z
		.string()
		.regex(/^[a-zA-Z0-9._-]+$/u, "source must match [a-zA-Z0-9._-]")
		.max(64)
		.optional(),
});

export type NotifyTestInput = z.infer<typeof notifyTestInputSchema>;

/** Paperclip link refresh action — currently no inputs, but reserved. */
export const paperclipRefreshInputSchema = z.object({}).strict();

export type PaperclipRefreshInput = z.infer<typeof paperclipRefreshInputSchema>;
