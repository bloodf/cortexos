/**
 * ApprovalTokenDisplay.test.ts — verifies the token display shows
 * the opaque token string, issuedAt, expiresAt, ttlSec, sessionId,
 * and actionHash.
 */
import { describe, it, expect, afterEach } from 'vitest';
import { render, cleanup } from '../../../utils/test-render';
import ApprovalTokenDisplay from '../ApprovalTokenDisplay.svelte';
import { testMessages } from './messages';

describe('ApprovalTokenDisplay', () => {
  afterEach(cleanup);

  const FIXED_ISSUE = 1_716_800_000_000; // ms
  const sample = {
    token: 'v1.eyJhY3Rpb25IYXNoIjoiYWJjIn0.sig',
    expiresAt: FIXED_ISSUE + 60_000,
    issuedAt: FIXED_ISSUE,
    actionHash: 'a'.repeat(64),
    sessionId: 'sess_42',
    ttlSec: 60,
  };

  it('renders the opaque token string', () => {
    const { container } = render(ApprovalTokenDisplay, {
      props: { token: sample, messages: testMessages },
    });
    const tok = container.querySelector('[data-slot="approval-token-string"]');
    expect(tok?.textContent?.trim()).toBe(sample.token);
  });

  it('renders the session id', () => {
    const { container } = render(ApprovalTokenDisplay, {
      props: { token: sample, messages: testMessages },
    });
    const sess = container.querySelector('[data-slot="approval-token-session-id"]');
    expect(sess?.textContent?.trim()).toBe('sess_42');
  });

  it('renders the action hash', () => {
    const { container } = render(ApprovalTokenDisplay, {
      props: { token: sample, messages: testMessages },
    });
    const ah = container.querySelector('[data-slot="approval-token-action-hash"]');
    expect(ah?.textContent?.trim()).toBe('a'.repeat(64));
  });

  it('renders the TTL in seconds', () => {
    const { container } = render(ApprovalTokenDisplay, {
      props: { token: sample, messages: testMessages },
    });
    const ttl = container.querySelector('[data-slot="approval-token-ttl"]');
    expect(ttl?.textContent?.trim()).toBe('60');
  });
});
