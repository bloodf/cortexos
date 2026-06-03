/**
 * ServiceSearch.test.ts — controlled component: every change fires
 * `onChange` (debounced), and the controls reflect the parent's
 * `query` / `category` props.
 */
import { describe, it, expect, afterEach, vi } from 'vitest';
import userEvent from '@testing-library/user-event';
import { tick } from 'svelte';
import { render, cleanup } from '../../../utils/test-render';
import ServiceSearch from '../ServiceSearch.svelte';

type Change = { query: string; category: string };
type OnChange = (next: Change) => void;

function makeProps(over: { query?: string; category?: string; categories?: readonly string[] } = {}) {
	const onChange = vi.fn() as unknown as OnChange;
	const props = {
		query: over.query ?? '',
		category: over.category ?? '',
		categories: over.categories ?? (['AI', 'Database'] as const),
		onChange,
	};
	return props;
}

describe('ServiceSearch', () => {
	afterEach(cleanup);

	it('renders the search input and the category select', () => {
		const props = makeProps();
		const { container } = render(ServiceSearch, { props });
		expect(container.querySelector('input[type="search"]')).not.toBeNull();
		expect(container.querySelector('select')).not.toBeNull();
	});

	it('emits onChange after the debounce window when the user types', async () => {
		const user = userEvent.setup();
		const props = makeProps();
		const { container } = render(ServiceSearch, { props });
		const input = container.querySelector('input[type="search"]') as HTMLInputElement;
		await user.type(input, 'graf');
		// Wait past the 150ms debounce.
		await new Promise((r) => setTimeout(r, 200));
		await tick();
		expect(props.onChange).toHaveBeenCalled();
		const lastCall = (props.onChange as unknown as { mock: { calls: Change[][] } }).mock.calls.at(-1)?.[0] as Change;
		expect(lastCall.query).toBe('graf');
	});

	it('shows the Clear button only when there is a value', async () => {
		const { container } = render(ServiceSearch, { props: makeProps() });
		expect(container.querySelector('[data-slot="service-search-clear"]')).toBeNull();
		const re = render(ServiceSearch, { props: makeProps({ query: 'x' }) });
		expect(re.container.querySelector('[data-slot="service-search-clear"]')).not.toBeNull();
		cleanup();
	});

	it('clear button fires onChange with empty values', async () => {
		const user = userEvent.setup();
		const props = makeProps({ query: 'x', category: 'AI' });
		const { container } = render(ServiceSearch, { props });
		const clear = container.querySelector('[data-slot="service-search-clear"]') as HTMLButtonElement;
		await user.click(clear);
		expect(props.onChange).toHaveBeenCalledWith({ query: '', category: '' });
	});

	it('includes "All categories" as the first select option', () => {
		const { container } = render(ServiceSearch, { props: makeProps() });
		const first = container.querySelector('select option') as HTMLOptionElement | null;
		expect(first?.textContent).toBe('All categories');
		expect(first?.value).toBe('');
	});
});
