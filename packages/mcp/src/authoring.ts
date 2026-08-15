import { createHash, randomUUID } from "node:crypto";
import { mkdir, readFile, rename, unlink, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import {
  compareCharDeskGeometry,
  createCharDeskGeometrySnapshot,
  parseCharDeskText,
} from "@chardesk/protocol";
import type {
  CharDeskGeometryMismatch,
  CharDeskTextDiagnostic,
} from "@chardesk/protocol";

type CanvasValidationFailure = {
  accepted: false;
  code: "invalid-plain-text" | "invalid-ansi" | "geometry-mismatch";
  message: string;
  retryable: true;
  diagnostics?: CharDeskTextDiagnostic[];
  mismatch?: CharDeskGeometryMismatch;
};

type CanvasValidationSuccess = {
  accepted: true;
  canonicalPlainText: string;
};

type CanvasValidation = CanvasValidationFailure | CanvasValidationSuccess;

const validatePlainCanvas = (plainText: string) => {
  const detected = parseCharDeskText(plainText, { syntax: "auto" });
  if (detected.hasAnsi) {
    throw new Error("The plain phase must not include ANSI or OSC controls.");
  }
  if (detected.diagnostics.length > 0) {
    throw new Error("The plain phase contains unsupported control characters.");
  }
  return createCharDeskGeometrySnapshot(plainText, { syntax: "plain" });
};

export const validateStyledCanvas = (
  plainText: string,
  ansiText: string
): CanvasValidation => {
  let plain;
  try {
    plain = validatePlainCanvas(plainText);
  } catch (error) {
    return {
      accepted: false,
      code: "invalid-plain-text",
      message: error instanceof Error ? error.message : "Invalid plain text.",
      retryable: true,
    };
  }

  if (ansiText.includes("\u001b")) {
    return {
      accepted: false,
      code: "invalid-ansi",
      message: "CharDesk files use visible ESC-less ANSI controls.",
      retryable: true,
    };
  }

  const parsed = parseCharDeskText(ansiText, { syntax: "ansi" });
  if (parsed.diagnostics.length > 0) {
    return {
      accepted: false,
      code: "invalid-ansi",
      message: "ANSI text contains malformed or unsupported controls.",
      retryable: true,
      diagnostics: parsed.diagnostics,
    };
  }

  const comparison = compareCharDeskGeometry(plain.plainText, ansiText);
  if (!comparison.matches) {
    return {
      accepted: false,
      code: "geometry-mismatch",
      message: comparison.mismatch?.message ?? "ANSI styling changed the canvas.",
      retryable: true,
      ...(comparison.mismatch ? { mismatch: comparison.mismatch } : {}),
    };
  }

  return {
    accepted: true,
    canonicalPlainText: plain.plainText,
  };
};

const fileExists = async (path: string) => {
  try {
    await readFile(path);
    return true;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return false;
    throw error;
  }
};

const atomicWrite = async (path: string, content: string) => {
  await mkdir(dirname(path), { recursive: true });
  const temporary = `${path}.${process.pid}.${randomUUID()}.tmp`;
  try {
    await writeFile(temporary, content, "utf8");
    await rename(temporary, path);
  } catch (error) {
    await unlink(temporary).catch(() => undefined);
    throw error;
  }
};

export const sha256 = (content: string) =>
  createHash("sha256").update(content).digest("hex");

export const seedCanvasFiles = async (plainPath: string, styledPath: string) => {
  const plainText = await readFile(plainPath, "utf8");
  const snapshot = validatePlainCanvas(plainText);
  if (await fileExists(styledPath)) {
    return { status: "exists" as const, canonicalPlainText: snapshot.plainText };
  }
  await atomicWrite(styledPath, snapshot.plainText);
  return { status: "created" as const, canonicalPlainText: snapshot.plainText };
};

export const publishCanvasFiles = async (
  plainPath: string,
  styledPath: string,
  outputPath: string
) => {
  const [plainText, ansiText] = await Promise.all([
    readFile(plainPath, "utf8"),
    readFile(styledPath, "utf8"),
  ]);
  const validation = validateStyledCanvas(plainText, ansiText);
  if (!validation.accepted) return validation;

  await atomicWrite(outputPath, ansiText);
  return {
    accepted: true as const,
    plainHash: sha256(validation.canonicalPlainText),
    styledHash: sha256(ansiText),
    outputPath,
  };
};

export const writeJsonAtomic = (path: string, value: unknown) =>
  atomicWrite(path, `${JSON.stringify(value, null, 2)}\n`);
