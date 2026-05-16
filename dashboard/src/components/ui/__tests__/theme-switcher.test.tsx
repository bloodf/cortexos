import { render, screen, fireEvent } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ThemeSwitcher } from '../theme-switcher';

// Mock the useTheme hook
const mockToggleTheme = vi.fn();
let mockTheme = 'dark';

vi.mock('@/hooks/use-theme', () => ({
	useTheme: () => ({
		theme: mockTheme,
		toggleTheme: mockToggleTheme,
		setTheme: vi.fn(),
	}),
}));

describe('ThemeSwitcher', () => {
	it('renders a button', () => {
		const { container } = render(<ThemeSwitcher />);
		expect(container.querySelector('button')).toBeInTheDocument();
	});

	it('shows Sun icon in dark mode', () => {
		mockTheme = 'dark';
		render(<ThemeSwitcher />);
		const button = screen.getByTitle('Switch to light mode');
		expect(button).toBeInTheDocument();
	});

	it('shows Moon icon in light mode', () => {
		mockTheme = 'light';
		render(<ThemeSwitcher />);
		const button = screen.getByTitle('Switch to dark mode');
		expect(button).toBeInTheDocument();
	});

	it('calls toggleTheme on click', () => {
		mockTheme = 'dark';
		render(<ThemeSwitcher />);
		const button = screen.getByTitle('Switch to light mode');
		fireEvent.click(button);
		expect(mockToggleTheme).toHaveBeenCalledTimes(1);
	});
});
