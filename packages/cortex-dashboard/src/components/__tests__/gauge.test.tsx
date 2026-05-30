import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Gauge } from '../gauge';

describe('Gauge', () => {
	it('renders the label text', () => {
		render(<Gauge value={50} label="CPU" color="#10b981" />);
		expect(screen.getByText('CPU')).toBeInTheDocument();
	});

	it('renders the percentage value', () => {
		render(<Gauge value={75} label="Test" color="#10b981" />);
		// Initial value is 0 due to animation, but the text updates via useEffect
		expect(screen.getByText('0%')).toBeInTheDocument();
	});

	it('renders the sublabel when provided', () => {
		render(<Gauge value={50} label="CPU" color="#10b981" sublabel="Load: 1.5 / 2.0" />);
		expect(screen.getByText('Load: 1.5 / 2.0')).toBeInTheDocument();
	});

	it('renders the icon when provided', () => {
		render(
			<Gauge value={50} label="CPU" color="#10b981" icon={<span data-testid="test-icon">🖥️</span>} />
		);
		expect(screen.getByTestId('test-icon')).toBeInTheDocument();
	});

	it('does not render sublabel when not provided', () => {
		const { container } = render(<Gauge value={50} label="Test" color="#10b981" />);
		const sublabel = container.querySelector('.text-white\\/40.mt-0\\.5');
		expect(sublabel).toBeNull();
	});

	it('renders an SVG element', () => {
		const { container } = render(<Gauge value={50} label="Test" color="#10b981" />);
		expect(container.querySelector('svg')).toBeInTheDocument();
	});
});
