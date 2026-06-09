/**
 * Adapter: @cortexos/contracts MailGuardianReview → sys-pilot MailReview mock shape.
 *
 * Functions are pure — no side-effects, no API calls.
 */
import type { MailReview as MockMailReview } from "@/mocks/types";

/**
 * Contract shape from GET /api/mail-guardian/reviews.
 * Defined inline to keep this file self-contained.
 */
export interface ContractMailReview {
  id: string;
  from: string;
  subject: string;
  snippet: string;
  body: string;
  risk: "low" | "medium" | "high";
  status: "pending" | "approved" | "flagged";
  receivedAt: string;
}

/**
 * Map a contract MailGuardianReview to the mock MailReview shape that
 * sys-pilot components consume.
 */
export function toMailReviewRow(m: ContractMailReview): MockMailReview {
  return {
    id: m.id,
    from: m.from,
    subject: m.subject,
    snippet: m.snippet,
    body: m.body,
    risk: m.risk,
    status: m.status,
    received_at: m.receivedAt,
  };
}
