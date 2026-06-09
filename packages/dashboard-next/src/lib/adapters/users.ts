/**
 * Adapter: @cortexos/contracts User → sys-pilot PamUser mock shape.
 *
 * TODO: Wire to a real /api/users endpoint when a backend domain adds it.
 * Functions are pure — no side-effects, no API calls.
 */
import type { User as ContractUser } from "@cortexos/contracts/entities";
import type { PamUser as MockPamUser } from "@/mocks/types";

/**
 * Map a contract User entity to the mock PamUser shape.
 *
 * `uid` is not available from the contract (it is a PAM detail hidden by the
 * server); we use 0 as a safe placeholder. Components should not rely on uid
 * being meaningful beyond display.
 */
export function toPamUserRow(u: ContractUser): MockPamUser {
  return {
    username: u.username,
    uid: 0, // not surfaced by the API; display-only placeholder
    groups: u.groupMemberships.map((g) => g.name),
    is_admin: u.isAdmin,
  };
}
