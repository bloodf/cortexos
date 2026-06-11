import type { ReactElement } from "react";
// eslint-disable-next-line import-x/no-extraneous-dependencies
import { render, type RenderOptions } from "@testing-library/react";
import type { QueryClient } from "@tanstack/react-query";
import TestProviders from "./utils";

export default function renderWithProviders(
  ui: ReactElement,
  options: RenderOptions & { client?: QueryClient } = {},
) {
  const { client, ...rest } = options;
  return render(ui, {
    wrapper: ({ children }) => <TestProviders client={client}>{children}</TestProviders>,
    ...rest,
  });
}
