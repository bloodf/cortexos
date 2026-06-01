import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { SkeletonCard, SkeletonText, SkeletonTable, SkeletonServiceGrid } from '../skeleton';

describe('SkeletonCard', () => {
	it('renders default skeleton card', () => {
		const { container } = render(<SkeletonCard />);
		expect(container.querySelector('.glass-panel')).toBeInTheDocument();
		expect(container.querySelector('.animate-pulse')).toBeInTheDocument();
	});

	it('renders children instead of default content', () => {
		render(<SkeletonCard><span data-testid="child">Custom</span></SkeletonCard>);
		expect(screen.getByTestId('child')).toBeInTheDocument();
	});

	it('applies custom className', () => {
		const { container } = render(<SkeletonCard className="custom-class" />);
		expect(container.firstChild).toHaveClass('custom-class');
	});
});

describe('SkeletonText', () => {
	it('renders default 3 lines', () => {
		const { container } = render(<SkeletonText />);
		const lines = container.querySelectorAll('.animate-pulse');
		expect(lines.length).toBe(3);
	});

	it('renders custom number of lines', () => {
		const { container } = render(<SkeletonText lines={5} />);
		const lines = container.querySelectorAll('.animate-pulse');
		expect(lines.length).toBe(5);
	});
});

describe('SkeletonTable', () => {
	it('renders the correct number of rows', () => {
		const { container } = render(<SkeletonTable rows={3} cols={4} />);
		// 1 header row + 3 data rows
		const allRows = container.querySelectorAll('.flex.gap-4');
		expect(allRows.length).toBe(4);
	});
});

describe('SkeletonServiceGrid', () => {
	it('renders default 8 skeleton cards', () => {
		const { container } = render(<SkeletonServiceGrid />);
		const cards = container.querySelectorAll('.glass-panel');
		expect(cards.length).toBe(8);
	});

	it('renders custom count', () => {
		const { container } = render(<SkeletonServiceGrid count={4} />);
		const cards = container.querySelectorAll('.glass-panel');
		expect(cards.length).toBe(4);
	});
});
