"use client";

import { useCallback, useEffect, useState } from "react";

/**
 * A generic hook for persisting any JSON-serializable value to localStorage.
 * Falls back to defaultValue when localStorage is empty or unavailable.
 */
export function useLocalStorage<T>(key: string, defaultValue: T): [T, (value: T | ((prev: T) => T)) => void] {
	const [state, setState] = useState<T>(() => {
		if (typeof window === "undefined") return defaultValue;
		try {
			const stored = localStorage.getItem(key);
			return stored ? JSON.parse(stored) : defaultValue;
		} catch {
			return defaultValue;
		}
	});

	useEffect(() => {
		try {
			localStorage.setItem(key, JSON.stringify(state));
		} catch {
			// localStorage full or unavailable
		}
	}, [key, state]);

	const setValue = useCallback((value: T | ((prev: T) => T)) => {
		setState((prev) => {
			const next = typeof value === "function" ? (value as (prev: T) => T)(prev) : value;
			return next;
		});
	}, []);

	return [state, setValue];
}
