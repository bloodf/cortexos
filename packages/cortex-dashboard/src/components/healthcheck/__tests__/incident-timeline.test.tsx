import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { IncidentTimeline } from '../incident-timeline';

describe('IncidentTimeline', () => {
	const incidents = [
		{ from_status: 'online', to_status: 'offline', changed_at: '2024-01-01T00:00:00Z' },
		{ from_status: 'offline', to_status: 'online', changed_at: '2024-01-01T01:00:00Z' },
	];

	it('renders incident list', () => {
		render(<IncidentTimeline incidents={incidents} />);
		expect(screen.getByText('Incidents')).toBeInTheDocument();
		expect(screen.getAllByText('online').length).toBeGreaterThanOrEqual(2);
		expect(screen.getAllByText('offline').length).toBeGreaterThanOrEqual(2);
	});

	it('renders empty state when no incidents', () => {
		render(<IncidentTimeline incidents={[]} />);
		expect(screen.getByText('No incidents in recent history.')).toBeInTheDocument();
	});

	it('limits items to maxItems', () => {
		const many = Array.from({ length: 30 }, (_, i) => ({
			from_status: 'online',
			to_status: 'offline',
			changed_at: `2024-01-01T${String(i).padStart(2, '0')}:00:00Z`,
		}));
		render(<IncidentTimeline incidents={many} maxItems={5} />);
		expect(screen.getAllByText('online').length).toBeLessThanOrEqual(10);
	});
});
