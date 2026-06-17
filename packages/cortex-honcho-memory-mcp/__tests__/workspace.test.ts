import { describe, expect, it } from 'vitest';
import { deriveWorkspaceName } from '../src/workspace.js';

describe('deriveWorkspaceName', () => {
  it('returns a stable id for the same absolute path', () => {
    const a = deriveWorkspaceName('/home/user/projects/acme');
    const b = deriveWorkspaceName('/home/user/projects/acme');
    expect(a).toBe(b);
    expect(a).toMatch(/^dir-/);
    expect(a.length).toBeLessThanOrEqual(64);
  });

  it('produces different ids for different paths', () => {
    const a = deriveWorkspaceName('/home/user/projects/acme');
    const b = deriveWorkspaceName('/home/user/projects/beta');
    expect(a).not.toBe(b);
  });

  it('sanitizes special characters in directory names', () => {
    const name = deriveWorkspaceName('/home/user/projects/foo@bar:baz');
    expect(name).toMatch(/^[a-zA-Z0-9_-]+$/);
  });
});
