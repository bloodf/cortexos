/**
 * Barrel export for the Docker server module.
 *
 * Consumers (the +server.ts routes, the components adapter) import
 * from `$lib/server/docker` rather than reaching into individual
 * files. Keeps the import graph stable when the bridge is split or
 * the executor moves out.
 */
export * from './stub-data';
export * from './bridge';
