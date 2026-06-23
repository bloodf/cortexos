import { describe, it, expect, vi, afterEach } from "vitest";
import { render } from "@testing-library/react";

import { TooltipProvider } from "@/components/ui/tooltip";
import { PromptInputButton } from "@/components/ai-elements/prompt-input";

/**
 * Regression guard for the SSR 500 "`Tooltip` must be used within
 * `TooltipProvider`". The ai-elements PromptInput renders a Tooltip with no
 * provider of its own, so the app root MUST supply a global TooltipProvider
 * (see src/routes/__root.tsx). These tests pin both halves of that contract.
 */
describe("PromptInputButton tooltip / provider contract", () => {
  afterEach(() => vi.restoreAllMocks());

  it("throws without a TooltipProvider ancestor (reproduces the bug)", () => {
    // React logs the render error loudly — silence it for a clean run.
    vi.spyOn(console, "error").mockImplementation(() => {});
    expect(() => render(<PromptInputButton tooltip="Attach files">x</PromptInputButton>)).toThrow(
      /TooltipProvider/,
    );
  });

  it("renders within a TooltipProvider (the root fix)", () => {
    const { getByText } = render(
      <TooltipProvider>
        <PromptInputButton tooltip="Attach files">x</PromptInputButton>
      </TooltipProvider>,
    );
    expect(getByText("x")).toBeTruthy();
  });
});
