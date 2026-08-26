import { serialize } from "node:v8";
import { writeFile } from "node:fs/promises";
import { renderSourceToPng } from "./render.js";

const readRequest = async () => {
  const chunks: Buffer[] = [];
  for await (const chunk of process.stdin) chunks.push(Buffer.from(chunk));
  return JSON.parse(Buffer.concat(chunks).toString("utf8")) as {
    request: Parameters<typeof renderSourceToPng>[0];
    outputPath: string;
  };
};

try {
  const { request, outputPath } = await readRequest();
  const { bytes, ...result } = await renderSourceToPng(request);
  await writeFile(outputPath, bytes, { flag: "wx" });
  process.stdout.write(serialize({ ok: true, result }));
} catch (error) {
  const value = error as { code?: unknown; message?: unknown };
  process.stdout.write(serialize({
    ok: false,
    error: {
      code: typeof value?.code === "string" ? value.code : "render-failed",
      message: typeof value?.message === "string"
        ? value.message
        : "CharDesk PNG render failed.",
    },
  }));
  process.exitCode = 1;
}
