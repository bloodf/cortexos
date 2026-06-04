/**
 * Test helper — builds a `Messages` object for component tests.
 *
 * Mirrors the services feature's helper. The real `Messages` type is
 * the en.json object exported from `$lib/i18n`. Tests that don't
 * care about translation behavior can pass this minimal-but-valid
 * shape; the dotted-key fallback in `t()` covers any key that isn't
 * set explicitly.
 */
import en from '$lib/i18n/messages/en.json';
import type { Messages } from '$lib/i18n';

export const testMessages: Messages = en;
