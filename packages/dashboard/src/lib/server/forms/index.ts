/**
 * Form action helper — `formHandler` wraps a SvelteKit form action with
 * Zod validation + structured error mapping.
 *
 * The shape matches SvelteKit's `ActionResult` discriminated union:
 *   - `{ type: 'success', data: T }` on success
 *   - `{ type: 'failure', status: 400, data: { message, fieldErrors } }`
 *     on validation failure
 *   - `{ type: 'error', error: Error }` on unexpected throw
 *
 * The handler receives a parsed input. Field errors are returned with
 * the field name + message so the UI can highlight the offending field.
 *
 * Usage in a `+page.server.ts`:
 *
 *   import { formHandler } from '$lib/server/forms';
 *   import { ServiceCreateInput } from '$lib/entities';
 *   import { z } from 'zod';
 *
 *   export const actions = {
 *     create: formHandler(ServiceCreateInput, async (input, event) => {
 *       await db.services.insert(input);
 *       return { id: input.slug };
 *     }),
 *   };
 */

import { z, type ZodType, type ZodError } from 'zod';
import type { RequestEvent } from '../types';
import { authError, permissionError, validationError } from '../errors/types';
import { isApiError } from '../errors/types';
import { jsonError } from '../errors';
import type { ApiError } from '../errors/types';

// ---------------------------------------------------------------------------
// ActionResult shape (subset of SvelteKit's ActionResult)
// ---------------------------------------------------------------------------

export type FormActionSuccess<T> = { type: 'success'; status: 200; data: T };
export type FormActionFailure = {
  type: 'failure';
  status: number;
  data: { message: string; fieldErrors: ReadonlyArray<{ field: string; message: string }> };
};
export type FormActionError = { type: 'error'; error: ApiError | Error };
export type FormActionResult<T> = FormActionSuccess<T> | FormActionFailure | FormActionError;

// ---------------------------------------------------------------------------
// Form-data adapter — extract typed input from FormData
// ---------------------------------------------------------------------------

/**
 * Read the entire FormData as a plain object. Multi-value entries become
 * arrays; everything else stays as-is. Files are dropped (we only handle
 * JSON-typed forms for the server-side skeleton).
 */
export function formDataToObject(formData: FormData): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [key, value] of formData.entries()) {
    if (typeof value !== 'string') continue; // skip File entries
    const existing = out[key];
    if (existing === undefined) {
      out[key] = value;
    } else if (Array.isArray(existing)) {
      existing.push(value);
    } else {
      out[key] = [existing, value];
    }
  }
  return out;
}

/**
 * Read a JSON body from the request. SvelteKit form actions that submit
 * with `enctype="application/json"` arrive as a stringified JSON in the
 * form field `__data.json` (SvelteKit's convention). For raw JSON POSTs
 * (e.g. `fetch` with a JSON body), we read the body and parse it.
 */
export async function readJsonBody(event: RequestEvent): Promise<unknown> {
  const ct = event.request.headers.get('content-type') ?? '';
  if (ct.includes('application/json')) {
    try {
      return await event.request.json();
    } catch {
      return null;
    }
  }
  // Fall back to form data.
  const fd = await event.request.formData();
  return formDataToObject(fd);
}

// ---------------------------------------------------------------------------
// The handler wrapper
// ---------------------------------------------------------------------------

export type FormActionHandler<TIn, TOut> = (input: TIn, event: RequestEvent) => Promise<TOut> | TOut;

/**
 * Build a SvelteKit-compatible form action. The returned async function:
 *   1. Parses the input from form data or JSON body.
 *   2. Validates against the Zod schema.
 *   3. On validation failure → returns `{ type: 'failure', status: 400, data: ... }`.
 *   4. On `ApiError` thrown by the handler → returns `{ type: 'failure', status, data }`.
 *   5. On success → returns `{ type: 'success', status: 200, data: TOut }`.
 *   6. On unexpected throw → returns `{ type: 'error', error }`.
 */
export function formHandler<TIn, TOut>(
  schema: ZodType<TIn>,
  handler: FormActionHandler<TIn, TOut>,
): (event: RequestEvent) => Promise<FormActionResult<TOut>> {
  return async (event: RequestEvent): Promise<FormActionResult<TOut>> => {
    // 1. Read input.
    let raw: unknown;
    try {
      raw = await readJsonBody(event);
    } catch {
      return {
        type: 'failure',
        status: 400,
        data: {
          message: 'Could not parse request body',
          fieldErrors: [{ field: '_root', message: 'Invalid body' }],
        },
      };
    }

    // 2. Validate.
    const parsed = schema.safeParse(raw);
    if (!parsed.success) {
      const fieldErrors = zodToFieldErrors(parsed.error);
      return {
        type: 'failure',
        status: 400,
        data: {
          message: 'Validation failed',
          fieldErrors,
        },
      };
    }

    // 3. Execute.
    try {
      const data = await handler(parsed.data, event);
      return { type: 'success', status: 200, data };
    } catch (e) {
      if (isApiError(e)) {
        // Map ApiError → failure (so the form action surfaces a structured
        // error to the page; the UI can display it).
        const status = e.kind === 'auth' ? 401 : e.kind === 'permission' ? 403 : e.kind === 'not_found' ? 404 : 400;
        return {
          type: 'failure',
          status,
          data: { message: e.message, fieldErrors: [] },
        };
      }
      return { type: 'error', error: e instanceof Error ? e : new Error(String(e)) };
    }
  };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function zodToFieldErrors(err: ZodError): ReadonlyArray<{ field: string; message: string }> {
  return err.issues.map((issue) => {
    const field = issue.path.length > 0 ? issue.path.join('.') : '_root';
    return { field, message: issue.message };
  });
}

// ---------------------------------------------------------------------------
// Re-exports for downstream convenience
// ---------------------------------------------------------------------------

export { z };
export { authError, permissionError, validationError, jsonError };
export type { ApiError };
