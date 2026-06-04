/**
 * AuditFilters.test.ts — controlled component: every change fires
 * `onChange` (debounced), and the controls reflect the parent's
 * `value` prop.
 */
import { describe, it, expect, afterEach, vi } from 'vitest';
import userEvent from '@testing-library/user-event';
import { tick } from 'svelte';
import type { ComponentProps } from 'svelte';
import { render, cleanup } from '../../../utils/test-render';
import AuditFilters from '../AuditFilters.svelte';
import { testMessages } from './messages';

afterEach(cleanup);

type FiltersProps = ComponentProps<typeof AuditFilters>;
type FiltersValue = FiltersProps['value'];
type OnChange = FiltersProps['onChange'];

function makeProps(
	over: { value?: Partial<FiltersValue>; surfaces?: readonly string[]; actions?: readonly string[] } = {},
) {
	const onChange = vi.fn() as unknown as OnChange;
	const value: FiltersValue = {
		actor: '',
		surface: '',
		action: '',
		result: '',
		since: '',
		until: '',
		...over.value,
	};
	const props = {
		value,
		surfaces: over.surfaces ?? ['auth', 'services'],
		actions: over.actions ?? ['auth.login', 'auth.logout'],
		messages: testMessages,
		onChange,
	};
	return { props, onChange };
}

describe('AuditFilters', () => {
	it('renders actor, surface, action, result, since, until controls', () => {
		const { props } = makeProps();
		const { container } = render(AuditFilters, { props });
		expect(container.querySelector('input[type="search"]')).not.toBeNull();
		expect(container.querySelectorAll('select').length).toBe(2);
		expect(container.querySelectorAll('input[type="text"]').length).toBe(2);
	});

	it('includes "All results" as the first result option', () => {
		const { props } = makeProps();
		const { container } = render(AuditFilters, { props });
		const selects = container.querySelectorAll('select');
		// First select is surface, second is result.
		const resultSelect = selects[1]!;
		const first = resultSelect.querySelector('option') as HTMLOptionElement | null;
		expect(first?.textContent).toBe('All results');
		expect(first?.value).toBe('');
	});

	it('includes "All surfaces" as the first surface option', () => {
		const { props } = makeProps();
		const { container } = render(AuditFilters, { props });
		const selects = container.querySelectorAll('select');
		const surfaceSelect = selects[0]!;
		const first = surfaceSelect.querySelector('option') as HTMLOptionElement | null;
		expect(first?.textContent).toBe('All surfaces');
		expect(first?.value).toBe('');
	});

	it('emits onChange after the debounce window when the user types in actor', async () => {
		const user = userEvent.setup();
		const { props, onChange } = makeProps();
		const { container } = render(AuditFilters, { props });
		const input = container.querySelector('input[type="search"]') as HTMLInputElement;
		await user.type(input, 'alice');
		await new Promise((r) => setTimeout(r, 200));
		await tick();
		expect(onChange).toHaveBeenCalled();
		const last = (onChange as unknown as { mock: { calls: FiltersValue[][] } }).mock.calls.at(-1)?.[0];
		expect(last?.actor).toBe('alice');
	});

	it('emits onChange when the surface select changes', async () => {
		const user = userEvent.setup();
		const { props, onChange } = makeProps();
		const { container } = render(AuditFilters, { props });
		const surfaceSelect = container.querySelectorAll('select')[0] as HTMLSelectElement;
		await user.selectOptions(surfaceSelect, 'auth');
		await new Promise((r) => setTimeout(r, 200));
		await tick();
		expect(onChange).toHaveBeenCalled();
		const last = (onChange as unknown as { mock: { calls: FiltersValue[][] } }).mock.calls.at(-1)?.[0];
		expect(last?.surface).toBe('auth');
	});

	it('shows the Clear button only when there is a value', async () => {
		const { props: p1 } = makeProps();
		const { container: c1 } = render(AuditFilters, { props: p1 });
		expect(c1.querySelector('[data-slot="audit-filters-clear"]')).toBeNull();

		const { props: p2 } = makeProps({ value: { actor: 'x' } });
		const { container: c2 } = render(AuditFilters, { props: p2 });
		expect(c2.querySelector('[data-slot="audit-filters-clear"]')).not.toBeNull();
	});

	it('clear button fires onChange with empty values', async () => {
		const user = userEvent.setup();
		const { props, onChange } = makeProps({ value: { actor: 'x', surface: 'auth' } });
		const { container } = render(AuditFilters, { props });
		const clear = container.querySelector('[data-slot="audit-filters-clear"]') as HTMLButtonElement;
		await user.click(clear);
		expect(onChange).toHaveBeenCalledWith({
			actor: '',
			surface: '',
			action: '',
			result: '',
			since: '',
			until: '',
		});
	});
});
