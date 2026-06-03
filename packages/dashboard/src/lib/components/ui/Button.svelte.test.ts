import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/svelte';
import { tick } from 'svelte';
import ButtonWrapper from './Button.test-wrapper.svelte';

/**
 * Helper: renders the test wrapper with the given props (everything
 * is forwarded to the real `Button` component). The wrapper renders
 * `label` inside a real `{#snippet children()}` block — required
 * because `Snippet` is a branded type and cannot be constructed from
 * a plain function in a test.
 */
async function renderButton(props: Record<string, unknown>): Promise<void> {
	render(ButtonWrapper, { props });
	await tick();
}

describe('Button', () => {
	it('renders the default slot content', async () => {
		await renderButton({ label: 'Click me' });
		const btn = screen.getByRole('button', { name: 'Click me' });
		expect(btn).toBeInstanceOf(HTMLButtonElement);
	});

	it('uses aria-label when no visible text is provided', async () => {
		await renderButton({ label: '', ariaLabel: 'Save' });
		const btn = screen.getByRole('button', { name: 'Save' });
		expect(btn).toBeInstanceOf(HTMLButtonElement);
	});

	it('is disabled when `disabled` is true', async () => {
		await renderButton({ label: 'Locked', disabled: true });
		const btn = screen.getByRole('button', { name: 'Locked' });
		expect(btn).toBeDisabled();
	});

	it('is disabled and exposes aria-busy when `loading` is true', async () => {
		await renderButton({ label: 'Sending', loading: true });
		const btn = screen.getByRole('button', { name: 'Sending' });
		expect(btn).toBeDisabled();
		expect(btn).toHaveAttribute('aria-busy', 'true');
	});

	it('invokes `onclick` when clicked', async () => {
		let clicked = 0;
		await renderButton({
			label: 'Click me',
			onclick: () => {
				clicked += 1;
			},
		});
		const btn = screen.getByRole('button', { name: 'Click me' });
		btn.click();
		expect(clicked).toBe(1);
	});

	it('does not invoke `onclick` when disabled', async () => {
		let clicked = 0;
		await renderButton({
			label: 'Locked',
			disabled: true,
			onclick: () => {
				clicked += 1;
			},
		});
		const btn = screen.getByRole('button', { name: 'Locked' });
		btn.click();
		expect(clicked).toBe(0);
	});

	it('forwards aria-controls and aria-expanded for menu triggers', async () => {
		await renderButton({
			label: '',
			ariaLabel: 'Open menu',
			ariaControls: 'menu-1',
			ariaExpanded: true,
		});
		const btn = screen.getByRole('button', { name: 'Open menu' });
		expect(btn.getAttribute('aria-controls')).toBe('menu-1');
		expect(btn.getAttribute('aria-expanded')).toBe('true');
	});

	it('renders the destructive variant with a destructive-friendly class', async () => {
		await renderButton({ label: 'Delete', variant: 'destructive' });
		const btn = screen.getByRole('button', { name: 'Delete' });
		expect(btn.className).toMatch(/destructive/);
	});
});
