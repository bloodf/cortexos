import { renderHook, act } from '@testing-library/react';
import { describe, expect, it, beforeEach, vi } from 'vitest';
import { useLocalStorage } from '../use-local-storage';

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

describe('useLocalStorage', () => {
	beforeEach(() => {
		localStorageMock.clear();
		vi.clearAllMocks();
	});

	it('returns the default value when localStorage is empty', () => {
		const { result } = renderHook(() => useLocalStorage('test-key', 'default'));
		expect(result.current[0]).toBe('default');
	});

	it('returns stored value from localStorage', () => {
		localStorageMock.setItem('test-key', JSON.stringify('stored'));
		const { result } = renderHook(() => useLocalStorage('test-key', 'default'));
		expect(result.current[0]).toBe('stored');
	});

	it('persists value to localStorage on update', () => {
		const { result } = renderHook(() => useLocalStorage('test-key', 'initial'));
		act(() => {
			result.current[1]('updated');
		});
		expect(result.current[0]).toBe('updated');
		expect(localStorageMock.setItem).toHaveBeenCalledWith('test-key', JSON.stringify('updated'));
	});

	it('supports functional updater', () => {
		const { result } = renderHook(() => useLocalStorage('counter', 0));
		act(() => {
			result.current[1]((prev) => prev + 1);
		});
		expect(result.current[0]).toBe(1);
	});

	it('handles complex objects', () => {
		const defaultVal = { field: 'name', direction: 'asc' };
		const { result } = renderHook(() => useLocalStorage('sort', defaultVal));
		expect(result.current[0]).toEqual(defaultVal);

		act(() => {
			result.current[1]({ field: 'slug', direction: 'desc' });
		});
		expect(result.current[0]).toEqual({ field: 'slug', direction: 'desc' });
	});

	it('handles arrays', () => {
		const { result } = renderHook(() => useLocalStorage('items', [1, 2, 3]));
		expect(result.current[0]).toEqual([1, 2, 3]);
		act(() => {
			result.current[1]((prev) => [...prev, 4]);
		});
		expect(result.current[0]).toEqual([1, 2, 3, 4]);
	});

	it('handles boolean values', () => {
		const { result } = renderHook(() => useLocalStorage('flag', false));
		expect(result.current[0]).toBe(false);
		act(() => {
			result.current[1](true);
		});
		expect(result.current[0]).toBe(true);
	});
});
