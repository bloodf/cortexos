/**
 * Test helpers for vitest + @testing-library/react.
 *
 * `renderWithSWR` wraps the rendered tree in a fresh `SWRConfig` so
 * every test starts with an empty cache. Without this, SWR's
 * 2-second dedupe window returns data from a prior test, which
 * makes component tests that stub `global.fetch` flaky.
 *
 * Use it the same way you use `render`:
 *
 *   renderWithSWR(<MyComponent serviceId={1} />);
 */
import * as React from 'react';
import { render, type RenderOptions, type RenderResult } from '@testing-library/react';
import { SWRConfig } from 'swr';

export function renderWithSWR(
	ui: React.ReactElement,
	options?: Omit<RenderOptions, 'wrapper'>,
): RenderResult {
	return render(ui, {
		...options,
		wrapper: ({ children }) => (
			<SWRConfig value={{ dedupingInterval: 0, provider: () => new Map() }}>
				{children}
			</SWRConfig>
		),
	});
}
