import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

// developer-icons is a runtime dependency that may not be installed in the
// test sandbox. Mock the named exports TechIcon imports so the module graph
// resolves; each renders a marker <svg> we can assert against.
vi.mock('developer-icons', () => {
	const make = (name: string) =>
		function MockIcon({ size, className }: { size?: number; className?: string }) {
			return (
				<svg width={size} height={size} className={className} data-dev-icon={name} />
			);
		};
	return {
		PostgreSQL: make('postgresql'),
		Redis: make('redis'),
		MongoDB: make('mongodb'),
		MySQL: make('mysql'),
		Grafana: make('grafana'),
		Docker: make('docker'),
	};
});

import { ServiceLogo } from '../service-logo';

describe('ServiceLogo', () => {
	it('renders an image when iconImage is provided', () => {
		render(<ServiceLogo serviceId="test" iconImage="/uploads/test.png" />);
		const img = screen.getByAltText('test');
		expect(img).toBeInTheDocument();
		expect(img).toHaveAttribute('src', '/uploads/test.png');
	});

	it('renders a developer-icons component for known tech slugs', () => {
		const { container } = render(<ServiceLogo serviceId="grafana" />);
		expect(container.querySelector('[data-dev-icon="grafana"]')).toBeInTheDocument();
	});

	it('renders a vendored brand SVG via <img> for vendored slugs', () => {
		render(<ServiceLogo serviceId="home-assistant" />);
		const img = screen.getByAltText('home-assistant');
		expect(img).toHaveAttribute('src', '/icons/home-assistant.svg');
	});

	it('renders a tinted monogram for brandless services', () => {
		const { container } = render(<ServiceLogo serviceId="obot" />);
		const rect = container.querySelector('rect');
		// obot has a BRAND_COLOR tint
		expect(rect).toHaveAttribute('fill', '#7c3aed');
		expect(screen.getByText('OB')).toBeInTheDocument();
	});

	it('uses iconColor as the monogram tint when provided', () => {
		const { container } = render(<ServiceLogo serviceId="unknown" iconColor="#ff0000" />);
		const rect = container.querySelector('rect');
		expect(rect).toHaveAttribute('fill', '#ff0000');
	});

	it('uses fallback color for unknown brandless services', () => {
		const { container } = render(<ServiceLogo serviceId="unknown-service" />);
		const rect = container.querySelector('rect');
		expect(rect).toHaveAttribute('fill', '#525252');
	});

	it('respects custom size on the monogram fallback', () => {
		const { container } = render(<ServiceLogo serviceId="unknown" size={64} />);
		const svg = container.querySelector('svg');
		expect(svg).toHaveAttribute('width', '64');
		expect(svg).toHaveAttribute('height', '64');
	});
});
