import { describe, expect, it } from 'vitest';
import {
  COMMAND_SOCKET_TIMEOUT_MS,
  IDLE_SOCKET_TIMEOUT_MS,
} from '../src/imap.js';

describe('IMAP socket timeout constants', () => {
  it('exports the IDLE-specific timeout at 120_000 ms', () => {
    expect(IDLE_SOCKET_TIMEOUT_MS).toBe(120_000);
  });

  it('keeps the IDLE timer wide enough to survive the 29_000 ms silent wait', () => {
    expect(IDLE_SOCKET_TIMEOUT_MS).toBeGreaterThanOrEqual(4 * 29_000);
  });

  it('exports the command-mode timeout at 30_000 ms', () => {
    expect(COMMAND_SOCKET_TIMEOUT_MS).toBe(30_000);
  });
});
