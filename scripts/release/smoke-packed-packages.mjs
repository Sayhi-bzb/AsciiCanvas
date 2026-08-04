import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const [protocolTarball, fontsTarball] = process.argv.slice(2).map((value) =>
  value ? path.resolve(value) : value
);

if (!protocolTarball || !fontsTarball) {
  throw new Error(
    "Usage: node scripts/release/smoke-packed-packages.mjs <protocol.tgz> <fonts.tgz>"
  );
}

for (const tarball of [protocolTarball, fontsTarball]) {
  if (!fs.existsSync(tarball)) {
    throw new Error(`Missing package tarball: ${tarball}`);
  }
}

const temporaryDirectory = fs.mkdtempSync(
  path.join(os.tmpdir(), "ascii-canvas-package-smoke-")
);
const npmCommand = process.platform === "win32" ? "npm.cmd" : "npm";

try {
  fs.writeFileSync(
    path.join(temporaryDirectory, "package.json"),
    JSON.stringify({ private: true, type: "module" }, null, 2)
  );
  execFileSync(
    npmCommand,
    [
      "install",
      "--ignore-scripts",
      "--no-audit",
      "--no-fund",
      protocolTarball,
      fontsTarball,
    ],
    { cwd: temporaryDirectory, stdio: "inherit" }
  );

  const smokeTest = `
    import fs from "node:fs";
    import { ASCII_CANVAS_FONT_PROFILE } from "@ascii-canvas/fonts";
    import { parseAsciiCanvasText } from "@ascii-canvas/protocol";

    const parsed = parseAsciiCanvasText("A界");
    if (parsed.width !== 3 || parsed.cells.length !== 2) {
      throw new Error("Protocol package returned an unexpected Unicode cell layout");
    }
    if (!ASCII_CANVAS_FONT_PROFILE?.families?.text) {
      throw new Error("Fonts package did not export its renderer profile");
    }
    for (const relativePath of [
      "node_modules/@ascii-canvas/fonts/fonts.css",
      "node_modules/@ascii-canvas/fonts/manifest.json",
    ]) {
      if (!fs.existsSync(new URL(relativePath, import.meta.url))) {
        throw new Error(\`Missing published font asset: \${relativePath}\`);
      }
    }
  `;
  const smokeTestPath = path.join(temporaryDirectory, "smoke.mjs");
  fs.writeFileSync(smokeTestPath, smokeTest);
  execFileSync(process.execPath, [smokeTestPath], {
    cwd: temporaryDirectory,
    stdio: "inherit",
  });
} finally {
  fs.rmSync(temporaryDirectory, { recursive: true, force: true });
}

console.log("Packed package smoke test passed.");
