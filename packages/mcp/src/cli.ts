#!/usr/bin/env node
import { readFile } from "node:fs/promises";
import { createCharDeskGeometrySnapshot } from "@chardesk/protocol";
import { validateStyledCanvas } from "./drafts.js";

const usage = () => {
  console.error(
    "Usage:\n  chardesk-canvas inspect <plain-file>\n  chardesk-canvas validate <plain-file> <ansi-file>"
  );
  process.exitCode = 2;
};

const readUtf8 = (path: string) => readFile(path, "utf8");
const [, , command, ...paths] = process.argv;

if (command === "inspect" && paths.length === 1) {
  const plainText = await readUtf8(paths[0]!);
  const snapshot = createCharDeskGeometrySnapshot(plainText, { syntax: "plain" });
  console.log(
    JSON.stringify({
      canonicalPlainText: snapshot.plainText,
      geometrySignature: snapshot.signature,
      width: snapshot.width,
      height: snapshot.height,
    })
  );
} else if (command === "validate" && paths.length === 2) {
  const [plainText, ansiText] = await Promise.all([
    readUtf8(paths[0]!),
    readUtf8(paths[1]!),
  ]);
  const canonicalPlainText = createCharDeskGeometrySnapshot(plainText, {
    syntax: "plain",
  }).plainText;
  const validation = validateStyledCanvas(canonicalPlainText, ansiText);
  if (validation.accepted) {
    console.log(
      JSON.stringify({
        accepted: true,
        geometrySignature: validation.comparison.actual.signature,
      })
    );
  } else {
    console.log(JSON.stringify(validation));
    process.exitCode = 1;
  }
} else {
  usage();
}
