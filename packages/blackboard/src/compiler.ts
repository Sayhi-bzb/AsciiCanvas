import {
  compileCharDeskText,
  serializeCharGraphAnsi,
  type CharGraphFragment,
  type CompiledCharDeskText,
} from "@chardesk/chargraph";
import {
  BlackboardManifestError,
  parseBlackboardManifest,
  type BlackboardManifest,
  type BlackboardManifestWarning,
} from "./manifest.js";

export type BlackboardPackageErrorCode =
  | "invalid-manifest"
  | "invalid-panel-path"
  | "missing-panel"
  | "invalid-panel";

export class BlackboardPackageError extends Error {
  readonly code: BlackboardPackageErrorCode;
  readonly panel?: string;

  constructor(code: BlackboardPackageErrorCode, message: string, panel?: string) {
    super(message);
    this.name = "BlackboardPackageError";
    this.code = code;
    this.panel = panel;
  }
}

export type BlackboardPanelRequest = { id: string; source: string };

export type CompileBlackboardOptions = {
  manifestSource: string;
  fallbackTitle: string;
  readPanel: (request: BlackboardPanelRequest) => Promise<string>;
};

export type CompiledBlackboard = {
  source: string;
  title: string;
  warnings: BlackboardManifestWarning[];
};

type PanelRegion = {
  minRow: number;
  maxRow: number;
  minColumn: number;
  maxColumn: number;
};

type RenderedPanel = {
  id: string;
  region: PanelRegion;
  compiled: CompiledCharDeskText;
};

const panelRegions = (manifest: BlackboardManifest) => {
  const regions = new Map<string, PanelRegion>();
  manifest.layout.areas.forEach((row, rowIndex) => row.forEach((id, columnIndex) => {
    if (id === null) return;
    const current = regions.get(id);
    if (!current) {
      regions.set(id, {
        minRow: rowIndex,
        maxRow: rowIndex,
        minColumn: columnIndex,
        maxColumn: columnIndex,
      });
      return;
    }
    current.minRow = Math.min(current.minRow, rowIndex);
    current.maxRow = Math.max(current.maxRow, rowIndex);
    current.minColumn = Math.min(current.minColumn, columnIndex);
    current.maxColumn = Math.max(current.maxColumn, columnIndex);
  }));
  return regions;
};

const distributeTrackDeficit = (
  tracks: number[],
  start: number,
  end: number,
  required: number,
  gap: number,
) => {
  const count = end - start + 1;
  const available = tracks
    .slice(start, end + 1)
    .reduce((total, value) => total + value, gap * (count - 1));
  const deficit = Math.max(0, required - available);
  const each = Math.floor(deficit / count);
  const remainder = deficit % count;
  for (let index = start; index <= end; index += 1) {
    tracks[index] = tracks[index]! + each + (index - start < remainder ? 1 : 0);
  }
};

const sizeTracks = (
  count: number,
  panels: RenderedPanel[],
  axis: "column" | "row",
  gap: number,
) => {
  const tracks = Array.from({ length: count }, () => 0);
  const constraints = [...panels].sort((left, right) => {
    const leftSpan = axis === "column"
      ? left.region.maxColumn - left.region.minColumn
      : left.region.maxRow - left.region.minRow;
    const rightSpan = axis === "column"
      ? right.region.maxColumn - right.region.minColumn
      : right.region.maxRow - right.region.minRow;
    return leftSpan - rightSpan;
  });
  constraints.forEach((panel) => distributeTrackDeficit(
    tracks,
    axis === "column" ? panel.region.minColumn : panel.region.minRow,
    axis === "column" ? panel.region.maxColumn : panel.region.maxRow,
    axis === "column" ? panel.compiled.width : panel.compiled.height,
    gap,
  ));
  return tracks;
};

const trackOrigins = (tracks: number[], gap: number) => {
  const origins: number[] = [];
  let position = 0;
  tracks.forEach((size) => {
    origins.push(position);
    position += size + gap;
  });
  return origins;
};

const composePanels = (manifest: BlackboardManifest, panels: RenderedPanel[]) => {
  const columnGap = manifest.layout.gap.column;
  const rowGap = manifest.layout.gap.row;
  const columns = sizeTracks(manifest.layout.areas[0]!.length, panels, "column", columnGap);
  const rows = sizeTracks(manifest.layout.areas.length, panels, "row", rowGap);
  const columnOrigins = trackOrigins(columns, columnGap);
  const rowOrigins = trackOrigins(rows, rowGap);
  const outputRows = new Map<number, Array<CharGraphFragment & { x: number; width: number }>>();

  panels.forEach((panel) => {
    const originX = columnOrigins[panel.region.minColumn]!;
    const originY = rowOrigins[panel.region.minRow]!;
    panel.compiled.rows.forEach((row) => {
      const target = outputRows.get(originY + row.y) ?? [];
      row.spans.forEach((span) => target.push({ ...span, x: originX + span.x }));
      outputRows.set(originY + row.y, target);
    });
  });

  const fragments: CharGraphFragment[] = [];
  const lastY = Math.max(-1, ...outputRows.keys());
  for (let y = 0; y <= lastY; y += 1) {
    const spans = [...(outputRows.get(y) ?? [])].sort((left, right) => left.x - right.x);
    let cursorX = 0;
    spans.forEach(({ x, width, ...span }) => {
      if (x < cursorX) {
        throw new BlackboardPackageError("invalid-manifest", "Panel content overlaps after layout.");
      }
      if (x > cursorX) fragments.push({ text: " ".repeat(x - cursorX) });
      fragments.push(span);
      cursorX = x + width;
    });
    if (y < lastY) fragments.push({ text: "\n" });
  }
  return serializeCharGraphAnsi({ fragments }).replaceAll("\u001b", "");
};

const validatePanelPath = ({ id, source }: BlackboardPanelRequest) => {
  const segments = source.split("/");
  if (
    source.startsWith("/") ||
    source.includes("\\") ||
    /^[a-z]:/iu.test(source) ||
    segments.some((segment) => segment === "" || segment === "." || segment === "..")
  ) {
    throw new BlackboardPackageError(
      "invalid-panel-path",
      `Panel ${JSON.stringify(id)} must use a package-relative POSIX path.`,
      id,
    );
  }
};

const renderPanel = async (
  request: BlackboardPanelRequest,
  region: PanelRegion | undefined,
  readPanel: CompileBlackboardOptions["readPanel"],
) => {
  validatePanelPath(request);
  let source: string;
  try {
    source = await readPanel(request);
  } catch (error) {
    if (error instanceof BlackboardPackageError) throw error;
    throw new BlackboardPackageError(
      "invalid-panel",
      `Panel ${JSON.stringify(request.id)} could not be read: ${
        error instanceof Error ? error.message : request.source
      }`,
      request.id,
    );
  }
  if (source.includes("\u001b")) {
    throw new BlackboardPackageError(
      "invalid-panel",
      `Panel ${JSON.stringify(request.id)} must use visible ESC-less ANSI controls.`,
      request.id,
    );
  }
  let compiled: CompiledCharDeskText;
  try {
    compiled = await compileCharDeskText(source, { sourceKind: "chargraph" });
  } catch (error) {
    throw new BlackboardPackageError(
      "invalid-panel",
      `Panel ${JSON.stringify(request.id)}: ${
        error instanceof Error ? error.message : "rendering failed"
      }`,
      request.id,
    );
  }
  const diagnostic = compiled.diagnostics[0];
  if (diagnostic) {
    throw new BlackboardPackageError(
      "invalid-panel",
      `Panel ${JSON.stringify(request.id)}: ${diagnostic.message}`,
      request.id,
    );
  }
  return region ? { id: request.id, region, compiled } satisfies RenderedPanel : undefined;
};

export const compileBlackboard = async ({
  manifestSource,
  fallbackTitle,
  readPanel,
}: CompileBlackboardOptions): Promise<CompiledBlackboard> => {
  let parsed: ReturnType<typeof parseBlackboardManifest>;
  try {
    parsed = parseBlackboardManifest(manifestSource);
  } catch (error) {
    if (error instanceof BlackboardManifestError) {
      throw new BlackboardPackageError("invalid-manifest", error.message);
    }
    throw error;
  }
  const regions = panelRegions(parsed.manifest);
  const rendered = await Promise.all(Object.entries(parsed.manifest.panels).map(
    ([id, panel]) => renderPanel({ id, source: panel.source }, regions.get(id), readPanel),
  ));
  return {
    source: composePanels(parsed.manifest, rendered.flatMap((panel) => panel ? [panel] : [])),
    title: parsed.manifest.title ?? fallbackTitle,
    warnings: parsed.warnings,
  };
};
