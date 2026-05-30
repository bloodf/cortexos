import { renderHook, act, waitFor } from '@testing-library/react';
import { describe, expect, it, beforeEach, vi } from 'vitest';
import { ThemeProvider, useTheme } from '../use-theme';
import React from 'react';

// Mock localStorage
const localStorageMock = (() => {
	let store: Record<string, string> = {};
	return {
		getItem: vi.fn((key: string) => store[key] ?? null),
		setItem: vi.fn((key: string, value: string) => { store[key] = value; }),
		removeItem: vi.fn((key: string) => { delete store[key]; }),
		clear: vi.fn(() => { store = {}; }),
	};
})();

Object.defineProperty(window, 'localStorage', { value: localStorageMock });

const wrapper = ({ children }: { children: React.ReactNode }) => (
	<ThemeProvider>{children}</ThemeProvider>
);

describe('useTheme', () => {
	beforeEach(() => {
		localStorageMock.clear();
		vi.clearAllMocks();
		document.documentElement.classList.remove('light', 'dark');
		document.documentElement.classList.add('dark');
	});

	it('throws when used outside ThemeProvider', () => {
		expect(() => {
			renderHook(() => useTheme());
		}).toThrow('useTheme must be used within a ThemeProvider');
	});

	it('defaults to dark theme', async () => {
		const { result } = renderHook(() => useTheme(), { wrapper });
		await waitFor(() => {
			expect(result.current.theme).toBe('dark');
		});
	});

	it('reads stored theme from localStorage', async () => {
		localStorageMock.setItem('cortex-theme', 'light');
		const { result } = renderHook(() => useTheme(), { wrapper });
		await waitFor(() => {
			expect(result.current.theme).toBe('light');
		});
	});

	it('toggleTheme switches between dark and light', async () => {
		const { result } = renderHook(() => useTheme(), { wrapper });
		await waitFor(() => {
			expect(result.current.theme).toBe('dark');
		});

		act(() => {
			result.current.toggleTheme();
		});
		expect(result.current.theme).toBe('light');

		act(() => {
			result.current.toggleTheme();
		});
		expect(result.current.theme).toBe('dark');
	});

	it('setTheme sets a specific theme', async () => {
		const { result } = renderHook(() => useTheme(), { wrapper });
		await waitFor(() => {
			expect(result.current.theme).toBe('dark');
		});

		act(() => {
			result.current.setTheme('light');
		});
		expect(result.current.theme).toBe('light');

		act(() => {
			result.current.setTheme('dark');
		});
		expect(result.current.theme).toBe('dark');
	});

	it('persists theme changes to localStorage', async () => {
		const { result } = renderHook(() => useTheme(), { wrapper });
		await waitFor(() => {
			expect(result.current.theme).toBeDefined();
		});
		act(() => {
			result.current.setTheme('light');
		});
		expect(localStorageMock.setItem).toHaveBeenCalledWith('cortex-theme', 'light');
	});

	it('updates document.documentElement class', async () => {
		const { result } = renderHook(() => useTheme(), { wrapper });
		await waitFor(() => {
			expect(result.current.theme).toBeDefined();
		});
		act(() => {
			result.current.setTheme('light');
		});
		await waitFor(() => {
			expect(document.documentElement.classList.contains('light')).toBe(true);
			expect(document.documentElement.classList.contains('dark')).toBe(false);
		});
	});

	it('ignores invalid stored values', async () => {
		localStorageMock.setItem('cortex-theme', 'invalid');
		const { result } = renderHook(() => useTheme(), { wrapper });
		await waitFor(() => {
			expect(result.current.theme).toBe('dark');
		});
	});
});
