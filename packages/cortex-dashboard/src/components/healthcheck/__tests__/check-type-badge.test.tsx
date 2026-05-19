import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { CheckTypeBadge } from '../check-type-badge';

describe('CheckTypeBadge', () => {
	it('renders HTTP badge with blue styling', () => {
		render(<CheckTypeBadge type="http" />);
		expect(screen.getByText('HTTP')).toBeInTheDocument();
		const badge = screen.getByText('HTTP').closest('span');
		expect(badge).toHaveClass('bg-blue-500/10');
		expect(badge).toHaveClass('text-blue-400');
	});

	it('renders TCP badge with purple styling', () => {
		render(<CheckTypeBadge type="tcp" />);
		expect(screen.getByText('TCP')).toBeInTheDocument();
		const badge = screen.getByText('TCP').closest('span');
		expect(badge).toHaveClass('bg-purple-500/10');
		expect(badge).toHaveClass('text-purple-400');
	});

	it('renders Docker badge with cyan styling', () => {
		render(<CheckTypeBadge type="docker" />);
		expect(screen.getByText('Docker')).toBeInTheDocument();
		const badge = screen.getByText('Docker').closest('span');
		expect(badge).toHaveClass('bg-cyan-500/10');
		expect(badge).toHaveClass('text-cyan-400');
	});

	it('renders Process badge with orange styling', () => {
		render(<CheckTypeBadge type="process" />);
		expect(screen.getByText('Process')).toBeInTheDocument();
		const badge = screen.getByText('Process').closest('span');
		expect(badge).toHaveClass('bg-orange-500/10');
		expect(badge).toHaveClass('text-orange-400');
	});

	it('uses Badge UI component', () => {
		const { container } = render(<CheckTypeBadge type="http" />);
		expect(container.querySelector('[data-slot="badge"]')).toBeInTheDocument();
	});
});
