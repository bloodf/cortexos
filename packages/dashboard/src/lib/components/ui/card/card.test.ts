import { describe, it, expect, afterEach } from 'vitest';
import { render, cleanup } from '../../../utils/test-render';
import Card from './Card.svelte';
import CardHeader from './CardHeader.svelte';
import CardTitle from './CardTitle.svelte';
import CardDescription from './CardDescription.svelte';
import CardBody from './CardBody.svelte';
import CardFooter from './CardFooter.svelte';

describe('Card', () => {
  afterEach(cleanup);

  it('renders a card with data-slot="card"', () => {
    const { container } = render(Card);
    const card = container.querySelector('[data-slot="card"]');
    expect(card).not.toBeNull();
    expect(card?.className).toContain('rounded-xl');
  });

  it('respects size="sm"', () => {
    const { container } = render(Card, { props: { size: 'sm' } });
    const card = container.querySelector('[data-slot="card"]');
    expect(card?.getAttribute('data-size')).toBe('sm');
  });

  it('CardTitle renders the title slot wrapper', () => {
    const { container } = render(CardTitle);
    const t = container.querySelector('[data-slot="card-title"]');
    expect(t).not.toBeNull();
    expect(t?.className).toContain('font-semibold');
  });

  it('CardDescription renders the description slot wrapper', () => {
    const { container } = render(CardDescription);
    const d = container.querySelector('[data-slot="card-description"]');
    expect(d).not.toBeNull();
    expect(d?.className).toContain('text-muted-foreground');
  });

  it('CardHeader, CardBody, CardFooter each have data-slot', () => {
    const { container: h } = render(CardHeader);
    const { container: b } = render(CardBody);
    const { container: f } = render(CardFooter);
    expect(h.querySelector('[data-slot="card-header"]')).not.toBeNull();
    expect(b.querySelector('[data-slot="card-body"]')).not.toBeNull();
    expect(f.querySelector('[data-slot="card-footer"]')).not.toBeNull();
  });
});
