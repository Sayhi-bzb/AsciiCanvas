import { parseDocument } from "yaml";

export const BLACKBOARD_MANIFEST_SIGNATURE = "blackboard/v1";

export type BlackboardPanelDefinition = {
  source: string;
  summary?: string;
};

export type BlackboardManifest = {
  chardesk: typeof BLACKBOARD_MANIFEST_SIGNATURE;
  title?: string;
  panels: Record<string, BlackboardPanelDefinition>;
  layout: {
    areas: Array<Array<string | null>>;
    gap: {
      column: number;
      row: number;
    };
  };
};

export type BlackboardManifestWarning = {
  code: "unused-panel";
  message: string;
  panel: string;
};

export class BlackboardManifestError extends Error {
  readonly code: "invalid-yaml" | "invalid-manifest";

  constructor(code: "invalid-yaml" | "invalid-manifest", message: string) {
    super(message);
    this.name = "BlackboardManifestError";
    this.code = code;
  }
}

const fail = (message: string): never => {
  throw new BlackboardManifestError("invalid-manifest", message);
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const expectRecord = (value: unknown, path: string) =>
  isRecord(value) ? value : fail(`${path} must be a mapping.`);

const expectKnownKeys = (
  value: Record<string, unknown>,
  allowed: readonly string[],
  path: string,
) => {
  const unknown = Object.keys(value).find((key) => !allowed.includes(key));
  if (unknown) fail(`${path}.${unknown} is not supported by ${BLACKBOARD_MANIFEST_SIGNATURE}.`);
};

const optionalText = (value: unknown, path: string): string | undefined => {
  if (value === undefined) return undefined;
  if (typeof value !== "string") {
    fail(`${path} must be a non-empty single-line string.`);
  }
  const text = value as string;
  if (text.trim().length === 0 || /[\r\n]/u.test(text)) {
    fail(`${path} must be a non-empty single-line string.`);
  }
  return text;
};

const gapValue = (value: unknown, fallback: number, path: string) => {
  if (value === undefined) return fallback;
  if (!Number.isInteger(value) || (value as number) < 0) {
    fail(`${path} must be a non-negative integer.`);
  }
  return value as number;
};

const parsePanels = (value: unknown) => {
  const input = expectRecord(value, "panels");
  if (Object.keys(input).length === 0) fail("panels must register at least one panel.");
  const panels: Record<string, BlackboardPanelDefinition> = {};
  for (const [id, raw] of Object.entries(input)) {
    if (id.trim().length === 0) fail("Panel IDs must not be empty.");
    const panel = expectRecord(raw, `panels.${id}`);
    expectKnownKeys(panel, ["source", "summary"], `panels.${id}`);
    const rawSource = panel.source;
    if (typeof rawSource !== "string" || rawSource.trim().length === 0) {
      fail(`panels.${id}.source must be a non-empty string.`);
    }
    const source = rawSource as string;
    if (!source.endsWith(".panel")) {
      fail(`panels.${id}.source must use the .panel suffix.`);
    }
    const summary = optionalText(panel.summary, `panels.${id}.summary`);
    panels[id] = { source, ...(summary === undefined ? {} : { summary }) };
  }
  return panels;
};

const parseAreas = (
  value: unknown,
  panels: Record<string, BlackboardPanelDefinition>,
): Array<Array<string | null>> => {
  if (!Array.isArray(value) || value.length === 0) {
    fail("layout.areas must be a non-empty matrix.");
  }
  const input = value as unknown[];
  const width = Array.isArray(input[0]) ? input[0].length : 0;
  if (width === 0) fail("layout.areas rows must not be empty.");
  const areas = input.map((rawRow, row) => {
    if (!Array.isArray(rawRow) || rawRow.length !== width) {
      fail(`layout.areas[${row}] must contain exactly ${width} entries.`);
    }
    const entries = rawRow as unknown[];
    return entries.map((entry, column) => {
      if (entry !== null && typeof entry !== "string") {
        fail(`layout.areas[${row}][${column}] must be a panel ID or null.`);
      }
      if (typeof entry === "string" && !(entry in panels)) {
        fail(`layout.areas references unknown panel ${JSON.stringify(entry)}.`);
      }
      return entry as string | null;
    });
  });

  for (const id of Object.keys(panels)) {
    const positions: Array<{ row: number; column: number }> = [];
    areas.forEach((row, rowIndex) => row.forEach((entry, columnIndex) => {
      if (entry === id) positions.push({ row: rowIndex, column: columnIndex });
    }));
    if (positions.length === 0) continue;
    const rows = positions.map((position) => position.row);
    const columns = positions.map((position) => position.column);
    const minRow = Math.min(...rows);
    const maxRow = Math.max(...rows);
    const minColumn = Math.min(...columns);
    const maxColumn = Math.max(...columns);
    for (let row = minRow; row <= maxRow; row += 1) {
      for (let column = minColumn; column <= maxColumn; column += 1) {
        if (areas[row]![column] !== id) {
          fail(`layout.areas panel ${JSON.stringify(id)} must form one filled rectangle.`);
        }
      }
    }
  }
  return areas;
};

export const parseBlackboardManifest = (
  source: string,
): { manifest: BlackboardManifest; warnings: BlackboardManifestWarning[] } => {
  const document = parseDocument(source, { uniqueKeys: true });
  if (document.errors.length > 0) {
    throw new BlackboardManifestError("invalid-yaml", document.errors[0]!.message);
  }
  const root = expectRecord(document.toJS(), "blackboard.yaml");
  expectKnownKeys(root, ["chardesk", "title", "panels", "layout"], "blackboard.yaml");
  if (root.chardesk !== BLACKBOARD_MANIFEST_SIGNATURE) {
    fail(`chardesk must be ${BLACKBOARD_MANIFEST_SIGNATURE}.`);
  }
  const title = optionalText(root.title, "title");
  const panels = parsePanels(root.panels);
  const layout = expectRecord(root.layout, "layout");
  expectKnownKeys(layout, ["areas", "gap"], "layout");
  const areas = parseAreas(layout.areas, panels);
  const rawGap = layout.gap === undefined ? {} : expectRecord(layout.gap, "layout.gap");
  expectKnownKeys(rawGap, ["column", "row"], "layout.gap");
  const used = new Set(areas.flatMap((row) => row.filter((id): id is string => id !== null)));
  const warnings = Object.keys(panels)
    .filter((id) => !used.has(id))
    .map((panel) => ({
      code: "unused-panel" as const,
      message: `Panel ${JSON.stringify(panel)} is registered but not used by layout.areas.`,
      panel,
    }));
  return {
    manifest: {
      chardesk: BLACKBOARD_MANIFEST_SIGNATURE,
      ...(title === undefined ? {} : { title }),
      panels,
      layout: {
        areas,
        gap: {
          column: gapValue(rawGap.column, 4, "layout.gap.column"),
          row: gapValue(rawGap.row, 1, "layout.gap.row"),
        },
      },
    },
    warnings,
  };
};
