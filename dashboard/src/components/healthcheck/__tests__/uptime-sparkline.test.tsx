import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { UptimeSparkline } from '../uptime-sparkline';

describe('UptimeSparkline', () => {
	const data = [
		{ time: '00:00', value: 99 },
		{ time: '01:00', value: 100 },
		{ time: '02:00', value: 98 },
	];

	it('renders title', () => {
		render(<UptimeSparkline title="Uptime 24h" data={data} />);
		expect(screen.getByText('Uptime 24h')).toBeInTheDocument();
	});

	it('renders chart container', () => {
		const { container } = render(<UptimeSparkline title="Uptime 24h" data={data} />);
		expect(container.querySelector('[data-slot="card-content"]')).toBeInTheDocument();
	});

	it('renders with custom unit', () => {
		render(<UptimeSparkline title="Latency" data={data} unit="ms" />);
		expect(screen.getByText('Latency')).toBeInTheDocument();
	});
});
