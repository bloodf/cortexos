import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { CheckTypeBadge } from '../check-type-badge';

describe('CheckTypeBadge', () => {
	it('renders HTTP badge with chart-1 styling', () => {
		render(<CheckTypeBadge type="http" />);
		expect(screen.getByText('HTTP')).toBeInTheDocument();
		const badge = screen.getByText('HTTP').closest('span');
		expect(badge).toHaveClass('bg-chart-1/10');
		expect(badge).toHaveClass('text-chart-1');
	});

	it('renders TCP badge with chart-2 styling', () => {
		render(<CheckTypeBadge type="tcp" />);
		expect(screen.getByText('TCP')).toBeInTheDocument();
		const badge = screen.getByText('TCP').closest('span');
		expect(badge).toHaveClass('bg-chart-2/10');
		expect(badge).toHaveClass('text-chart-2');
	});

	it('renders Docker badge with chart-3 styling', () => {
		render(<CheckTypeBadge type="docker" />);
		expect(screen.getByText('Docker')).toBeInTheDocument();
		const badge = screen.getByText('Docker').closest('span');
		expect(badge).toHaveClass('bg-chart-3/10');
		expect(badge).toHaveClass('text-chart-3');
	});

	it('renders Process badge with chart-4 styling', () => {
		render(<CheckTypeBadge type="process" />);
		expect(screen.getByText('Process')).toBeInTheDocument();
		const badge = screen.getByText('Process').closest('span');
		expect(badge).toHaveClass('bg-chart-4/10');
		expect(badge).toHaveClass('text-chart-4');
	});

	it('uses Badge UI component', () => {
		const { container } = render(<CheckTypeBadge type="http" />);
		expect(container.querySelector('[data-slot="badge"]')).toBeInTheDocument();
	});
});
