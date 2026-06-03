import { describe, expect, it } from 'vitest';
import { cn } from './cn';

describe('cn()', () => {
  it('merges simple class names', () => {
    expect(cn('foo', 'bar')).toBe('foo bar');
  });

  it('filters out falsy values', () => {
    expect(cn('foo', false, null, undefined, 'bar')).toBe('foo bar');
  });

  it('deduplicates conflicting Tailwind classes (later wins)', () => {
    // tailwind-merge: the second px-2 wins, p-4 is removed (overrides p-2)
    expect(cn('p-2', 'p-4')).toBe('p-4');
    expect(cn('px-2', 'px-4')).toBe('px-4');
    expect(cn('text-red-500', 'text-blue-500')).toBe('text-blue-500');
  });

  it('preserves non-conflicting classes', () => {
    expect(cn('text-sm', 'font-medium', 'p-2', 'rounded-lg')).toBe(
      'text-sm font-medium p-2 rounded-lg',
    );
  });

  it('handles array and object inputs', () => {
    expect(cn(['foo', 'bar'], { baz: true, qux: false })).toBe('foo bar baz');
  });

  it('handles nested arrays', () => {
    expect(cn(['foo', ['bar', 'baz']])).toBe('foo bar baz');
  });

  it('returns empty string for no inputs', () => {
    expect(cn()).toBe('');
  });

  it('preserves CSS variables in arbitrary-value classes', () => {
    // tailwind-merge should not strip oklch/var-based arbitrary values
    const result = cn('bg-[oklch(0.5_0.1_200)]', 'text-[var(--foreground)]');
    expect(result).toContain('bg-[oklch(0.5_0.1_200)]');
    expect(result).toContain('text-[var(--foreground)]');
  });
});
