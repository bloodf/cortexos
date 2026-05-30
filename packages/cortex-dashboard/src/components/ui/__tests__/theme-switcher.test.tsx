import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ThemeSwitcher, ThemeSettings } from '../theme-switcher';

const mockSetTheme = vi.fn();
const mockSetPreset = vi.fn();

vi.mock('@/hooks/use-theme', async () => {
	const actual = await vi.importActual<typeof import('@/hooks/use-theme')>(
		'@/hooks/use-theme',
	);
	return {
		...actual,
		useTheme: () => ({
			theme: 'dark',
			resolvedTheme: 'dark',
			setTheme: mockSetTheme,
			toggleTheme: vi.fn(),
		}),
		usePreset: () => ({
			preset: 'cortex',
			setPreset: mockSetPreset,
		}),
	};
});

describe('ThemeSwitcher', () => {
	it('renders a trigger button', () => {
		const { container } = render(<ThemeSwitcher />);
		expect(container.querySelector('button')).toBeInTheDocument();
	});
});

describe('ThemeSettings', () => {
	it('renders mode and accent options', () => {
		render(<ThemeSettings />);
		expect(screen.getByText('Mode')).toBeInTheDocument();
		expect(screen.getByText('Accent')).toBeInTheDocument();
		// All four presets are offered.
		expect(screen.getByTitle('Cortex')).toBeInTheDocument();
		expect(screen.getByTitle('Teal')).toBeInTheDocument();
		expect(screen.getByTitle('Emerald')).toBeInTheDocument();
		expect(screen.getByTitle('Amber')).toBeInTheDocument();
	});
});
