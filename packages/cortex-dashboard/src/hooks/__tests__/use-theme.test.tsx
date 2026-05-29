import { renderHook, act, waitFor } from '@testing-library/react';
import { describe, expect, it, beforeEach, vi } from 'vitest';
import React from 'react';
import {
	ThemeProvider,
	useTheme,
	usePreset,
	PRESET_COOKIE,
	presetClass,
} from '../use-theme';

// Stub matchMedia for next-themes' system detection.
Object.defineProperty(window, 'matchMedia', {
	writable: true,
	value: vi.fn().mockImplementation((query: string) => ({
		matches: false,
		media: query,
		onchange: null,
		addEventListener: vi.fn(),
		removeEventListener: vi.fn(),
		addListener: vi.fn(),
		removeListener: vi.fn(),
		dispatchEvent: vi.fn(),
	})),
});

const wrapper = ({ children }: { children: React.ReactNode }) => (
	<ThemeProvider>{children}</ThemeProvider>
);

describe('useTheme (next-themes wrapper)', () => {
	beforeEach(() => {
		document.documentElement.classList.remove('light', 'dark');
		document.documentElement.classList.add('dark');
	});

	it('exposes theme + setters', async () => {
		const { result } = renderHook(() => useTheme(), { wrapper });
		await waitFor(() => {
			expect(typeof result.current.setTheme).toBe('function');
			expect(typeof result.current.toggleTheme).toBe('function');
		});
	});

	it('setTheme switches the active mode', async () => {
		const { result } = renderHook(() => useTheme(), { wrapper });
		act(() => {
			result.current.setTheme('light');
		});
		await waitFor(() => {
			expect(result.current.theme).toBe('light');
		});
	});

	it('updates document.documentElement class on mode change', async () => {
		const { result } = renderHook(() => useTheme(), { wrapper });
		act(() => {
			result.current.setTheme('light');
		});
		await waitFor(() => {
			expect(document.documentElement.classList.contains('light')).toBe(true);
		});
	});
});

describe('usePreset', () => {
	beforeEach(() => {
		document.documentElement.className = '';
		document.cookie = `${PRESET_COOKIE}=; path=/; max-age=0`;
	});

	it('throws when used outside ThemeProvider', () => {
		expect(() => {
			renderHook(() => usePreset());
		}).toThrow('usePreset must be used within a ThemeProvider');
	});

	it('defaults to the cortex preset', async () => {
		const { result } = renderHook(() => usePreset(), { wrapper });
		await waitFor(() => {
			expect(result.current.preset).toBe('cortex');
			expect(
				document.documentElement.classList.contains(presetClass('cortex')),
			).toBe(true);
		});
	});

	it('setPreset applies the theme-<preset> class and cookie', async () => {
		const { result } = renderHook(() => usePreset(), { wrapper });
		act(() => {
			result.current.setPreset('teal');
		});
		await waitFor(() => {
			expect(result.current.preset).toBe('teal');
			expect(
				document.documentElement.classList.contains(presetClass('teal')),
			).toBe(true);
			expect(
				document.documentElement.classList.contains(presetClass('cortex')),
			).toBe(false);
		});
		expect(document.cookie).toContain(`${PRESET_COOKIE}=teal`);
	});
});
