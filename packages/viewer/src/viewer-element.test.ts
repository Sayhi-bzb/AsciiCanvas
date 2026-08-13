import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import {
  CharDeskViewerElement,
  defineCharDeskViewer,
} from "./viewer-element.js";

beforeAll(() => {
  defineCharDeskViewer();
});

afterEach(() => {
  document.body.replaceChildren();
  vi.restoreAllMocks();
});

const mountViewer = (source?: string) => {
  const viewer = document.createElement("chardesk-viewer") as CharDeskViewerElement;
  if (source !== undefined) viewer.source = source;
  document.body.append(viewer);
  return viewer;
};

const getRenderedDocument = (viewer: CharDeskViewerElement) =>
  viewer.shadowRoot?.querySelector("pre[part='document']") as HTMLPreElement;

const getViewport = (viewer: CharDeskViewerElement) =>
  viewer.shadowRoot?.querySelector("[part='viewport']") as HTMLDivElement;

describe("CharDeskViewerElement", () => {
  it("upgrades declarative fallback without changing its source", () => {
    const viewer = document.createElement("chardesk-viewer") as CharDeskViewerElement;
    const fallback = document.createElement("pre");
    fallback.dataset.chardeskSource = "";
    fallback.textContent = "┌─┐\n│A│\n└─┘";
    viewer.append(fallback);
    document.body.append(viewer);

    expect(viewer.source).toBe("┌─┐\n│A│\n└─┘");
    expect(getRenderedDocument(viewer).textContent).toBe(viewer.source);
    expect(fallback.textContent).toBe(viewer.source);
    expect(viewer.parsedDocument).toMatchObject({ width: 3, height: 3 });
  });

  it("renders ANSI as presentation while keeping copyable Unicode text", () => {
    const viewer = mountViewer("[31mRED[0m plain");
    const rendered = getRenderedDocument(viewer);
    const styled = rendered.querySelector(".run") as HTMLSpanElement;

    expect(rendered.textContent).toBe("RED plain");
    expect(styled.textContent).toBe("RED");
    expect(styled.style.getPropertyValue("--run-fg")).toBe("#800000");
    expect(viewer.parsedDocument?.source).toBe("[31mRED[0m plain");
  });

  it("treats source HTML as text rather than DOM", () => {
    const viewer = mountViewer('<img src=x onerror="alert(1)">');
    const rendered = getRenderedDocument(viewer);

    expect(rendered.textContent).toBe('<img src=x onerror="alert(1)">');
    expect(rendered.querySelector("img")).toBeNull();
  });

  it("renders safe links and degrades unsafe links to styled text", () => {
    const safe =
      "\u001b]8;;https://chardesk.com\u001b\\site\u001b]8;;\u001b\\";
    const unsafe =
      "\u001b]8;;javascript:alert(1)\u001b\\unsafe\u001b]8;;\u001b\\";
    const viewer = mountViewer(`${safe} ${unsafe}`);
    const rendered = getRenderedDocument(viewer);

    expect(rendered.querySelectorAll("a")).toHaveLength(1);
    expect(rendered.querySelector("a")?.getAttribute("href")).toBe(
      "https://chardesk.com"
    );
    expect(rendered.textContent).toBe("site unsafe");
  });

  it("copies plain text and exact source independently", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText },
    });
    const viewer = mountViewer("[1mBold[0m");

    await viewer.copyPlainText();
    await viewer.copySource();

    expect(writeText).toHaveBeenNthCalledWith(1, "Bold");
    expect(writeText).toHaveBeenNthCalledWith(2, "[1mBold[0m");
  });

  it("clamps manual zoom and disables automatic fitting", () => {
    const viewer = mountViewer("A");
    viewer.zoom = 100;
    expect(viewer.zoom).toBe(4);
    expect(viewer.fit).toBe("none");

    viewer.zoom = 0.01;
    expect(viewer.zoom).toBe(0.25);
    expect(
      (viewer.shadowRoot?.querySelector(".surface") as HTMLDivElement).style
        .transform
    ).toBe("scale(0.25)");
  });

  it("can hide its controls without changing the document", () => {
    const viewer = mountViewer("content");
    viewer.controls = false;

    const toolbar = viewer.shadowRoot?.querySelector("[part='toolbar']");
    expect(toolbar?.hasAttribute("hidden")).toBe(true);
    expect(getRenderedDocument(viewer).textContent).toBe("content");
  });

  it("exposes compact accessible controls through stable parts", () => {
    const viewer = mountViewer("content");
    const toolbar = viewer.shadowRoot?.querySelector(
      "[part='toolbar']"
    ) as HTMLDivElement;
    const controls = [...toolbar.querySelectorAll("button")];

    expect(toolbar.getAttribute("role")).toBe("toolbar");
    expect(toolbar.getAttribute("aria-label")).toBe("Viewer controls");
    expect(controls.map((control) => control.getAttribute("aria-label"))).toEqual([
      "Zoom out",
      "Zoom in",
      "Fit document",
      "Copy plain text",
      "Copy source",
    ]);
    for (const control of controls) {
      expect(control.getAttribute("part")).toContain("control");
      expect(control.querySelector("svg[aria-hidden='true']")).not.toBeNull();
      expect(control.textContent).toBe("");
    }
    expect(viewer.shadowRoot?.querySelector("[part='surface']")).not.toBeNull();
    expect(viewer.shadowRoot?.querySelector("[part='zoom-controls']")).not.toBeNull();
    expect(viewer.shadowRoot?.querySelector("[part='copy-controls']")).not.toBeNull();
    expect(viewer.shadowRoot?.querySelector("[part='zoom-value']")).toBeNull();
    expect(viewer.shadowRoot?.querySelector("[part='coordinate']")).toBeNull();
    expect(viewer.shadowRoot?.querySelector("[part~='copy-selection']")).toBeNull();
  });

  it("keeps visible and programmatic copy actions independent", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText },
    });
    const viewer = mountViewer("[1mAB[0m");
    viewer.setSelection({ x: 0, y: 0 }, { x: 0, y: 0 });
    const click = (part: string) =>
      (viewer.shadowRoot?.querySelector(`[part~='${part}']`) as HTMLButtonElement)
        .click();

    await viewer.copySelection();
    click("copy-text");
    click("copy-source");
    await Promise.resolve();

    expect(writeText).toHaveBeenNthCalledWith(1, "A");
    expect(writeText).toHaveBeenNthCalledWith(2, "AB");
    expect(writeText).toHaveBeenNthCalledWith(3, "[1mAB[0m");
  });

  it("updates parsing when source or syntax changes", () => {
    const viewer = mountViewer("[31mR[0m");
    viewer.syntax = "plain";
    expect(getRenderedDocument(viewer).textContent).toBe("[31mR[0m");

    viewer.source = "next";
    expect(getRenderedDocument(viewer).textContent).toBe("next");
  });

  it("fits the document width using its natural DOM measurements", () => {
    const viewer = mountViewer("content");
    const rendered = getRenderedDocument(viewer);
    const viewport = getViewport(viewer);
    Object.defineProperties(rendered, {
      scrollWidth: { configurable: true, value: 400 },
      scrollHeight: { configurable: true, value: 200 },
    });
    Object.defineProperties(viewport, {
      clientWidth: { configurable: true, value: 200 },
      clientHeight: { configurable: true, value: 300 },
    });

    viewer.fitToViewport("width");

    expect(viewer.zoom).toBe(0.5);
    expect(viewer.fit).toBe("width");
    expect(
      (viewer.shadowRoot?.querySelector(".surface") as HTMLDivElement).style
        .transform
    ).toBe("scale(0.5)");
    expect(
      viewport.style.getPropertyValue("--chardesk-auto-viewport-height")
    ).toBe("100px");
  });

  it("centers a scaled document that is narrower than the viewport", () => {
    const viewer = mountViewer("A");
    const rendered = getRenderedDocument(viewer);
    const viewport = getViewport(viewer);
    const surface = viewer.shadowRoot?.querySelector(".surface") as HTMLDivElement;
    Object.defineProperty(rendered, "scrollWidth", {
      configurable: true,
      value: 100,
    });
    Object.defineProperty(viewport, "clientWidth", {
      configurable: true,
      value: 400,
    });

    viewer.zoom = 1;

    expect(surface.style.left).toBe("150px");
  });

  it("keeps the viewport height stable during manual zoom", () => {
    const viewer = mountViewer("content");
    const rendered = getRenderedDocument(viewer);
    const viewport = getViewport(viewer);
    const stage = viewer.shadowRoot?.querySelector("[part='stage']") as HTMLDivElement;
    Object.defineProperties(rendered, {
      scrollWidth: { configurable: true, value: 400 },
      scrollHeight: { configurable: true, value: 200 },
    });
    Object.defineProperties(viewport, {
      clientWidth: { configurable: true, value: 200 },
      clientHeight: { configurable: true, value: 100 },
    });
    viewer.fitToViewport("width");
    const fittedHeight = viewport.style.getPropertyValue(
      "--chardesk-auto-viewport-height"
    );

    viewer.zoom = 1;

    expect(fittedHeight).toBe("100px");
    expect(
      viewport.style.getPropertyValue("--chardesk-auto-viewport-height")
    ).toBe(fittedHeight);
    expect(stage.style.height).toBe("200px");
  });

  it("uses declarative initial zoom when establishing frame height", async () => {
    const viewer = document.createElement(
      "chardesk-viewer"
    ) as CharDeskViewerElement;
    viewer.setAttribute("fit", "none");
    viewer.setAttribute("zoom", "2");
    viewer.source = "content";
    const rendered = getRenderedDocument(viewer);
    Object.defineProperty(rendered, "scrollHeight", {
      configurable: true,
      value: 120,
    });

    document.body.append(viewer);
    await Promise.resolve();

    expect(
      getViewport(viewer).style.getPropertyValue(
        "--chardesk-auto-viewport-height"
      )
    ).toBe("240px");
  });

  it("exposes observable grid cursor and rectangular selection state", () => {
    const viewer = mountViewer("abc\ndef");
    const cursorEvents = vi.fn();
    const selectionEvents = vi.fn();
    viewer.addEventListener("chardesk-cursor-change", cursorEvents);
    viewer.addEventListener("chardesk-selection-change", selectionEvents);

    viewer.setCursor({ x: 1, y: 0 });
    viewer.setSelection({ x: 1, y: 0 }, { x: 2, y: 1 });

    expect(viewer.cursor).toEqual({ x: 2, y: 1 });
    expect(viewer.selection).toEqual({
      anchor: { x: 1, y: 0 },
      focus: { x: 2, y: 1 },
      rect: { left: 1, top: 0, right: 2, bottom: 1 },
    });
    expect(cursorEvents).toHaveBeenCalledTimes(2);
    expect(selectionEvents).toHaveBeenCalledTimes(1);

    viewer.clearSelection();
    expect(viewer.selection).toBeNull();
    expect(selectionEvents).toHaveBeenCalledTimes(2);
  });

  it("navigates and extends grid selection with the keyboard", () => {
    const viewer = mountViewer("A界B\n1234");
    const viewport = getViewport(viewer);
    viewer.setCursor({ x: 1, y: 0 });

    viewport.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowRight" }));
    expect(viewer.cursor).toEqual({ x: 3, y: 0 });

    viewport.dispatchEvent(
      new KeyboardEvent("keydown", { key: "ArrowDown", shiftKey: true })
    );
    expect(viewer.selection?.rect).toEqual({
      left: 3,
      top: 0,
      right: 3,
      bottom: 1,
    });
  });

  it("copies a grid selection without replacing native copy methods", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText },
    });
    const viewer = mountViewer("A\n  C");
    viewer.setSelection({ x: 0, y: 0 }, { x: 2, y: 1 });

    await viewer.copySelection();

    expect(writeText).toHaveBeenCalledWith("A  \n  C");
  });

  it("clears stale selection and clamps the cursor when source changes", () => {
    const viewer = mountViewer("abcd\nefgh");
    viewer.setSelection({ x: 1, y: 0 }, { x: 3, y: 1 });
    viewer.source = "x";

    expect(viewer.selection).toBeNull();
    expect(viewer.cursor).toEqual({ x: 0, y: 0 });
  });

  it("can opt out of grid interaction", () => {
    const viewer = mountViewer("abc");
    expect(getViewport(viewer).hasAttribute("data-grid-interaction")).toBe(true);
    viewer.setCursor({ x: 1, y: 0 });
    viewer.interaction = "text";

    expect(viewer.cursor).toBeNull();
    expect(getViewport(viewer).tabIndex).toBe(-1);
    expect(getViewport(viewer).hasAttribute("data-grid-interaction")).toBe(false);
  });
});
