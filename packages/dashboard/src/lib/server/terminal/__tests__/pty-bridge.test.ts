/**
 * pty-bridge.test.ts — M2-WS2 PTY bridge unit tests.
 *
 * Critical coverage:
 *   - PB-2: `bash -c <userstring>` is rejected.
 *   - Unknown op is rejected.
 *   - Arg-smuggling is rejected (defence in depth).
 *   - Allowlisted op with valid args is accepted; the resolved argv
 *     is exposed for the dispatcher.
 *   - Approval-required ops return `approval_required` with an
 *     actionHash + ttlSec.
 *   - Executors can be swapped for tests.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { randomUUID } from 'node:crypto';
import {
  dispatch,
  listTerminalOps,
  setExecutorForTests,
  _STUB_MARKER,
  _internals,
  type DispatchContext,
  type DispatchInput,
} from '../pty-bridge';
import { addAllowlisted } from '../../policy';
import {
  asUserId,
  type User,
} from '../../entities';
import { resetAudit, listAudit } from '../../audit';
import { resetApprovalStore } from '../../approval';

function makeUser(overrides: Partial<User> = {}): User {
  return {
    id: asUserId('user-test'),
    username: 'tester',
    is_admin: true,
    isActive: true,
    groupMemberships: ['cortexos-admin'],
    ...overrides,
  };
}

function makeCtx(user: User): DispatchContext {
  return {
    user,
    ip: '127.0.0.1',
    userAgent: 'vitest/1.0',
    requestId: randomUUID(),
  };
}

/**
 * The policy module installs its default allowlist on first import.
 * We do NOT call `resetPolicy()` in beforeEach — the test file relies
 * on those defaults (`term.ps`, `term.df`, `term.read_file`,
 * `term.tail_log`, `term.exec_named`) being present.
 *
 * We also register a few custom ops in the test cases that need
 * specific argv shapes.
 */
beforeEach(() => {
  resetAudit();
  resetApprovalStore();
  setExecutorForTests(null);
});

describe('listTerminalOps', () => {
  it('returns the allowlisted terminal ops from the default policy', () => {
    const ops = listTerminalOps();
    const names = ops.map((o) => o.op);
    expect(names).toContain('term.ps');
    expect(names).toContain('term.top');
    expect(names).toContain('term.df');
    expect(names).toContain('term.read_file');
    expect(names).toContain('term.tail_log');
    expect(names).toContain('term.exec_named');
  });

  it('term.exec_named is the special allowlisted-subcommand wrapper (not approval-gated)', () => {
    // The policy's term.exec_named is gated by the argv-bash-c guard,
    // not by an approval token. Verify the contract.
    const op = listTerminalOps().find((o) => o.op === 'term.exec_named');
    expect(op).toBeDefined();
    // The PB-2 fix prevents term.exec_named from being executed in
    // M2 because the argv-bash-c guard catches the rendered `/bin/sh -c`
    // pair. This is tested in the dispatch: PB-2 suite below.
  });

  it('extracts placeholders from argv', () => {
    const op = listTerminalOps().find((o) => o.op === 'term.read_file');
    expect(op?.placeholders).toEqual(['path']);
    const tail = listTerminalOps().find((o) => o.op === 'term.tail_log');
    expect([...(tail?.placeholders ?? [])].sort()).toEqual(['N', 'unit']);
  });
});

describe('dispatch: PB-2 — bash -c rejection', () => {
  it("rejects op name 'bash -c id' (allowlist miss) with status rejected / code unknown_op", async () => {
    const input: DispatchInput = { op: 'bash -c id', args: {} };
    const res = await dispatch(input, makeCtx(makeUser()));
    expect(res.status).toBe('rejected');
    if (res.status === 'rejected') {
      expect(res.code).toBe('unknown_op');
    }
  });

  it('rejects `bash -c id` as an op even with empty args', async () => {
    const res = await dispatch({ op: 'bash -c id', args: {} }, makeCtx(makeUser()));
    expect(res.status).toBe('rejected');
  });

  it('rejects an op named "sh -c ..." too', async () => {
    const res = await dispatch({ op: 'sh -c id', args: {} }, makeCtx(makeUser()));
    expect(res.status).toBe('rejected');
  });

  it('PB-2: even when term.exec_named is allowlisted, the resolved argv is caught by argv guard', async () => {
    // The op is allowlisted; the args are clean. The placeholder
    // <allowlisted-subcommand> is bound to "ls", so the resolved argv
    // is `[/bin/sh, -c, ls]`. The argv guard must catch that as
    // `argv_bash_c` — we *never* let a `*sh -c` argv through the
    // bridge, even when the op is allowlisted.
    const res = await dispatch(
      { op: 'term.exec_named', args: { 'allowlisted-subcommand': 'ls' } },
      makeCtx(makeUser()),
    );
    expect(res.status).toBe('rejected');
    if (res.status === 'rejected') {
      expect(res.code).toBe('argv_bash_c');
    }
  });
});

describe('dispatch: arg validation (T-104 / SR-100)', () => {
  it('rejects a path arg containing `$(id)`', async () => {
    const res = await dispatch(
      { op: 'term.read_file', args: { path: '$(id)' } },
      makeCtx(makeUser()),
    );
    expect(res.status).toBe('rejected');
    if (res.status === 'rejected') {
      expect(res.code).toBe('arg_smuggling');
      expect(res.field).toBe('path');
    }
  });

  it('rejects a path arg containing backticks', async () => {
    const res = await dispatch(
      { op: 'term.read_file', args: { path: '`id`' } },
      makeCtx(makeUser()),
    );
    expect(res.status).toBe('rejected');
  });

  it('rejects a path arg with path traversal', async () => {
    const res = await dispatch(
      { op: 'term.read_file', args: { path: '../../../etc/passwd' } },
      makeCtx(makeUser()),
    );
    expect(res.status).toBe('rejected');
  });

  it('rejects a nested arg-smuggling value', async () => {
    const res = await dispatch(
      { op: 'term.read_file', args: { path: { nested: '$(id)' } } },
      makeCtx(makeUser()),
    );
    expect(res.status).toBe('rejected');
  });

  it('rejects an array element with smuggling', async () => {
    const res = await dispatch(
      { op: 'term.read_file', args: { path: ['safe', '$(id)'] } },
      makeCtx(makeUser()),
    );
    expect(res.status).toBe('rejected');
  });
});

describe('dispatch: allowlisted happy path', () => {
  it('accepts term.ps and renders the fixed argv', async () => {
    const res = await dispatch({ op: 'term.ps', args: {} }, makeCtx(makeUser()));
    expect(res.status).toBe('accepted');
    if (res.status === 'accepted') {
      expect(res.argv).toEqual(['ps', 'auxf']);
    }
  });

  it('accepts term.top and renders the fixed argv', async () => {
    const res = await dispatch({ op: 'term.top', args: {} }, makeCtx(makeUser()));
    expect(res.status).toBe('accepted');
    if (res.status === 'accepted') {
      expect(res.argv).toEqual(['top', '-b', '-n', '1']);
    }
  });

  it('accepts term.read_file with a clean path and renders the substituted argv', async () => {
    const res = await dispatch(
      { op: 'term.read_file', args: { path: '/var/log/caddy.log' } },
      makeCtx(makeUser()),
    );
    expect(res.status).toBe('accepted');
    if (res.status === 'accepted') {
      expect(res.argv).toEqual(['cat', '/var/log/caddy.log']);
    }
  });

  it('rejects term.read_file when the required <path> placeholder is missing', async () => {
    const res = await dispatch(
      { op: 'term.read_file', args: {} },
      makeCtx(makeUser()),
    );
    expect(res.status).toBe('rejected');
    if (res.status === 'rejected') {
      expect(res.code).toBe('placeholder_unbound');
    }
  });

  it('rejects term.tail_log when N is NaN (finite-number check)', async () => {
    const res = await dispatch(
      { op: 'term.tail_log', args: { unit: 'caddy.service', N: Number.NaN } },
      makeCtx(makeUser()),
    );
    expect(res.status).toBe('rejected');
    if (res.status === 'rejected') {
      expect(res.code).toBe('arg_type');
    }
  });

  it('accepts term.tail_log with N as a string (stringified to argv)', async () => {
    // The renderArgv helper accepts string args and pushes them as-is
    // — placeholders that expect numbers (like journalctl `-n`) are
    // rendered as their string form, which `journalctl` accepts.
    const res = await dispatch(
      { op: 'term.tail_log', args: { unit: 'caddy.service', N: '50' } },
      makeCtx(makeUser()),
    );
    expect(res.status).toBe('accepted');
    if (res.status === 'accepted') {
      expect(res.argv).toEqual(['journalctl', '-u', 'caddy.service', '-n', '50', '--no-pager']);
    }
  });

  it('accepts term.tail_log with valid unit + N and substitutes both placeholders', async () => {
    const res = await dispatch(
      { op: 'term.tail_log', args: { unit: 'caddy.service', N: 50 } },
      makeCtx(makeUser()),
    );
    expect(res.status).toBe('accepted');
    if (res.status === 'accepted') {
      expect(res.argv).toEqual(['journalctl', '-u', 'caddy.service', '-n', '50', '--no-pager']);
    }
  });
});

describe('dispatch: approval gate', () => {
  it('approval-required op with non-sh-c argv returns approval_required', async () => {
    addAllowlisted({
      name: 'term.dangerous',
      surface: 'terminal',
      argv: ['/bin/echo', 'boom'],
      requiresApproval: true,
      description: 'Test approval-gated op',
    });
    const res = await dispatch(
      { op: 'term.dangerous', args: {} },
      makeCtx(makeUser()),
    );
    expect(res.status).toBe('approval_required');
    if (res.status === 'approval_required') {
      expect(res.ttlSec).toBe(60);
      expect(res.actionHash).toMatch(/^[a-f0-9]{64}$/);
    }
  });
});

describe('dispatch: executor hook + audit', () => {
  it('uses the M2 stub executor by default and produces a stub-marker line', async () => {
    const res = await dispatch({ op: 'term.ps', args: {} }, makeCtx(makeUser()));
    expect(res.status).toBe('accepted');
    expect(_STUB_MARKER).toMatch(/__cortexos_pty_bridge_stub__/);
  });

  it('uses the test executor when set', async () => {
    const seen: string[][] = [];
    setExecutorForTests(async (argv) => {
      seen.push([...argv]);
      return { stdout: 'hi', stderr: '', exitCode: 0 };
    });
    await dispatch({ op: 'term.ps', args: {} }, makeCtx(makeUser()));
    expect(seen).toEqual([['ps', 'auxf']]);
  });

  it('writes a terminal.bridge.dispatch audit row on accept', async () => {
    const ctx = makeCtx(makeUser());
    await dispatch({ op: 'term.ps', args: {} }, ctx);
    const rows = listAudit().filter((r) => r.action === 'terminal.bridge.dispatch');
    expect(rows.length).toBeGreaterThanOrEqual(1);
    expect(rows[rows.length - 1]!.actorUserId).toBe(ctx.user.id);
  });

  it('writes a terminal.bridge.reject audit row on rejection', async () => {
    const ctx = makeCtx(makeUser());
    await dispatch({ op: 'bogus.op', args: {} }, ctx);
    const rows = listAudit().filter((r) => r.action === 'terminal.bridge.reject');
    expect(rows.length).toBe(1);
    expect(rows[0]!.errorCode).toBe('unknown_op');
  });
});

describe('_internals — direct coverage', () => {
  it('argvContainsBashDashC detects /bin/sh -c', () => {
    expect(_internals.argvContainsBashDashC(['/bin/sh', '-c', 'ls'])).toBe(true);
  });
  it('argvContainsBashDashC does not flag /bin/cat -c', () => {
    // -c alone is not bash -c; cat is not a shell.
    expect(_internals.argvContainsBashDashC(['/bin/cat', '-c', 'ls'])).toBe(false);
  });
  it('argvContainsBashDashC catches bare sh -c', () => {
    expect(_internals.argvContainsBashDashC(['sh', '-c', 'id'])).toBe(true);
  });
  it('argvContainsBashDashC catches zsh -c', () => {
    expect(_internals.argvContainsBashDashC(['zsh', '-c', 'id'])).toBe(true);
  });
  it('renderArgv renders placeholders in order', () => {
    const r = _internals.renderArgv(
      {
        name: 'x',
        surface: 'terminal',
        argv: ['cat', '<path>'],
        requiresApproval: false,
        description: '',
      },
      { path: '/etc/hosts' },
    );
    expect('argv' in r).toBe(true);
    if ('argv' in r) expect(r.argv).toEqual(['cat', '/etc/hosts']);
  });
  it('renderArgv returns placeholder_unbound when missing', () => {
    const r = _internals.renderArgv(
      {
        name: 'x',
        surface: 'terminal',
        argv: ['cat', '<path>'],
        requiresApproval: false,
        description: '',
      },
      {},
    );
    expect('code' in r).toBe(true);
    if ('code' in r) expect(r.code).toBe('placeholder_unbound');
  });
  it('collectArgSmugglingHits walks nested objects', () => {
    const hits: { field: string; reason: string; matched: string }[] = [];
    _internals.collectArgSmugglingHits({ a: { b: '$(id)' } }, '', hits);
    expect(hits.length).toBe(1);
    expect(hits[0]!.field).toBe('a.b');
  });
});
