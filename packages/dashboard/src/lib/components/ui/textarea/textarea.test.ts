import { describe, it, expect, afterEach } from 'vitest';
import { render, cleanup } from '../../../utils/test-render';
import Textarea from './Textarea.svelte';

describe('Textarea', () => {
  afterEach(cleanup);

  it('renders a textarea', () => {
    const { container } = render(Textarea, { props: { placeholder: 'Note' } });
    const t = container.querySelector('textarea');
    expect(t).not.toBeNull();
    expect(t?.getAttribute('placeholder')).toBe('Note');
  });

  it('respects rows prop', () => {
    const { container } = render(Textarea, { props: { rows: 8 } });
    expect(container.querySelector('textarea')?.getAttribute('rows')).toBe('8');
  });

  it('marks aria-invalid when invalid prop is set', () => {
    const { container } = render(Textarea, { props: { invalid: true } });
    expect(container.querySelector('textarea')).toHaveAttribute('aria-invalid', 'true');
  });
});
