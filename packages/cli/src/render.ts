import {
  getCharGraphText,
  renderCharGraphText,
  serializeCharGraphAnsi,
  type CharGraphFragment,
} from "@chardesk/chargraph";
import { createCharDeskMarkdownRenderOptions } from "@chardesk/chargraph/markdown";
import { CHARDESK_LIGHT_RENDER_THEME } from "@chardesk/chargraph/theme";
import {
  decodeCharDeskTextRuns,
  layoutCharDeskTextRuns,
  type ParsedCharDeskText,
  type CharDeskTextDiagnostic,
} from "@chardesk/protocol";
import { createCharDeskRenderModelFromDocument } from "@chardesk/rendering";
import {
  drawCharDeskCanvasDocument,
  measureCharDeskCanvasDocument,
} from "@chardesk/rendering/canvas";

export type CharDeskCliInputMode = "chargraph" | "chardesk";
export type CharDeskCliOutputFormat = "png" | "chardesk" | "ansi" | "text";

export type CharDeskCliDiagnostic = {
  code: string;
  message: string;
  offset?: number;
  length?: number;
};

type CompileSourceOptions = {
  source: string;
  inputMode: CharDeskCliInputMode;
};

type RenderSourceOptions = CompileSourceOptions & {
  format: CharDeskCliOutputFormat;
  scale?: number;
  padding?: number;
};

type CharDeskCliCompilation = {
  inputMode: CharDeskCliInputMode;
  renderer: string;
  pipeline: readonly string[];
  columns: number;
  rows: number;
  diagnostics: CharDeskCliDiagnostic[];
  fragments: CharGraphFragment[];
  document: ParsedCharDeskText;
};

type RenderSourceResult = Omit<CharDeskCliCompilation, "fragments" | "document"> & {
  bytes: Uint8Array;
  format: CharDeskCliOutputFormat;
  width?: number;
  height?: number;
};

export class CharDeskCliRenderError extends Error {
  constructor(readonly code: "empty-content" | "image-too-large" | "terminal-escape") {
    super(code);
    this.name = "CharDeskCliRenderError";
  }
}

const MAX_RASTER_EDGE = 8192;
const MAX_RASTER_PIXELS = 16_777_216;
const PALETTE = {
  color: CHARDESK_LIGHT_RENDER_THEME.foreground,
  background: CHARDESK_LIGHT_RENDER_THEME.background,
};
const ESC = "\u001b";

const toDiagnostic = (diagnostic: CharDeskTextDiagnostic): CharDeskCliDiagnostic => ({
  code: diagnostic.code,
  message: diagnostic.message,
  ...(diagnostic.offset === undefined ? {} : { offset: diagnostic.offset }),
  ...(diagnostic.length === undefined ? {} : { length: diagnostic.length }),
});

const fragmentsFromCharDesk = (source: string) => {
  if (source.includes(ESC)) throw new CharDeskCliRenderError("terminal-escape");
  const decoded = decodeCharDeskTextRuns(source, { syntax: "ansi" });
  const fragments: CharGraphFragment[] = decoded.runs.map((run) => ({
    text: run.text,
    ...(run.color ? { color: run.color } : {}),
    ...(run.bgColor ? { bgColor: run.bgColor } : {}),
    ...(run.attrs ? { attrs: { ...run.attrs } } : {}),
    ...(run.href ? { href: run.href } : {}),
  }));
  return { fragments, diagnostics: decoded.diagnostics.map(toDiagnostic) };
};

export const compileSource = async ({
  source,
  inputMode,
}: CompileSourceOptions): Promise<CharDeskCliCompilation> => {
  let fragments: CharGraphFragment[];
  let renderer: string;
  let pipeline: readonly string[];
  let diagnostics: CharDeskCliDiagnostic[];

  if (inputMode === "chardesk") {
    const decoded = fragmentsFromCharDesk(source);
    fragments = decoded.fragments;
    renderer = "chardesk";
    pipeline = ["chardesk"];
    diagnostics = decoded.diagnostics;
  } else {
    const rendered = await renderCharGraphText(source, {
      markdown: createCharDeskMarkdownRenderOptions({
        theme: CHARDESK_LIGHT_RENDER_THEME,
      }),
    });
    fragments = rendered.fragments.map((fragment) => ({ ...fragment }));
    renderer = rendered.renderer;
    pipeline = rendered.pipeline;
    diagnostics = rendered.diagnostics.map((diagnostic) => ({ ...diagnostic }));
  }

  const document = layoutCharDeskTextRuns(fragments);
  if (document.width === 0 || document.height === 0) {
    throw new CharDeskCliRenderError("empty-content");
  }
  return {
    inputMode,
    renderer,
    pipeline,
    columns: document.width,
    rows: document.height,
    diagnostics: [...diagnostics, ...document.diagnostics.map(toDiagnostic)],
    fragments,
    document,
  };
};

const validateDimension = (value: number, code: "scale" | "padding") => {
  const maximum = code === "scale" ? 4 : 256;
  const minimum = code === "scale" ? 1 : 0;
  if (!Number.isInteger(value) || value < minimum || value > maximum) {
    throw new RangeError(`${code} must be an integer from ${minimum} through ${maximum}.`);
  }
};

const renderPng = async (
  compiled: CharDeskCliCompilation,
  scale: number,
  padding: number
) => {
  validateDimension(scale, "scale");
  validateDimension(padding, "padding");
  const model = createCharDeskRenderModelFromDocument(compiled.document);
  const layout = measureCharDeskCanvasDocument(model, {
    zoom: scale,
    padding,
  });
  if (
    layout.width > MAX_RASTER_EDGE ||
    layout.height > MAX_RASTER_EDGE ||
    layout.width * layout.height > MAX_RASTER_PIXELS
  ) {
    throw new CharDeskCliRenderError("image-too-large");
  }

  const [{ createCanvas }, { loadCharDeskNodeFonts }] = await Promise.all([
    import("@napi-rs/canvas"),
    import("./fonts.js"),
  ]);
  const fontFamilies = await loadCharDeskNodeFonts(model);
  const canvas = createCanvas(layout.width, layout.height);
  const context = canvas.getContext("2d");
  context.fillStyle = PALETTE.background;
  context.fillRect(0, 0, layout.width, layout.height);
  drawCharDeskCanvasDocument(
    context as unknown as Parameters<typeof drawCharDeskCanvasDocument>[0],
    model,
    {
      palette: PALETTE,
      zoom: scale,
      padding,
      fontAvailability: { text: true, emoji: true },
      fontFamilies,
    }
  );
  return {
    bytes: await canvas.encode("png"),
    width: layout.width,
    height: layout.height,
  };
};

const renderText = (
  compiled: CharDeskCliCompilation,
  format: Exclude<CharDeskCliOutputFormat, "png">
) => {
  const result = { fragments: compiled.fragments };
  if (format === "text") return getCharGraphText(result);
  const ansi = serializeCharGraphAnsi(result);
  return format === "chardesk" ? ansi.replaceAll(ESC, "") : ansi;
};

export const renderSource = async ({
  source,
  inputMode,
  format,
  scale = 2,
  padding = 16,
}: RenderSourceOptions): Promise<RenderSourceResult> => {
  const compiled = await compileSource({ source, inputMode });
  const metadata = {
    inputMode: compiled.inputMode,
    renderer: compiled.renderer,
    pipeline: compiled.pipeline,
    columns: compiled.columns,
    rows: compiled.rows,
    diagnostics: compiled.diagnostics,
    format,
  };
  if (format === "png") {
    return { ...metadata, ...(await renderPng(compiled, scale, padding)) };
  }
  return {
    ...metadata,
    bytes: new TextEncoder().encode(renderText(compiled, format)),
  };
};

export const renderSourceToPng = async (
  options: Omit<RenderSourceOptions, "format">
) => renderSource({ ...options, format: "png" });
