/**
 * Barrel export for all entity adapters.
 *
 * Each adapter maps a @cortexos/contracts entity to the sys-pilot component
 * prop shape defined in src/mocks/types.ts. Import from here in Wave-2 route
 * WPs when you need to transform API responses before passing to components.
 *
 * Usage:
 *   import { toServiceRow, toAlertRuleRow } from "@/lib/adapters";
 */
export * from "./services";
export * from "./incus";
export * from "./audit";
export * from "./approvals";
export * from "./mail";
export * from "./alerts";
