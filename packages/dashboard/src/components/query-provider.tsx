"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState } from "react";

/**
 * App-wide React Query provider. Many pages and the AppShell (via SimulateMenu)
 * call React Query hooks, so the client must wrap the whole tree — including the
 * unauthenticated /login route, which still renders the AppShell.
 *
 * The client is created lazily in state so a fresh instance is used per request
 * on the server while staying stable across re-renders on the client.
 */
export function QueryProvider({ children }: { children: React.ReactNode }) {
	const [client] = useState(
		() =>
			new QueryClient({
				defaultOptions: {
					queries: {
						staleTime: 30_000,
						refetchOnWindowFocus: false,
					},
				},
			}),
	);

	return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}
