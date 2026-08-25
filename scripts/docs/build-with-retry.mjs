import { spawn } from "node:child_process";
import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";

const MAX_CAPTURED_OUTPUT = 128 * 1024;
const RETRY_DELAY_MS = 500;
const scriptPath = fileURLToPath(import.meta.url);
const repositoryRoot = path.resolve(path.dirname(scriptPath), "../..");
const docsDirectory = path.join(repositoryRoot, "apps/docs");

export function isRetryablePrerenderFailure(output) {
  return output.split(/\r?\n/).some((line) => {
    const match = line.match(
      /Prerender: Request failed for (\S+):\s*(.*)$/i
    );
    if (!match) return false;

    const [, requestPath, detail] = match;
    return (
      /(?:ECONNREFUSED|ECONNRESET|socket hang up)/i.test(detail) ||
      (requestPath.endsWith(".data") && detail.trim() === "")
    );
  });
}

export async function runWithPrerenderRetry(
  runBuild,
  {
    delay = (milliseconds) =>
      new Promise((resolve) => setTimeout(resolve, milliseconds)),
    log = (message) => console.warn(message),
  } = {}
) {
  const firstResult = await runBuild();
  if (
    firstResult.exitCode === 0 ||
    !isRetryablePrerenderFailure(firstResult.output)
  ) {
    return firstResult.exitCode;
  }

  log(
    "Docs prerender hit a transient React Router preview request failure; retrying once."
  );
  await delay(RETRY_DELAY_MS);
  return (await runBuild()).exitCode;
}

async function resolveReactRouterCli() {
  const require = createRequire(import.meta.url);
  const packagePath = require.resolve("@react-router/dev/package.json");
  const packageJson = JSON.parse(await readFile(packagePath, "utf8"));
  return path.resolve(path.dirname(packagePath), packageJson.bin["react-router"]);
}

async function runReactRouterBuild() {
  const cliPath = await resolveReactRouterCli();

  return new Promise((resolve) => {
    const child = spawn(process.execPath, [cliPath, "build"], {
      cwd: docsDirectory,
      env: process.env,
      stdio: ["inherit", "pipe", "pipe"],
    });
    let output = "";
    let settled = false;

    const capture = (chunk, stream) => {
      stream.write(chunk);
      output = `${output}${chunk}`.slice(-MAX_CAPTURED_OUTPUT);
    };

    child.stdout.on("data", (chunk) => capture(chunk, process.stdout));
    child.stderr.on("data", (chunk) => capture(chunk, process.stderr));
    child.once("error", (error) => {
      if (settled) return;
      settled = true;
      const message = `${error.stack ?? error.message}\n`;
      process.stderr.write(message);
      resolve({ exitCode: 1, output: `${output}${message}` });
    });
    child.once("close", (exitCode) => {
      if (settled) return;
      settled = true;
      resolve({ exitCode: exitCode ?? 1, output });
    });
  });
}

if (process.argv[1] && path.resolve(process.argv[1]) === scriptPath) {
  process.exitCode = await runWithPrerenderRetry(runReactRouterBuild);
}
