import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { HealthcheckTable } from '../healthcheck-table';
import type { HealthcheckService } from '../healthcheck-table';

const mockServices: HealthcheckService[] = [
	{
		id: 1,
		slug: 'service-a',
		name: 'Service A',
		open_url:'https://a.test',
		category: 'AI',
		status: 'online',
		responseTime: 42,
		icon_color: null,
		icon_image: null,
		health_type: 'http',
		health_url: 'https://a.test/health',
	},
	{
		id: 2,
		slug: 'service-b',
		name: 'Service B',
		open_url:'tcp://b.test:8080',
		category: 'Storage',
		status: 'offline',
		responseTime: 0,
		icon_color: null,
		icon_image: null,
		health_type: 'tcp',
		health_url: 'tcp://b.test:8080',
	},
	{
		id: 3,
		slug: 'service-c',
		name: 'Service C',
		open_url:'docker://container-c',
		category: 'Infrastructure',
		status: 'unknown',
		responseTime: 0,
		icon_color: '#ff0000',
		icon_image: null,
		health_type: 'docker',
		health_url: 'docker://container-c',
	},
	{
		id: 4,
		slug: 'service-d',
		name: 'Service D',
		open_url:'process://d',
		category: 'Monitoring',
		status: 'online',
		responseTime: 15,
		icon_color: null,
		icon_image: null,
		health_type: 'process',
		health_url: 'process://d',
	},
];

describe('HealthcheckTable', () => {
	it('renders service names', () => {
		render(<HealthcheckTable services={mockServices} />);
		expect(screen.getByText('Service A')).toBeInTheDocument();
		expect(screen.getByText('Service B')).toBeInTheDocument();
	});

	it('renders status badges', () => {
		render(<HealthcheckTable services={mockServices} />);
		expect(screen.getAllByText('Online').length).toBeGreaterThanOrEqual(1);
		expect(screen.getByText('Offline')).toBeInTheDocument();
	});

	it('renders check type badges', () => {
		render(<HealthcheckTable services={mockServices} />);
		expect(screen.getByText('HTTP')).toBeInTheDocument();
		expect(screen.getByText('TCP')).toBeInTheDocument();
		expect(screen.getByText('Docker')).toBeInTheDocument();
		expect(screen.getByText('Process')).toBeInTheDocument();
	});

	it('renders response times', () => {
		render(<HealthcheckTable services={mockServices} />);
		expect(screen.getAllByText('42ms').length).toBeGreaterThanOrEqual(1);
		expect(screen.getAllByText('—').length).toBeGreaterThanOrEqual(1);
	});

	it('renders trigger buttons for process type', () => {
		render(<HealthcheckTable services={mockServices} />);
		const buttons = screen.getAllByRole('button');
		expect(buttons.length).toBeGreaterThanOrEqual(1);
	});

	it('shows empty state when no services', () => {
		render(<HealthcheckTable services={[]} />);
		expect(screen.getByText(/no services/i)).toBeInTheDocument();
	});

	it('renders mobile cards when isMobile is true', () => {
		render(<HealthcheckTable services={mockServices} isMobile />);
		expect(screen.getByText('Service A')).toBeInTheDocument();
		expect(screen.getByText('HTTP')).toBeInTheDocument();
		expect(screen.getByText('Service B')).toBeInTheDocument();
		expect(screen.getByText('TCP')).toBeInTheDocument();
	});

	it('renders table when isMobile is false', () => {
		const { container } = render(<HealthcheckTable services={mockServices} isMobile={false} />);
		expect(container.querySelector('table')).toBeInTheDocument();
	});

	it('renders target column with health_url', () => {
		render(<HealthcheckTable services={mockServices} />);
		expect(screen.getByText('https://a.test/health')).toBeInTheDocument();
	});

	it('disables trigger button for non-process types', () => {
		render(<HealthcheckTable services={mockServices} />);
		const allButtons = screen.getAllByRole('button');
		const disabled = allButtons.filter((b) => b.hasAttribute('disabled'));
		expect(disabled.length).toBeGreaterThanOrEqual(3);
	});

	it('enables trigger button for process type', () => {
		render(<HealthcheckTable services={mockServices} />);
		const allButtons = screen.getAllByRole('button');
		const enabled = allButtons.filter((b) => !b.hasAttribute('disabled'));
		expect(enabled.length).toBeGreaterThanOrEqual(1);
	});
});
