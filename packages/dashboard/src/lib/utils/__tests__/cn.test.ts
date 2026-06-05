// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { cn, formatBytes } from '../cn';

describe('cn (class-name merger)', () => {
  it('merges two class strings', () => {
    expect(cn('a', 'b')).toBe('a b');
  });

  it('handles undefined / null / false inputs', () => {
    expect(cn('a', undefined, null, false, 'b')).toBe('a b');
  });

  it('deduplicates conflicting tailwind classes via twMerge', () => {
    expect(cn('px-2', 'px-4')).toBe('px-4');
    expect(cn('text-red-500', 'text-blue-500')).toBe('text-blue-500');
  });

  it('handles array inputs via clsx', () => {
    expect(cn(['a', 'b'], 'c')).toBe('a b c');
  });

  it('returns empty string for empty input', () => {
    expect(cn()).toBe('');
  });
});

describe('formatBytes', () => {
  it('formats 0 bytes as "0 B"', () => {
    expect(formatBytes(0)).toBe('0 B');
  });

  it('formats bytes', () => {
    expect(formatBytes(512)).toBe('512 B');
  });

  it('formats kilobytes', () => {
    expect(formatBytes(1024)).toBe('1 KB');
  });

  it('formats megabytes', () => {
    expect(formatBytes(1024 * 1024)).toBe('1 MB');
  });

  it('formats gigabytes', () => {
    expect(formatBytes(1024 * 1024 * 1024)).toBe('1 GB');
  });

  it('formats terabytes', () => {
    expect(formatBytes(1024 * 1024 * 1024 * 1024)).toBe('1 TB');
  });

  it('formats fractional values to 2 decimal places', () => {
    expect(formatBytes(1536)).toBe('1.5 KB');
  });
});
