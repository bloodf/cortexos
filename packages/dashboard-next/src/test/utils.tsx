import type { ReactNode } from "react";
import { QueryClientProvider } from "@tanstack/react-query";
import { makeQueryClient } from "./query-client";

interface ProvidersProps {
  children: ReactNode;
  client?: import("@tanstack/react-query").QueryClient;
}

export function TestProviders({ children, client }: ProvidersProps) {
  const qc = client ?? makeQueryClient();
  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
}
