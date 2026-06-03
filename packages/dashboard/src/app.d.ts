// See https://svelte.dev/docs/kit/types#app for the App namespace shape.
// `Locals` is the per-request user-supplied object on `event.locals`. The
// shape is consumed by `hooks.server.ts` (M1-WS5-mock-api) and by every
// `+page.server.ts` / `+layout.server.ts` load function. Keep it stable;
// the M1-WS4-backend-skeleton workstream depends on it.
//
// All auth fields are optional at the type level: anonymous requests are
// valid (e.g. /login) and the dashboard layout enforces the auth gate
// per-route.

import type { ThemeMode, ThemePreset } from '$lib/theme-presets';
import type { Messages } from '$lib/i18n';

declare global {
	namespace App {
		interface Error {
			message: string;
			code?: string;
		}

		interface Locals {
			/** Authenticated user (PAM-backed); `null` for anonymous requests. */
			user: {
				id: string;
				username: string;
				isAdmin: boolean;
			} | null;
			/** Opaque session token; `null` when no session is present. */
			session: {
				token: string;
				expiresAt: number;
			} | null;
			/** Request-scoped correlation id; emitted in logs and audit rows. */
			requestId: string;
		}

		// Every page receives the root-layout data (theme + locale + i18n
		// messages + the mirrored `locals.user`) merged with whatever its
		// own +page.server.ts / +page.ts returns. SvelteKit's PageData
		// is the union of all `+layout.ts` + `+page.ts` data shapes.
		interface PageData {
			theme: {
				mode: ThemeMode;
				preset: ThemePreset;
			};
			locale: string;
			messages: Messages;
			user: Locals['user'];
		}

		interface PageState {
			commandPaletteOpen: boolean;
		}

		// interface Page {}
		// interface Platform {}
	}
}

export {};
