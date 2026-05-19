import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { TriggerCheckButton } from '../trigger-check-button';

describe('TriggerCheckButton', () => {
	beforeEach(() => {
		vi.restoreAllMocks();
	});

	it('renders button with play icon', () => {
		render(<TriggerCheckButton serviceId={1} healthType="process" />);
		const btn = screen.getByRole('button');
		expect(btn).toBeInTheDocument();
		expect(btn.querySelector('svg')).toBeInTheDocument();
	});

	it('is disabled for non-process types', () => {
		render(<TriggerCheckButton serviceId={1} healthType="http" />);
		expect(screen.getByRole('button')).toBeDisabled();
	});

	it('is enabled for process type', () => {
		render(<TriggerCheckButton serviceId={1} healthType="process" />);
		expect(screen.getByRole('button')).not.toBeDisabled();
	});

	it('calls POST /api/services/trigger when clicked', async () => {
		global.fetch = vi.fn().mockResolvedValue({ ok: true, json: async () => ({}) });
		render(<TriggerCheckButton serviceId={42} healthType="process" />);
		fireEvent.click(screen.getByRole('button'));
		await waitFor(() => {
			expect(global.fetch).toHaveBeenCalledWith('/api/services/trigger', expect.objectContaining({
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ serviceId: 42 }),
			}));
		});
	});

	it('shows loading state while triggering', async () => {
		let resolveFetch: (value: Response) => void;
		const fetchPromise = new Promise<Response>((resolve) => {
			resolveFetch = resolve;
		});
		global.fetch = vi.fn().mockReturnValue(fetchPromise);
		render(<TriggerCheckButton serviceId={1} healthType="process" />);
		fireEvent.click(screen.getByRole('button'));
		await waitFor(() => {
			expect(screen.getByRole('button')).toBeDisabled();
		});
		resolveFetch!({ ok: true } as Response);
	});

	it('calls onTrigger callback after success', async () => {
		const onTrigger = vi.fn();
		global.fetch = vi.fn().mockResolvedValue({ ok: true, json: async () => ({}) });
		render(<TriggerCheckButton serviceId={1} healthType="process" onTrigger={onTrigger} />);
		fireEvent.click(screen.getByRole('button'));
		await waitFor(() => {
			expect(onTrigger).toHaveBeenCalled();
		});
	});

	it('uses Button UI component', () => {
		const { container } = render(<TriggerCheckButton serviceId={1} healthType="process" />);
		expect(container.querySelector('[data-slot="button"]')).toBeInTheDocument();
	});
});
