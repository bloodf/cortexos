/**
 * Test helper — builds a `Messages` object for component tests.
 *
 * The component tests need a `messages` prop to drive the i18n
 * lookups. The real `Messages` type is the en.json object exported
 * from `$lib/i18n`. Tests that don't care about translation
 * behavior can pass this minimal-but-valid shape; the dotted-key
 * fallback in `t()` covers any key that isn't set explicitly.
 */
import en from '$lib/i18n/messages/en.json';
import type { Messages } from '$lib/i18n';

export const testMessages: Messages = en;
