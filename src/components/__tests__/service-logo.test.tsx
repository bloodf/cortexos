import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { ServiceLogo } from '../service-logo';

describe('ServiceLogo', () => {
	it('renders an image when iconImage is provided', () => {
		render(<ServiceLogo serviceId="test" iconImage="/uploads/test.png" />);
		const img = screen.getByAltText('test');
		expect(img).toBeInTheDocument();
		expect(img).toHaveAttribute('src', '/uploads/test.png');
	});

	it('renders initial avatar when no image is provided', () => {
		const { container } = render(<ServiceLogo serviceId="home-assistant" />);
		const svg = container.querySelector('svg');
		expect(svg).toBeInTheDocument();
		// Should show "HA" for "home-assistant"
		expect(screen.getByText('HA')).toBeInTheDocument();
	});

	it('uses brand color for known services', () => {
		const { container } = render(<ServiceLogo serviceId="grafana" />);
		const rect = container.querySelector('rect');
		expect(rect).toHaveAttribute('fill', '#f46800');
	});

	it('uses iconColor when provided', () => {
		const { container } = render(<ServiceLogo serviceId="unknown" iconColor="#ff0000" />);
		const rect = container.querySelector('rect');
		expect(rect).toHaveAttribute('fill', '#ff0000');
	});

	it('uses fallback color for unknown services', () => {
		const { container } = render(<ServiceLogo serviceId="unknown-service" />);
		const rect = container.querySelector('rect');
		expect(rect).toHaveAttribute('fill', '#525252');
	});

	it('respects custom size', () => {
		const { container } = render(<ServiceLogo serviceId="test" size={64} />);
		const svg = container.querySelector('svg');
		expect(svg).toHaveAttribute('width', '64');
		expect(svg).toHaveAttribute('height', '64');
	});
});
