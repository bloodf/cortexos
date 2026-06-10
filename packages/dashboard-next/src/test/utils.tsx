import type { ReactElement, ReactNode } from "react";
import { render, type RenderOptions } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

export function makeQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0, staleTime: Infinity, refetchOnWindowFocus: false },
      mutations: { retry: false },
    },
  });
}

interface ProvidersProps {
  children: ReactNode;
  client?: QueryClient;
}

export function TestProviders({ children, client }: ProvidersProps) {
  const qc = client ?? makeQueryClient();
  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
}

export function renderWithProviders(
  ui: ReactElement,
  options: RenderOptions & { client?: QueryClient } = {},
) {
  const { client, ...rest } = options;
  return render(ui, {
    wrapper: ({ children }) => <TestProviders client={client}>{children}</TestProviders>,
    ...rest,
  });
}

export * from "@testing-library/react";
