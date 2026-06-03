/**
 * Barrel export for the server-side library.
 *
 * Public surface for downstream code. M1 +server.ts files import from
 * `$lib/server/<module>` directly to keep import paths explicit; this
 * barrel is for code outside the server folder (e.g. shared utilities).
 */

export * from './auth';
export * from './errors';
export * from './errors/types';
export * from './rate-limit';
export * from './audit';
export * from './approval';
export * from './policy';
export * from './forms';
export * from './load';
export * from './entities';
export * from './config';
export * from './types';
export * from './stub-data';
export { defineRoute, type RouteOptions, type Handler } from './route-helper';
