import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { parseCharDeskText } from "@chardesk/protocol";
import { validateStyledCanvas } from "./authoring.js";

export type CanvasEvalCase = {
  id: string;
  artifact: string;
  prompt?: string;
  expected_plain?: string;
  required_styles?: Array<{
    text: string;
    color?: string;
    bg_color?: string;
    href?: string;
    attrs?: Array<"bold" | "italic" | "underline" | "strike" | "inverse">;
  }>;
};

type TraceEvent = {
  type?: string;
  tool?: string;
  input?: string;
  accepted?: boolean;
  input_chars?: number;
  output_chars?: number;
  reasoning_chars?: number;
  wall_ms?: number;
};

const optionalText = async (path: string) => {
  try {
    return await readFile(path, "utf8");
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return undefined;
    throw error;
  }
};

const readTrace = async (path: string) => {
  const raw = await optionalText(path);
  if (!raw) return [];
  return raw.split(/\r?\n/).filter(Boolean).map((line) => JSON.parse(line) as TraceEvent);
};

const styleTargetMatches = (
  parsed: ReturnType<typeof parseCharDeskText>,
  target: NonNullable<CanvasEvalCase["required_styles"]>[number]
) => {
  for (let start = 0; start < parsed.cells.length; start += 1) {
    let text = "";
    const cells = [];
    for (let index = start; index < parsed.cells.length && text.length <= target.text.length; index += 1) {
      const cell = parsed.cells[index]!;
      text += cell.text;
      cells.push(cell);
      if (text !== target.text) continue;
      if (cells.every((candidate) =>
        (target.color === undefined || candidate.color === target.color) &&
        (target.bg_color === undefined || candidate.bgColor === target.bg_color) &&
        (target.href === undefined || candidate.href === target.href) &&
        (target.attrs ?? []).every((attribute) => candidate.attrs?.[attribute] === true)
      )) return true;
      break;
    }
  }
  return false;
};

export const evaluateCanvasRun = async (testCase: CanvasEvalCase, runRoot: string) => {
  const work = join(runRoot, ".chardesk", "work", testCase.artifact);
  const [plainText, styledText, productText, trace] = await Promise.all([
    optionalText(join(work, "plain.txt")),
    optionalText(join(work, "styled.ans")),
    optionalText(join(runRoot, `${testCase.artifact}.chardesk`)),
    readTrace(join(work, "trace.jsonl")),
  ]);

  const validation = plainText !== undefined && styledText !== undefined
    ? validateStyledCanvas(plainText, styledText)
    : undefined;
  const parsed = styledText === undefined
    ? undefined
    : parseCharDeskText(styledText, { syntax: "ansi" });
  const productValid = validation?.accepted === true && productText === styledText;

  const goalChecks = [
    ...(testCase.expected_plain === undefined
      ? []
      : [validation?.accepted === true && validation.canonicalPlainText === testCase.expected_plain]),
    ...(testCase.required_styles ?? []).map((target) =>
      parsed ? styleTargetMatches(parsed, target) : false
    ),
  ];
  const goalScore = goalChecks.length === 0
    ? Number(validation?.accepted === true)
    : goalChecks.filter(Boolean).length / goalChecks.length;
  const visibleCells = parsed?.cells.length ?? 0;
  const explicitlyStyled = parsed?.cells.filter((cell) =>
    cell.color !== undefined || cell.bgColor !== undefined || cell.attrs !== undefined || cell.href !== undefined
  ).length ?? 0;
  const escape = String.fromCharCode(27);
  const sgrPattern = new RegExp(`(?:${escape})?\\[[0-9;]*m`, "g");
  const sgrCount = styledText?.match(sgrPattern)?.length ?? 0;
  const toolCalls = trace.filter((event) => event.type === "tool_call");
  const validations = trace.filter((event) => event.type === "validation_result");
  const totalChars = trace.reduce(
    (sum, event) => sum + (event.input_chars ?? 0) + (event.output_chars ?? 0) + (event.reasoning_chars ?? 0),
    0
  );

  return {
    case_id: testCase.id,
    published: productValid,
    protocol_valid: validation?.accepted === true,
    goal_score: goalScore,
    first_pass_accepted: validations[0]?.accepted === true,
    validation_attempts: validations.length,
    tool_calls: toolCalls.length,
    patch_calls: toolCalls.filter((event) => event.tool === "apply_patch").length,
    estimated_tokens: Math.ceil(totalChars / 4),
    wall_ms: trace.reduce((sum, event) => sum + (event.wall_ms ?? 0), 0),
    second_phase_patch_chars: toolCalls
      .filter((event) => event.tool === "apply_patch" && event.input?.includes("styled.ans"))
      .reduce((sum, event) => sum + (event.input?.length ?? 0), 0),
    explicit_style_coverage: visibleCells === 0 ? 0 : explicitlyStyled / visibleCells,
    default_style_utilization: visibleCells === 0 ? 0 : 1 - explicitlyStyled / visibleCells,
    sgr_sequence_count: sgrCount,
    sgr_per_grapheme: visibleCells === 0 ? 0 : sgrCount / visibleCells,
  };
};

type CanvasEvalResult = Awaited<ReturnType<typeof evaluateCanvasRun>>;

const canvasEvalSortKey = (result: CanvasEvalResult) => [
  Number(result.published && result.protocol_valid),
  result.goal_score,
  -result.estimated_tokens,
  -result.tool_calls,
  -result.validation_attempts,
  -result.sgr_per_grapheme,
];

export const compareCanvasEvalResults = (
  left: CanvasEvalResult,
  right: CanvasEvalResult
) => {
  const leftKey = canvasEvalSortKey(left);
  const rightKey = canvasEvalSortKey(right);
  for (let index = 0; index < leftKey.length; index += 1) {
    const delta = leftKey[index]! - rightKey[index]!;
    if (delta !== 0) return delta > 0 ? -1 : 1;
  }
  return 0;
};
