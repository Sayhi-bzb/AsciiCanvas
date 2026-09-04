import { act, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";

import { UiProvider } from "./ui-provider.js";
import { useUiTheme } from "./ui-theme.js";

function ThemeProbe() {
  const { resolvedTheme, setTheme } = useUiTheme();
  return (
    <button type="button" onClick={() => setTheme("dark")}>
      {resolvedTheme ?? "pending"}
    </button>
  );
}

describe("UiProvider theme facade", () => {
  beforeEach(() => {
    const values = new Map<string, string>();
    const storage: Storage = {
      get length() { return values.size; },
      clear: () => values.clear(),
      getItem: (key) => values.get(key) ?? null,
      key: (index) => [...values.keys()][index] ?? null,
      removeItem: (key) => { values.delete(key); },
      setItem: (key, value) => { values.set(key, value); },
    };
    Object.defineProperty(window, "localStorage", { configurable: true, value: storage });
    Object.defineProperty(globalThis, "localStorage", { configurable: true, value: storage });
    localStorage.clear();
    document.documentElement.className = "";
  });

  it("defaults to light and exposes theme changes without leaking next-themes", async () => {
    render(
      <UiProvider>
        <ThemeProbe />
      </UiProvider>
    );

    await waitFor(() => expect(screen.getByRole("button")).toHaveTextContent("light"));
    expect(document.documentElement).toHaveClass("light");

    act(() => screen.getByRole("button").click());
    await waitFor(() => expect(screen.getByRole("button")).toHaveTextContent("dark"));
    expect(document.documentElement).toHaveClass("dark");
  });
});
