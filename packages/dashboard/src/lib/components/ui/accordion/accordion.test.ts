import { describe, it, expect, afterEach } from 'vitest';
import { render, cleanup } from '../../../utils/test-render';
import AccordionTrigger from './AccordionTrigger.svelte';
import AccordionContent from './AccordionContent.svelte';

describe('Accordion', () => {
  afterEach(cleanup);

  it('Trigger sets aria-expanded correctly', () => {
    const { container } = render(AccordionTrigger, { props: { value: 'a', open: 'a' } });
    expect(container.querySelector('button')?.getAttribute('aria-expanded')).toBe('true');
  });

  it('Trigger shows closed state when not open', () => {
    const { container } = render(AccordionTrigger, { props: { value: 'a', open: '' } });
    expect(container.querySelector('button')?.getAttribute('aria-expanded')).toBe('false');
  });

  it('Content only renders when open', () => {
    const { container: open } = render(AccordionContent, { props: { value: 'a', open: 'a', children: () => null } });
    const { container: closed } = render(AccordionContent, { props: { value: 'b', open: 'a', children: () => null } });
    expect(open.querySelector('[role="region"]')).not.toBeNull();
    expect(closed.querySelector('[role="region"]')).toBeNull();
  });
});
