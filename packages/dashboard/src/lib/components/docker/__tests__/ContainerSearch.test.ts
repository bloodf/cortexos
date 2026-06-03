/**
 * ContainerSearch.test.ts — controlled component: every change
 * fires `onChange` (debounced), and the controls reflect the
 * parent's `query` / `state` props.
 */
import { describe, it, expect, afterEach, vi } from 'vitest';
import { tick } from 'svelte';
import { render, cleanup } from '../../../utils/test-render';
import ContainerSearch from '../ContainerSearch.svelte';
import { testMessages } from './messages';

type Change = { query: string; stateFilter: 'all' | 'running' | 'stopped' | 'paused' | 'restarting' };
type OnChange = (next: Change) => void;

function makeProps(
  over: {
    query?: string;
    stateFilter?: 'all' | 'running' | 'stopped' | 'paused' | 'restarting';
  } = {},
) {
  const onChange = vi.fn() as unknown as OnChange;
  const props = {
    query: over.query ?? '',
    stateFilter: over.stateFilter ?? 'all',
    messages: testMessages,
    onChange,
  };
  return props;
}

describe('ContainerSearch', () => {
  afterEach(cleanup);

  it('renders the search input and the state select', () => {
    const props = makeProps();
    const { container } = render(ContainerSearch, { props });
    expect(container.querySelector('input[type="search"]')).not.toBeNull();
    expect(container.querySelector('select')).not.toBeNull();
  });

  it('emits onChange after the debounce window when the user types', async () => {
    const { default: userEvent } = await import('@testing-library/user-event');
    const user = userEvent.setup();
    const props = makeProps();
    const { container } = render(ContainerSearch, { props });
    const input = container.querySelector('input[type="search"]') as HTMLInputElement;
    await user.type(input, 'graf');
    // Wait past the 150ms debounce.
    await new Promise((r) => setTimeout(r, 200));
    await tick();
    expect(props.onChange).toHaveBeenCalled();
    const lastCall = (props.onChange as unknown as { mock: { calls: Change[][] } }).mock.calls.at(
      -1,
    )?.[0] as Change;
    expect(lastCall.query).toBe('graf');
  });

  it('shows the Clear button only when there is a value', () => {
    const empty = render(ContainerSearch, { props: makeProps() });
    expect(empty.container.querySelector('[data-slot="container-search-clear"]')).toBeNull();
    cleanup();
    const withValue = render(ContainerSearch, { props: makeProps({ query: 'x' }) });
    expect(
      withValue.container.querySelector('[data-slot="container-search-clear"]'),
    ).not.toBeNull();
  });

  it('clear button fires onChange with empty values', async () => {
    const props = makeProps({ query: 'x', stateFilter: 'running' });
    const { container } = render(ContainerSearch, { props });
    const clear = container.querySelector(
      '[data-slot="container-search-clear"]',
    ) as HTMLButtonElement;
    clear.click();
    expect(props.onChange).toHaveBeenCalledWith({ query: '', stateFilter: 'all' });
  });

  it('includes "All states" as the first select option', () => {
    const { container } = render(ContainerSearch, { props: makeProps() });
    const first = container.querySelector('select option') as HTMLOptionElement | null;
    expect(first?.textContent).toBe('All states');
    expect(first?.value).toBe('all');
  });
});
