import { describe, expect, it } from 'vitest';
import { applyNamespacePrefix, parseNamespacePrefix } from '../src/imap.js';

describe('parseNamespacePrefix', () => {
  it('extracts the INBOX. personal prefix from a Dovecot NAMESPACE response', () => {
    // The exact shape mail.heitorramon.com returns.
    const out = '* NAMESPACE (("INBOX." ".")) NIL NIL\r\nA0002 OK NAMESPACE completed.\r\n';
    expect(parseNamespacePrefix(out)).toBe('INBOX.');
  });

  it('returns undefined when the personal namespace prefix is empty', () => {
    // The geeks servers expose a root personal namespace — no prefixing needed.
    const out = '* NAMESPACE (("" "/")) NIL NIL\r\nA0002 OK NAMESPACE completed.\r\n';
    expect(parseNamespacePrefix(out)).toBeUndefined();
  });

  it('returns undefined when there is no NAMESPACE line', () => {
    expect(parseNamespacePrefix('A0002 OK done\r\n')).toBeUndefined();
  });
});

describe('applyNamespacePrefix', () => {
  it('prefixes a bare mailbox name with the personal namespace', () => {
    // The exact failing case: SELECT "Trash" / "Cortex Mail Guardian Review"
    // was rejected with "prefix with INBOX.".
    expect(applyNamespacePrefix('Trash', 'INBOX.')).toBe('INBOX.Trash');
    expect(applyNamespacePrefix('Cortex Mail Guardian Review', 'INBOX.')).toBe(
      'INBOX.Cortex Mail Guardian Review',
    );
  });

  it('leaves already-prefixed names untouched (idempotent)', () => {
    expect(applyNamespacePrefix('INBOX.Trash', 'INBOX.')).toBe('INBOX.Trash');
    expect(applyNamespacePrefix('INBOX.Cortex Mail Guardian Review', 'INBOX.')).toBe(
      'INBOX.Cortex Mail Guardian Review',
    );
  });

  it('never prefixes INBOX itself', () => {
    expect(applyNamespacePrefix('INBOX', 'INBOX.')).toBe('INBOX');
  });

  it('is a no-op when the server has no personal prefix', () => {
    expect(applyNamespacePrefix('Trash', undefined)).toBe('Trash');
    expect(applyNamespacePrefix('INBOX.Trash', undefined)).toBe('INBOX.Trash');
  });
});
