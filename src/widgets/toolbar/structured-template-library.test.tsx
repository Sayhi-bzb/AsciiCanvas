import { act, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { STRUCTURED_COMPONENT_TEMPLATES } from "@/domains/structured-content/public";
import { StructuredTemplateLibrary } from "./structured-template-library";

describe("StructuredTemplateLibrary", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("defers a template preview until its viewport is near the visible area", () => {
    const callbacks: IntersectionObserverCallback[] = [];
    const options: IntersectionObserverInit[] = [];
    class IntersectionObserverMock {
      constructor(
        callback: IntersectionObserverCallback,
        init?: IntersectionObserverInit
      ) {
        callbacks.push(callback);
        options.push(init ?? {});
      }
      observe() {}
      unobserve() {}
      disconnect() {}
      takeRecords() {
        return [];
      }
      root = null;
      rootMargin = "";
      thresholds = [];
    }
    vi.stubGlobal("IntersectionObserver", IntersectionObserverMock);

    const { container } = render(
      <StructuredTemplateLibrary templates={[STRUCTURED_COMPONENT_TEMPLATES[0]]} />
    );

    expect(
      screen.getByTestId("structured-template-preview-lazy-host")
    ).toBeInTheDocument();
    expect(
      container.querySelector('[data-testid="structured-template-preview-grid"]')
    ).not.toBeInTheDocument();
    expect(options[0]).toMatchObject({ rootMargin: "160px 0px" });

    act(() => {
      callbacks[0]([{ isIntersecting: true } as IntersectionObserverEntry], {} as IntersectionObserver);
    });

    expect(
      container.querySelector('[data-testid="structured-template-preview-grid"]')
    ).toBeInTheDocument();
  });
});
