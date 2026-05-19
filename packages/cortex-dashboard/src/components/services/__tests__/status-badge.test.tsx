import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { StatusBadge } from '../status-badge';

describe('StatusBadge', () => {
	it('renders "Online" for online status', () => {
		render(<StatusBadge status="online" responseTime={50} />);
		expect(screen.getByText('Online')).toBeInTheDocument();
	});

	it('renders "Offline" for offline status', () => {
		render(<StatusBadge status="offline" responseTime={0} />);
		expect(screen.getByText('Offline')).toBeInTheDocument();
	});

	it('renders "Unknown" for unknown status', () => {
		render(<StatusBadge status="unknown" responseTime={0} />);
		expect(screen.getByText('Unknown')).toBeInTheDocument();
	});

	it('shows response time for online services', () => {
		render(<StatusBadge status="online" responseTime={42} />);
		expect(screen.getByText('42ms')).toBeInTheDocument();
	});

	it('hides response time when zero', () => {
		render(<StatusBadge status="online" responseTime={0} />);
		expect(screen.queryByText('0ms')).not.toBeInTheDocument();
	});

	it('hides response time for offline services', () => {
		render(<StatusBadge status="offline" responseTime={100} />);
		expect(screen.queryByText('100ms')).not.toBeInTheDocument();
	});

	it('hides response time for unknown services', () => {
		render(<StatusBadge status="unknown" responseTime={100} />);
		expect(screen.queryByText('100ms')).not.toBeInTheDocument();
	});

	it('applies emerald color classes for online', () => {
		const { container } = render(<StatusBadge status="online" responseTime={50} />);
		expect(container.querySelector('.bg-emerald-500\\/10')).toBeInTheDocument();
	});

	it('applies red color classes for offline', () => {
		const { container } = render(<StatusBadge status="offline" responseTime={0} />);
		expect(container.querySelector('.bg-red-500\\/10')).toBeInTheDocument();
	});

	it('applies amber color classes for unknown', () => {
		const { container } = render(<StatusBadge status="unknown" responseTime={0} />);
		expect(container.querySelector('.bg-amber-500\\/10')).toBeInTheDocument();
	});

	it('shows ping animation for online status', () => {
		const { container } = render(<StatusBadge status="online" responseTime={50} />);
		expect(container.querySelector('.animate-ping')).toBeInTheDocument();
	});

	it('does not show ping animation for offline status', () => {
		const { container } = render(<StatusBadge status="offline" responseTime={0} />);
		expect(container.querySelector('.animate-ping')).not.toBeInTheDocument();
	});

	it('does not show ping animation for unknown status', () => {
		const { container } = render(<StatusBadge status="unknown" responseTime={0} />);
		expect(container.querySelector('.animate-ping')).not.toBeInTheDocument();
	});
});
