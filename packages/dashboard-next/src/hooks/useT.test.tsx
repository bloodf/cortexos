import { describe, it, expect } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { UIProvider, useUI } from "./useUI";
import { useT, useLocale } from "./useT";

const wrapper = ({ children }: { children: React.ReactNode }) => <UIProvider>{children}</UIProvider>;

describe("useT / useLocale", () => {
  it("returns English by default", () => {
    const { result } = renderHook(() => useT(), { wrapper });
    expect(result.current.common.save).toBe("Save");
  });

  it("switches dictionary when locale changes", () => {
    const { result } = renderHook(
      () => ({ ui: useUI(), t: useT(), locale: useLocale() }),
      { wrapper },
    );
    act(() => result.current.ui.setLocale("es"));
    expect(result.current.t.common.save).toBe("Guardar");
    expect(result.current.locale).toBe("es");
    act(() => result.current.ui.setLocale("pt-br"));
    expect(result.current.t.common.save).toBe("Salvar");
  });
});
