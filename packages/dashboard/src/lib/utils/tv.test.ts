import { describe, expect, it } from 'vitest';
import { tv } from './tv';

describe('tv()', () => {
  const button = tv({
    base: 'inline-flex items-center justify-center rounded-md font-medium',
    variants: {
      variant: {
        default: 'bg-primary text-primary-foreground',
        ghost: 'bg-transparent text-foreground',
        destructive: 'bg-destructive text-destructive-foreground',
      },
      size: {
        sm: 'h-8 px-2 text-sm',
        md: 'h-10 px-4 text-sm',
        lg: 'h-12 px-6 text-base',
      },
    },
    defaults: {
      variant: 'default',
      size: 'md',
    },
  });

  it('applies the base classes', () => {
    expect(button()).toContain('inline-flex');
    expect(button()).toContain('rounded-md');
  });

  it('applies default variants when none supplied', () => {
    expect(button()).toContain('bg-primary');
    expect(button()).toContain('h-10');
  });

  it('applies the chosen variant and size', () => {
    const result = button({ variant: 'ghost', size: 'sm' });
    expect(result).toContain('bg-transparent');
    expect(result).toContain('h-8');
    // default variant classes should NOT be present
    expect(result).not.toContain('bg-primary');
  });

  it('merges conflicting tailwind classes correctly', () => {
    const input = tv({
      base: 'p-2',
      variants: {
        pad: {
          sm: 'p-1',
          md: 'p-4',
        },
      },
      defaults: { pad: 'md' },
    });
    // tailwind-merge: p-4 wins over p-2 base
    expect(input()).toBe('p-4');
  });

  it('appends user class strings', () => {
    const result = button({ class: 'extra-class' });
    expect(result).toContain('extra-class');
  });

  it('appends user className (alternate prop)', () => {
    const result = button({ className: 'my-class' });
    expect(result).toContain('my-class');
  });

  it('handles compound variants', () => {
    const alert = tv({
      base: 'rounded-md',
      variants: {
        intent: {
          info: 'bg-info text-info-foreground',
          danger: 'bg-destructive text-destructive-foreground',
        },
        size: {
          sm: 'text-sm',
          lg: 'text-lg',
        },
      },
      compoundVariants: [
        { intent: 'info', size: 'lg', class: 'font-bold uppercase' },
      ],
      defaults: { intent: 'info', size: 'sm' },
    });

    expect(alert({ intent: 'info', size: 'lg' })).toContain('font-bold uppercase');
    expect(alert({ intent: 'danger', size: 'lg' })).not.toContain('font-bold uppercase');
  });

  it('skips variants whose value is not in the record', () => {
    // Cast around the type system: simulate a missing variant
    const result = button({ variant: 'nonexistent' as unknown as 'default' });
    expect(result).toContain('inline-flex');
  });
});
