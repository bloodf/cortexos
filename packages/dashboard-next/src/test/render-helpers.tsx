import type { ReactElement } from "react";
import { render, type RenderOptions } from "@testing-library/react";
import { TestProviders } from "./utils";

export function renderWithProviders(
  ui: ReactElement,
  options: RenderOptions & { client?: import("@tanstack/react-query").QueryClient } = {},
) {
  const { client, ...rest } = options;
  return render(ui, {
    wrapper: ({ children }) => <TestProviders client={client}>{children}</TestProviders>,
    ...rest,
  });
}
