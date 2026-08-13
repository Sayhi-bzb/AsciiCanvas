import { CHARDESK_TEXT_FONT_FAMILY } from "@chardesk/fonts";
import type {
  CharDeskTextSyntax,
  ParsedCharDeskText,
} from "@chardesk/protocol";
import { sanitizeCharDeskHref } from "./link.js";
import { calculateCharDeskFitZoom } from "./fit.js";
import {
  createCharDeskViewerIcon,
  type CharDeskViewerIcon,
} from "./icons.js";
import {
  createCharDeskGridIndex,
  createCharDeskGridSelection,
  getCharDeskGridCell,
  getCharDeskGridSelectionText,
  hasCharDeskGrid,
  hitTestCharDeskGridPoint,
  moveCharDeskGridPoint,
  normalizeCharDeskGridPoint,
  type CharDeskGridIndex,
  type CharDeskGridPoint,
  type CharDeskGridSelection,
} from "./grid-interaction.js";
import {
  createCharDeskRenderModel,
  type CharDeskRenderRun,
} from "./render-model.js";

export type CharDeskViewerFit = "none" | "width" | "contain";
export type CharDeskViewerCopyFormat = "plain" | "source" | "selection";
export type CharDeskViewerInteraction = "text" | "grid";

const MIN_ZOOM = 0.25;
const MAX_ZOOM = 4;
const ZOOM_STEP = 0.1;
const SELECTION_DRAG_THRESHOLD = 4;
const DEFAULT_FIT: CharDeskViewerFit = "width";

const HTMLElementBase = (globalThis.HTMLElement ?? class {}) as typeof HTMLElement;

const clampZoom = (value: number) =>
  Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, value));

const normalizeFit = (value: string | null): CharDeskViewerFit =>
  value === "none" || value === "contain" || value === "width"
    ? value
    : DEFAULT_FIT;

const normalizeSyntax = (value: string | null): CharDeskTextSyntax =>
  value === "plain" || value === "ansi" || value === "auto"
    ? value
    : "auto";

const normalizeInteraction = (value: string | null): CharDeskViewerInteraction =>
  value === "text" ? "text" : "grid";

const styles = `
  :host {
    --chardesk-font-family: ${CHARDESK_TEXT_FONT_FAMILY};
    --chardesk-font-size: 15px;
    --chardesk-fit-max-font-size: 20px;
    --chardesk-line-height: 1.28;
    --chardesk-color: light-dark(#111827, #e5e7eb);
    --chardesk-background: light-dark(#ffffff, #111318);
    --chardesk-border-color: color-mix(in srgb, currentColor 16%, transparent);
    --chardesk-control-color: color-mix(in srgb, var(--chardesk-color) 72%, transparent);
    --chardesk-control-hover-background: color-mix(in srgb, var(--chardesk-color) 10%, transparent);
    --chardesk-control-hover-color: var(--chardesk-color);
    --chardesk-focus-ring: color-mix(in srgb, #2563eb 70%, transparent);
    --chardesk-radius: 8px;
    --chardesk-grid-cursor: color-mix(in srgb, #2563eb 84%, currentColor);
    --chardesk-grid-selection: color-mix(in srgb, #2563eb 24%, transparent);
    display: block;
    min-width: 0;
    color-scheme: light dark;
    container-type: inline-size;
    color: var(--chardesk-color);
  }

  * { box-sizing: border-box; }

  .root {
    position: relative;
    isolation: isolate;
    overflow: hidden;
    border: 1px solid var(--chardesk-border-color);
    border-radius: var(--chardesk-radius);
    background: var(--chardesk-background);
  }

  .toolbar {
    position: absolute;
    z-index: 4;
    inset: 0;
    color: var(--chardesk-control-color);
    font: 12px/1.2 ui-sans-serif, system-ui, sans-serif;
    opacity: 0;
    pointer-events: none;
    transition: opacity 120ms ease;
  }

  .toolbar[hidden] { display: none; }

  .control-group {
    position: absolute;
    display: flex;
    align-items: center;
    gap: 4px;
    pointer-events: none;
    transition: transform 120ms ease;
  }

  .zoom-controls {
    bottom: 8px;
    left: 8px;
    transform: translateY(4px);
  }

  .copy-controls {
    top: 8px;
    right: 8px;
    transform: translateY(-4px);
  }

  .root:hover .toolbar,
  .root:focus-within .toolbar {
    opacity: 1;
  }

  .root:hover .control-group,
  .root:focus-within .control-group {
    transform: translateY(0);
    pointer-events: auto;
  }

  button {
    display: inline-flex;
    width: 32px;
    height: 32px;
    flex: 0 0 32px;
    align-items: center;
    justify-content: center;
    padding: 0;
    border: 0;
    border-radius: var(--chardesk-radius);
    color: inherit;
    background: transparent;
    font: inherit;
    cursor: pointer;
  }

  button svg { width: 16px; height: 16px; }

  button:hover, button:focus-visible {
    color: var(--chardesk-control-hover-color);
    background: var(--chardesk-control-hover-background);
  }

  button:focus-visible {
    outline: 3px solid var(--chardesk-focus-ring);
    outline-offset: -3px;
  }

  button:disabled { cursor: default; opacity: 0.45; }

  .viewport {
    position: relative;
    overflow: auto;
    max-width: 100%;
    height: var(
      --chardesk-viewport-height,
      var(--chardesk-auto-viewport-height, auto)
    );
    background: var(--chardesk-background);
  }

  .viewport:focus-visible {
    outline: 3px solid var(--chardesk-focus-ring);
    outline-offset: -3px;
  }

  .stage {
    position: relative;
    min-width: 100%;
    min-height: 1px;
  }

  .surface {
    position: absolute;
    inset: 0 auto auto 0;
    transform-origin: top left;
  }

  pre, .measure {
    font-family: var(--chardesk-font-family);
    font-size: var(--chardesk-font-size);
    font-variant-ligatures: none;
    font-feature-settings: "liga" 0, "calt" 0;
    line-height: var(--chardesk-line-height);
    white-space: pre;
    tab-size: 4;
  }

  pre {
    position: relative;
    margin: 0;
    padding: 16px;
    width: max-content;
    min-width: max-content;
    color: var(--chardesk-color);
    background: var(--chardesk-background);
    cursor: default;
    user-select: text;
  }

  .viewport[data-grid-interaction] pre {
    user-select: none;
    -webkit-user-select: none;
  }

  .measure, .fit-font-measure {
    position: absolute;
    visibility: hidden;
    pointer-events: none;
  }

  .fit-font-measure {
    font-size: var(--chardesk-fit-max-font-size);
    line-height: 1;
  }

  .interaction-layer {
    position: absolute;
    inset: 0;
    pointer-events: none;
  }

  .grid-cursor, .grid-selection {
    position: absolute;
    display: none;
  }

  .grid-selection { background: var(--chardesk-grid-selection); }
  .grid-cursor {
    box-shadow: inset 0 0 0 1px var(--chardesk-grid-cursor);
    opacity: 0.45;
  }

  .viewport:focus-within .grid-cursor { opacity: 1; }

  .run {
    color: var(--run-fg, var(--chardesk-color));
    background: var(--run-bg, transparent);
  }

  .run.inverse {
    color: var(--run-bg, var(--chardesk-background));
    background: var(--run-fg, var(--chardesk-color));
  }

  .bold { font-weight: 700; }
  .italic { font-style: italic; }
  .underline { text-decoration-line: underline; }
  .strike { text-decoration-line: line-through; }
  .underline.strike { text-decoration-line: underline line-through; }

  a { cursor: pointer; text-underline-offset: 0.16em; }
  .status { position: absolute; width: 1px; height: 1px; overflow: hidden; clip-path: inset(50%); }

  @media (hover: none), (pointer: coarse) {
    .toolbar {
      opacity: 1;
    }

    .control-group {
      transform: translateY(0);
      pointer-events: auto;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .toolbar, .control-group { transition: none; }
  }
`;

const createButton = (
  label: string,
  icon: CharDeskViewerIcon,
  part: string
) => {
  const button = document.createElement("button");
  button.type = "button";
  button.title = label;
  button.setAttribute("aria-label", label);
  button.setAttribute("part", `control ${part}`);
  button.append(createCharDeskViewerIcon(icon));
  return button;
};

const appendRun = (parent: HTMLElement, run: CharDeskRenderRun) => {
  const href = run.href ? sanitizeCharDeskHref(run.href) : null;
  const hasPresentation =
    !!run.color || !!run.bgColor || !!run.attrs || !!href;
  if (!hasPresentation) {
    parent.append(document.createTextNode(run.text));
    return;
  }

  const element = href
    ? document.createElement("a")
    : document.createElement("span");
  element.classList.add("run");
  if (href && element instanceof HTMLAnchorElement) element.href = href;
  if (run.color) element.style.setProperty("--run-fg", run.color);
  if (run.bgColor) element.style.setProperty("--run-bg", run.bgColor);
  if (run.attrs?.bold) element.classList.add("bold");
  if (run.attrs?.italic) element.classList.add("italic");
  if (run.attrs?.underline) element.classList.add("underline");
  if (run.attrs?.strike) element.classList.add("strike");
  if (run.attrs?.inverse) element.classList.add("inverse");
  element.textContent = run.text;
  parent.append(element);
};

export class CharDeskViewerElement extends HTMLElementBase {
  static observedAttributes = [
    "aria-label",
    "controls",
    "fit",
    "interaction",
    "syntax",
    "zoom",
  ];

  readonly #root: HTMLDivElement;
  readonly #toolbar: HTMLDivElement;
  readonly #viewport: HTMLDivElement;
  readonly #stage: HTMLDivElement;
  readonly #surface: HTMLDivElement;
  readonly #documentElement: HTMLPreElement;
  readonly #measure: HTMLSpanElement;
  readonly #fitFontMeasure: HTMLSpanElement;
  readonly #cursorElement: HTMLDivElement;
  readonly #selectionElement: HTMLDivElement;
  readonly #status: HTMLSpanElement;
  readonly #resizeObserver: ResizeObserver | null;
  #mutationObserver: MutationObserver | null = null;
  #source = "";
  #hasExplicitSource = false;
  #parsedDocument: ParsedCharDeskText | null = null;
  #gridIndex: CharDeskGridIndex | null = null;
  #cursor: CharDeskGridPoint | null = null;
  #selection: CharDeskGridSelection | null = null;
  #cellWidth = 0;
  #cellHeight = 0;
  #selectionPointerId: number | null = null;
  #pointerAnchor: CharDeskGridPoint | null = null;
  #pointerStart: CharDeskGridPoint | null = null;
  #selectionGestureActive = false;
  #suppressClick = false;
  #zoom = 1;
  #fit: CharDeskViewerFit = DEFAULT_FIT;
  #suppressFitLayout = false;
  #statusTimer: ReturnType<typeof setTimeout> | null = null;

  constructor() {
    super();
    const shadow = this.attachShadow({ mode: "open" });
    const style = document.createElement("style");
    style.textContent = styles;

    this.#root = document.createElement("div");
    this.#root.className = "root";
    this.#root.setAttribute("part", "root");

    this.#toolbar = document.createElement("div");
    this.#toolbar.className = "toolbar";
    this.#toolbar.setAttribute("part", "toolbar");
    this.#toolbar.setAttribute("role", "toolbar");
    this.#toolbar.setAttribute("aria-label", "Viewer controls");
    const zoomOut = createButton("Zoom out", "zoom-out", "zoom-out");
    const zoomIn = createButton("Zoom in", "zoom-in", "zoom-in");
    const fit = createButton("Fit document", "fit", "fit");
    const copyText = createButton("Copy plain text", "copy-text", "copy-text");
    const copySource = createButton("Copy source", "copy-source", "copy-source");
    const zoomControls = document.createElement("div");
    zoomControls.className = "control-group zoom-controls";
    zoomControls.setAttribute("part", "zoom-controls");
    zoomControls.append(zoomOut, zoomIn, fit);
    const copyControls = document.createElement("div");
    copyControls.className = "control-group copy-controls";
    copyControls.setAttribute("part", "copy-controls");
    copyControls.append(copyText, copySource);
    this.#toolbar.append(zoomControls, copyControls);

    this.#viewport = document.createElement("div");
    this.#viewport.className = "viewport";
    this.#viewport.setAttribute("part", "viewport");
    this.#viewport.setAttribute("role", "region");
    this.#stage = document.createElement("div");
    this.#stage.className = "stage";
    this.#stage.setAttribute("part", "stage");
    this.#surface = document.createElement("div");
    this.#surface.className = "surface";
    this.#surface.setAttribute("part", "surface");
    this.#documentElement = document.createElement("pre");
    this.#documentElement.setAttribute("part", "document");
    const interactionLayer = document.createElement("div");
    interactionLayer.className = "interaction-layer";
    interactionLayer.setAttribute("part", "interaction-layer");
    this.#selectionElement = document.createElement("div");
    this.#selectionElement.className = "grid-selection";
    this.#selectionElement.setAttribute("part", "selection");
    this.#cursorElement = document.createElement("div");
    this.#cursorElement.className = "grid-cursor";
    this.#cursorElement.setAttribute("part", "cursor");
    interactionLayer.append(
      this.#selectionElement,
      this.#cursorElement
    );
    this.#surface.append(this.#documentElement, interactionLayer);
    this.#measure = document.createElement("span");
    this.#measure.className = "measure";
    this.#measure.textContent = "0000000000";
    this.#fitFontMeasure = document.createElement("span");
    this.#fitFontMeasure.className = "fit-font-measure";
    this.#fitFontMeasure.textContent = "M";
    this.#stage.append(this.#surface, this.#measure, this.#fitFontMeasure);
    this.#viewport.append(this.#stage);

    this.#status = document.createElement("span");
    this.#status.className = "status";
    this.#status.setAttribute("role", "status");
    this.#status.setAttribute("aria-live", "polite");
    this.#root.append(this.#toolbar, this.#viewport, this.#status);
    shadow.append(style, this.#root);

    zoomOut.addEventListener("click", () => this.#setManualZoom(this.#zoom - ZOOM_STEP));
    zoomIn.addEventListener("click", () => this.#setManualZoom(this.#zoom + ZOOM_STEP));
    fit.addEventListener("click", () => this.fitToViewport());
    copyText.addEventListener("click", () => void this.copyPlainText());
    copySource.addEventListener("click", () => void this.copySource());
    this.#viewport.addEventListener("pointerdown", this.#handlePointerDown);
    this.#viewport.addEventListener("pointermove", this.#handlePointerMove);
    this.#viewport.addEventListener("pointerup", this.#handlePointerUp);
    this.#viewport.addEventListener("pointercancel", this.#handlePointerUp);
    this.#viewport.addEventListener("click", this.#handleClick);
    this.#viewport.addEventListener("keydown", this.#handleKeyDown);

    this.#resizeObserver =
      typeof ResizeObserver === "undefined"
        ? null
        : new ResizeObserver(() => {
            if (this.#fit !== "none") this.fitToViewport(this.#fit);
            else this.#updateStageSize();
          });
  }

  connectedCallback() {
    this.#fit = normalizeFit(this.getAttribute("fit"));
    const attributeZoom = Number(this.getAttribute("zoom"));
    if (Number.isFinite(attributeZoom) && attributeZoom > 0) {
      this.#zoom = clampZoom(attributeZoom);
    }
    if (!this.#hasExplicitSource) this.#source = this.#readFallbackSource();
    this.#syncAttributes();
    this.#render();
    this.#resizeObserver?.observe(this.#viewport);
    this.#mutationObserver = new MutationObserver(() => {
      if (this.#hasExplicitSource) return;
      const source = this.#readFallbackSource();
      if (source === this.#source) return;
      this.#source = source;
      this.#render();
    });
    this.#mutationObserver.observe(this, {
      childList: true,
      characterData: true,
      subtree: true,
    });
    void document.fonts?.ready.then(() => this.#scheduleLayout());
  }

  disconnectedCallback() {
    this.#resizeObserver?.disconnect();
    this.#mutationObserver?.disconnect();
    this.#mutationObserver = null;
    if (this.#statusTimer) clearTimeout(this.#statusTimer);
  }

  attributeChangedCallback(name: string) {
    if (!this.shadowRoot) return;
    if (name === "syntax") this.#render();
    if (name === "fit") {
      this.#fit = normalizeFit(this.getAttribute("fit"));
      if (!this.#suppressFitLayout) this.#scheduleLayout();
    }
    if (name === "zoom") {
      const value = Number(this.getAttribute("zoom"));
      if (Number.isFinite(value) && value > 0) this.#applyZoom(value);
    }
    if (name === "interaction" && this.interaction === "text") {
      this.#resetPointerGesture();
      this.clearSelection();
      this.setCursor(null);
    }
    this.#syncAttributes();
  }

  get source() {
    return this.#source;
  }

  set source(value: string) {
    this.#hasExplicitSource = true;
    this.#source = String(value);
    this.#render();
  }

  get syntax(): CharDeskTextSyntax {
    return normalizeSyntax(this.getAttribute("syntax"));
  }

  set syntax(value: CharDeskTextSyntax) {
    this.setAttribute("syntax", value);
  }

  get controls() {
    return this.getAttribute("controls") !== "false";
  }

  set controls(value: boolean) {
    this.setAttribute("controls", value ? "true" : "false");
  }

  get interaction(): CharDeskViewerInteraction {
    return normalizeInteraction(this.getAttribute("interaction"));
  }

  set interaction(value: CharDeskViewerInteraction) {
    this.setAttribute("interaction", normalizeInteraction(value));
  }

  get fit(): CharDeskViewerFit {
    return this.#fit;
  }

  set fit(value: CharDeskViewerFit) {
    this.setAttribute("fit", normalizeFit(value));
  }

  get zoom() {
    return this.#zoom;
  }

  set zoom(value: number) {
    this.#setManualZoom(value);
  }

  get parsedDocument(): ParsedCharDeskText | null {
    return this.#parsedDocument;
  }

  get cursor(): CharDeskGridPoint | null {
    return this.#cursor ? { ...this.#cursor } : null;
  }

  get selection(): CharDeskGridSelection | null {
    return this.#selection
      ? {
          anchor: { ...this.#selection.anchor },
          focus: { ...this.#selection.focus },
          rect: { ...this.#selection.rect },
        }
      : null;
  }

  setCursor(point: CharDeskGridPoint | null) {
    const next = point && this.#gridIndex
      ? normalizeCharDeskGridPoint(this.#gridIndex, point)
      : null;
    if (next?.x === this.#cursor?.x && next?.y === this.#cursor?.y) return;
    this.#cursor = next;
    this.#updateGridOverlay();
    this.#emitCursorChange();
  }

  setSelection(anchor: CharDeskGridPoint, focus: CharDeskGridPoint) {
    const next = this.#gridIndex
      ? createCharDeskGridSelection(this.#gridIndex, anchor, focus)
      : null;
    this.#selection = next;
    if (next) this.setCursor(next.focus);
    this.#updateGridOverlay();
    this.#emitSelectionChange();
  }

  clearSelection() {
    if (!this.#selection) return;
    this.#selection = null;
    this.#updateGridOverlay();
    this.#emitSelectionChange();
  }

  resetZoom() {
    this.#setManualZoom(1);
  }

  fitToViewport(mode: CharDeskViewerFit = this.#fit === "none" ? "width" : this.#fit) {
    const fitMode = mode === "contain" ? "contain" : "width";
    const naturalWidth = this.#documentElement.scrollWidth;
    const naturalHeight = this.#documentElement.scrollHeight;
    const availableWidth = this.#viewport.clientWidth;
    const availableHeight = this.#viewport.clientHeight;
    if (naturalWidth <= 0 || availableWidth <= 0) return;
    const baseFontSize = Number.parseFloat(
      getComputedStyle(this.#documentElement).fontSize
    );
    const maxFontSize = Number.parseFloat(
      getComputedStyle(this.#fitFontMeasure).fontSize
    );
    const nextZoom = calculateCharDeskFitZoom({
      mode: fitMode,
      naturalWidth,
      naturalHeight,
      availableWidth,
      availableHeight,
      baseFontSize: Number.isFinite(baseFontSize) ? baseFontSize : 15,
      maxFontSize: Number.isFinite(maxFontSize) ? maxFontSize : 20,
      minZoom: MIN_ZOOM,
      maxZoom: MAX_ZOOM,
    });
    this.#fit = fitMode;
    if (this.getAttribute("fit") !== fitMode) this.setAttribute("fit", fitMode);
    this.#applyZoom(nextZoom);
    this.#syncViewportHeight();
  }

  copyPlainText() {
    return this.#copy(this.#parsedDocument?.plainText ?? "", "plain");
  }

  copySource() {
    return this.#copy(this.#source, "source");
  }

  copySelection() {
    if (!this.#gridIndex || !this.#selection) return Promise.resolve();
    return this.#copy(
      getCharDeskGridSelectionText(this.#gridIndex, this.#selection),
      "selection"
    );
  }

  #readFallbackSource() {
    const fallback = this.querySelector("pre[data-chardesk-source], pre");
    return fallback?.textContent ?? this.textContent ?? "";
  }

  #render() {
    const model = createCharDeskRenderModel(this.#source, {
      syntax: this.syntax,
    });
    this.#parsedDocument = model.document;
    this.#gridIndex = createCharDeskGridIndex(model.document);
    if (this.#selection) {
      this.#selection = null;
      this.#emitSelectionChange();
    }
    if (this.#cursor) {
      const previous = this.#cursor;
      const next = normalizeCharDeskGridPoint(this.#gridIndex, this.#cursor);
      this.#cursor = next;
      if (next?.x !== previous.x || next?.y !== previous.y) {
        this.#emitCursorChange();
      }
    }
    this.#documentElement.replaceChildren();
    model.rows.forEach((row, rowIndex) => {
      row.runs.forEach((run) => appendRun(this.#documentElement, run));
      if (rowIndex < model.rows.length - 1) {
        this.#documentElement.append(document.createTextNode("\n"));
      }
    });
    this.#documentElement.dataset.width = String(model.document.width);
    this.#documentElement.dataset.height = String(model.document.height);
    this.#documentElement.dataset.diagnostics = String(
      model.document.diagnostics.length
    );
    this.#scheduleLayout();
  }

  #scheduleLayout() {
    queueMicrotask(() => {
      if (!this.isConnected) return;
      this.#measureGrid();
      if (this.#fit === "none") {
        this.#updateStageSize();
        this.#syncViewportHeight();
      } else {
        this.fitToViewport(this.#fit);
      }
      this.#updateGridOverlay();
    });
  }

  #setManualZoom(value: number) {
    this.#fit = "none";
    if (this.getAttribute("fit") !== "none") {
      this.#suppressFitLayout = true;
      this.setAttribute("fit", "none");
      this.#suppressFitLayout = false;
    }
    this.#applyZoom(value);
  }

  #applyZoom(value: number) {
    const next = clampZoom(value);
    if (!Number.isFinite(next)) return;
    const changed = next !== this.#zoom;
    this.#zoom = next;
    this.#surface.style.transform = `scale(${next})`;
    this.#updateStageSize();
    this.#updateGridOverlay();
    if (changed) {
      this.dispatchEvent(
        new CustomEvent("chardesk-zoom-change", {
          detail: { zoom: next, fit: this.#fit },
        })
      );
    }
  }

  #updateStageSize() {
    this.#stage.style.width = `${this.#documentElement.scrollWidth * this.#zoom}px`;
    this.#stage.style.height = `${this.#documentElement.scrollHeight * this.#zoom}px`;
    this.#updateSurfaceAlignment();
  }

  #updateSurfaceAlignment() {
    const scaledWidth = this.#documentElement.scrollWidth * this.#zoom;
    const availableWidth = this.#viewport.clientWidth;
    const offset = Math.max(0, (availableWidth - scaledWidth) / 2);
    this.#surface.style.left = `${offset}px`;
  }

  #syncViewportHeight() {
    const height = this.#documentElement.scrollHeight * this.#zoom;
    if (height <= 0 || !Number.isFinite(height)) return;
    this.#viewport.style.setProperty(
      "--chardesk-auto-viewport-height",
      `${height}px`
    );
  }

  #syncAttributes() {
    this.#toolbar.hidden = !this.controls;
    const label = this.getAttribute("aria-label") ?? "CharDesk document";
    this.#viewport.setAttribute("aria-label", label);
    this.#documentElement.setAttribute("aria-label", label);
    this.#viewport.tabIndex = this.interaction === "grid" ? 0 : -1;
    this.#viewport.toggleAttribute(
      "data-grid-interaction",
      this.interaction === "grid"
    );
    this.#surface.style.transform = `scale(${this.#zoom})`;
    this.#updateGridOverlay();
  }

  #measureGrid() {
    const rect = this.#measure.getBoundingClientRect();
    this.#cellWidth = rect.width / 10;
    this.#cellHeight = rect.height;
  }

  #resolvePointerPoint(
    clientX: number,
    clientY: number,
    boundary: "strict" | "clamp" = "strict"
  ) {
    if (!this.#gridIndex || !hasCharDeskGrid(this.#gridIndex)) return null;
    if (this.#cellWidth <= 0 || this.#cellHeight <= 0) this.#measureGrid();
    if (this.#cellWidth <= 0 || this.#cellHeight <= 0) return null;
    const rect = this.#documentElement.getBoundingClientRect();
    const computed = getComputedStyle(this.#documentElement);
    const paddingLeft = Number.parseFloat(computed.paddingLeft) || 0;
    const paddingTop = Number.parseFloat(computed.paddingTop) || 0;
    const point = {
      x: Math.floor(((clientX - rect.left) / this.#zoom - paddingLeft) / this.#cellWidth),
      y: Math.floor(((clientY - rect.top) / this.#zoom - paddingTop) / this.#cellHeight),
    };
    return boundary === "clamp"
      ? normalizeCharDeskGridPoint(this.#gridIndex, point)
      : hitTestCharDeskGridPoint(this.#gridIndex, point);
  }

  #resetPointerGesture() {
    if (
      this.#selectionPointerId !== null &&
      this.#viewport.hasPointerCapture?.(this.#selectionPointerId)
    ) {
      this.#viewport.releasePointerCapture(this.#selectionPointerId);
    }
    this.#selectionPointerId = null;
    this.#pointerAnchor = null;
    this.#pointerStart = null;
    this.#selectionGestureActive = false;
  }

  #handlePointerDown = (event: PointerEvent) => {
    if (this.interaction !== "grid" || event.button !== 0) return;
    if (event.composedPath().some((target) => target instanceof HTMLAnchorElement)) {
      return;
    }
    const point = this.#resolvePointerPoint(event.clientX, event.clientY);
    if (!point) return;
    event.preventDefault();
    this.#viewport.focus({ preventScroll: true });
    this.#selectionPointerId = event.pointerId;
    this.#pointerAnchor = point;
    this.#pointerStart = { x: event.clientX, y: event.clientY };
    this.#selectionGestureActive = false;
    this.#suppressClick = false;
    this.#viewport.setPointerCapture?.(event.pointerId);
  };

  #handlePointerMove = (event: PointerEvent) => {
    if (
      this.interaction !== "grid" ||
      this.#selectionPointerId !== event.pointerId ||
      !this.#pointerAnchor ||
      !this.#pointerStart
    ) {
      return;
    }
    if (!this.#selectionGestureActive) {
      const distance = Math.hypot(
        event.clientX - this.#pointerStart.x,
        event.clientY - this.#pointerStart.y
      );
      if (distance < SELECTION_DRAG_THRESHOLD) return;
      this.#selectionGestureActive = true;
    }
    const point = this.#resolvePointerPoint(
      event.clientX,
      event.clientY,
      "clamp"
    );
    if (!point) return;
    event.preventDefault();
    this.setSelection(this.#pointerAnchor, point);
  };

  #handlePointerUp = (event: PointerEvent) => {
    if (this.#selectionPointerId !== event.pointerId) return;
    const completedSelection =
      event.type !== "pointercancel" && this.#selectionGestureActive;
    this.#resetPointerGesture();
    this.#suppressClick = completedSelection;
  };

  #handleClick = (event: MouseEvent) => {
    if (this.interaction !== "grid") return;
    if (this.#suppressClick) {
      this.#suppressClick = false;
      event.preventDefault();
      return;
    }
    if (event.composedPath().some((target) => target instanceof HTMLAnchorElement)) {
      return;
    }
    const point = this.#resolvePointerPoint(event.clientX, event.clientY);
    if (!point) return;
    this.#viewport.focus({ preventScroll: true });
    this.clearSelection();
    this.setCursor(point);
  };

  #handleKeyDown = (event: KeyboardEvent) => {
    if (this.interaction !== "grid" || !this.#gridIndex) return;
    if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "c") {
      if (!this.#selection) return;
      event.preventDefault();
      void this.copySelection();
      return;
    }
    if (event.key === "Escape") {
      if (!this.#selection) return;
      event.preventDefault();
      this.clearSelection();
      return;
    }

    const deltas: Record<string, CharDeskGridPoint> = {
      ArrowLeft: { x: -1, y: 0 },
      ArrowRight: { x: 1, y: 0 },
      ArrowUp: { x: 0, y: -1 },
      ArrowDown: { x: 0, y: 1 },
    };
    const delta = deltas[event.key];
    if (!delta) return;
    event.preventDefault();
    const current = this.#cursor ?? normalizeCharDeskGridPoint(this.#gridIndex, {
      x: 0,
      y: 0,
    });
    if (!current) return;
    const next = moveCharDeskGridPoint(this.#gridIndex, current, delta);
    if (!next) return;
    if (event.shiftKey) {
      this.setSelection(this.#selection?.anchor ?? current, next);
    } else {
      this.clearSelection();
      this.setCursor(next);
    }
    queueMicrotask(() => {
      this.#cursorElement.scrollIntoView?.({ block: "nearest", inline: "nearest" });
    });
  };

  #positionGridElement(
    element: HTMLDivElement,
    rect: { left: number; top: number; right: number; bottom: number } | null
  ) {
    if (!rect || this.#cellWidth <= 0 || this.#cellHeight <= 0) {
      element.style.display = "none";
      return;
    }
    const computed = getComputedStyle(this.#documentElement);
    const paddingLeft = Number.parseFloat(computed.paddingLeft) || 0;
    const paddingTop = Number.parseFloat(computed.paddingTop) || 0;
    element.style.display = "block";
    element.style.left = `${paddingLeft + rect.left * this.#cellWidth}px`;
    element.style.top = `${paddingTop + rect.top * this.#cellHeight}px`;
    element.style.width = `${(rect.right - rect.left + 1) * this.#cellWidth}px`;
    element.style.height = `${(rect.bottom - rect.top + 1) * this.#cellHeight}px`;
  }

  #updateGridOverlay() {
    const enabled = this.interaction === "grid" && !!this.#gridIndex;
    const cursorCell = enabled && this.#cursor && this.#gridIndex
      ? getCharDeskGridCell(this.#gridIndex, this.#cursor)
      : null;
    const cursorRect = enabled && this.#cursor
      ? {
          left: this.#cursor.x,
          top: this.#cursor.y,
          right: this.#cursor.x + (cursorCell?.width ?? 1) - 1,
          bottom: this.#cursor.y,
        }
      : null;
    this.#positionGridElement(this.#selectionElement, enabled ? this.#selection?.rect ?? null : null);
    this.#positionGridElement(this.#cursorElement, cursorRect);
  }

  #emitSelectionChange() {
    this.dispatchEvent(
      new CustomEvent("chardesk-selection-change", {
        detail: { selection: this.selection },
      })
    );
  }

  #emitCursorChange() {
    this.dispatchEvent(
      new CustomEvent("chardesk-cursor-change", {
        detail: { cursor: this.cursor },
      })
    );
  }

  async #copy(text: string, format: CharDeskViewerCopyFormat) {
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(text);
      } else {
        const textarea = document.createElement("textarea");
        textarea.value = text;
        textarea.style.position = "fixed";
        textarea.style.opacity = "0";
        document.body.append(textarea);
        textarea.select();
        const copied = document.execCommand("copy");
        textarea.remove();
        if (!copied) throw new Error("Clipboard API is unavailable.");
      }
      this.#announce("Copied");
      this.dispatchEvent(
        new CustomEvent("chardesk-copy", { detail: { format } })
      );
    } catch (error) {
      this.#announce("Copy failed");
      this.dispatchEvent(
        new CustomEvent("chardesk-copy-error", {
          detail: { error, format },
        })
      );
      throw error;
    }
  }

  #announce(message: string) {
    this.#status.textContent = message;
    if (this.#statusTimer) clearTimeout(this.#statusTimer);
    this.#statusTimer = setTimeout(() => {
      this.#status.textContent = "";
      this.#statusTimer = null;
    }, 1200);
  }
}

export const defineCharDeskViewer = () => {
  if (typeof customElements === "undefined") return CharDeskViewerElement;
  if (!customElements.get("chardesk-viewer")) {
    customElements.define("chardesk-viewer", CharDeskViewerElement);
  }
  return CharDeskViewerElement;
};
