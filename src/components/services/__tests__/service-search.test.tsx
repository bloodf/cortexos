import { render, screen, fireEvent } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { ServiceSearch } from '../service-search';

describe('ServiceSearch', () => {
	it('renders an input with placeholder', () => {
		render(<ServiceSearch value="" onChange={() => {}} />);
		expect(screen.getByPlaceholderText('Search services...')).toBeInTheDocument();
	});

	it('renders custom placeholder', () => {
		render(<ServiceSearch value="" onChange={() => {}} placeholder="Find..." />);
		expect(screen.getByPlaceholderText('Find...')).toBeInTheDocument();
	});

	it('displays the current value', () => {
		render(<ServiceSearch value="grafana" onChange={() => {}} />);
		const input = screen.getByPlaceholderText('Search services...') as HTMLInputElement;
		expect(input.value).toBe('grafana');
	});

	it('calls onChange when typing', () => {
		let captured = '';
		render(<ServiceSearch value="" onChange={(v) => { captured = v; }} />);
		const input = screen.getByPlaceholderText('Search services...');
		fireEvent.change(input, { target: { value: 'test' } });
		expect(captured).toBe('test');
	});

	it('has a search icon', () => {
		const { container } = render(<ServiceSearch value="" onChange={() => {}} />);
		const svg = container.querySelector('svg');
		expect(svg).toBeInTheDocument();
	});
});
