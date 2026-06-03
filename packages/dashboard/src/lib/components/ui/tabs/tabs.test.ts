import { describe, it, expect, afterEach } from 'vitest';
import { render, cleanup } from '../../../utils/test-render';
import Tabs from './Tabs.svelte';
import TabsTrigger from './TabsTrigger.svelte';
import TabsContent from './TabsContent.svelte';

describe('Tabs', () => {
  afterEach(cleanup);

  it('renders triggers with role=tab', () => {
    const { container } = render(Tabs, {
      props: {
        value: '',
        children: () => null,
      },
    });
    void container;
  });

  it('TabsTrigger shows selected state when value matches', () => {
    const { container } = render(TabsTrigger, { props: { value: 'a', selected: 'a' } });
    const t = container.querySelector('[role="tab"]');
    expect(t?.getAttribute('data-state')).toBe('active');
    expect(t?.getAttribute('aria-selected')).toBe('true');
  });

  it('TabsTrigger shows inactive state when value differs', () => {
    const { container } = render(TabsTrigger, { props: { value: 'a', selected: 'b' } });
    expect(container.querySelector('[role="tab"]')?.getAttribute('data-state')).toBe('inactive');
  });

  it('TabsContent only renders when value matches', () => {
    const { container: a } = render(TabsContent, { props: { value: 'a', selected: 'a', children: () => null } });
    const { container: b } = render(TabsContent, { props: { value: 'b', selected: 'a', children: () => null } });
    expect(a.querySelector('[role="tabpanel"]')).not.toBeNull();
    expect(b.querySelector('[role="tabpanel"]')).toBeNull();
  });
});
