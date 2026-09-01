import { createHash, randomBytes } from "node:crypto";
import { spawn } from "node:child_process";
import { createRequire } from "node:module";
import { mkdir, readFile, readdir, realpath, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, dirname, join, resolve } from "node:path";
import { startBlackboardServer, type BlackboardServerSession } from "@chardesk/blackboard/node";
import launchBrowser from "open";
import {
  CharDeskCliCommandError,
  resolveCharDeskInput,
  type CharDeskInputRequest,
} from "./input.js";
import { compileSource } from "./render.js";
import { renderSourceInRasterProcess } from "./raster-process.js";

type OpenSessionOptions = {
  request: CharDeskInputRequest;
  cwd: string;
  port?: number;
  runtimeRoot?: string;
};

type ManagedSessionRecord = {
  version: 1;
  cliVersion: string;
  pid: number;
  input: string;
  url: string;
  canvasUrl: string;
  startedAt: number;
};

type ManagedOpenResult = ManagedSessionRecord & {
  status: "opened" | "reused" | "fallback";
  runtimeReady: boolean;
  fallbackOutput?: string;
  message?: string;
};

const CLI_VERSION = (createRequire(import.meta.url)("../package.json") as { version: string }).version;
const SESSION_ROOT = join(
  tmpdir(),
  "chardesk-sessions-v1",
  createHash("sha256").update(CLI_VERSION).digest("hex").slice(0, 12),
);
const runtimeRoot = () => new URL("./runtime/", import.meta.url).pathname;

const resolveOpenInput = async (cwd: string, input: string) => {
  const requested = resolve(cwd, input);
  let candidate = requested;
  try {
    if ((await stat(requested)).isDirectory()) candidate = join(requested, "blackboard.yaml");
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
  }
  const checked = await realpath(candidate);
  if (basename(checked) !== "blackboard.yaml" && !checked.endsWith(".chardesk")) {
    throw new CharDeskCliCommandError(
      "invalid-live-input",
      "open requires a .chardesk file, blackboard.yaml, or a Blackboard directory.",
    );
  }
  return checked;
};

const sessionKey = (input: string) => createHash("sha256").update(input).digest("hex").slice(0, 24);
const sessionFileForInput = (input: string) => join(SESSION_ROOT, `${sessionKey(input)}.json`);

const readSession = async (path: string): Promise<ManagedSessionRecord | null> => {
  try {
    const value = JSON.parse(await readFile(path, "utf8")) as Partial<ManagedSessionRecord>;
    return value.version === 1
      && value.cliVersion === CLI_VERSION
      && typeof value.pid === "number"
      && typeof value.input === "string"
      && typeof value.url === "string"
      && typeof value.canvasUrl === "string"
      && typeof value.startedAt === "number"
      ? value as ManagedSessionRecord
      : null;
  } catch {
    return null;
  }
};

const health = async (session: ManagedSessionRecord) => {
  try {
    const response = await fetch(new URL("health", `${session.url}/`), {
      cache: "no-store",
      signal: AbortSignal.timeout(1_000),
    });
    if (!response.ok) return null;
    return await response.json() as { status: string; runtimeReady: boolean };
  } catch {
    return null;
  }
};

const waitFor = async <T>(read: () => Promise<T | null>, timeout = 8_000) => {
  const deadline = Date.now() + timeout;
  while (Date.now() < deadline) {
    const value = await read();
    if (value) return value;
    await new Promise((resolveWait) => setTimeout(resolveWait, 80));
  }
  return null;
};

const validateSource = async (options: OpenSessionOptions) => {
  const input = await resolveCharDeskInput({ request: options.request, cwd: options.cwd });
  const compiled = await compileSource({ source: input.source, inputMode: input.inputMode });
  if (compiled.diagnostics.length > 0) {
    throw new CharDeskCliCommandError(
      "invalid-source",
      compiled.diagnostics.map((item) => item.message).join("\n"),
    );
  }
};

const renderFallback = async (options: OpenSessionOptions, input: string) => {
  const resolved = await resolveCharDeskInput({ request: options.request, cwd: options.cwd });
  const rendered = await renderSourceInRasterProcess({
    source: resolved.source,
    inputMode: resolved.inputMode,
    scale: 2,
    padding: 16,
  });
  const output = join(tmpdir(), `chardesk-${sessionKey(input)}.png`);
  await writeFile(output, rendered.bytes);
  return output;
};

export const startCharDeskOpenSession = async (
  options: OpenSessionOptions,
): Promise<BlackboardServerSession> => {
  if (options.request.input === "-") {
    throw new CharDeskCliCommandError("invalid-live-input", "open requires a file or directory path.");
  }
  await validateSource(options);
  const input = await resolveOpenInput(options.cwd, options.request.input);
  const token = randomBytes(24).toString("hex");
  return startBlackboardServer({
    board: { root: dirname(input), path: input },
    port: options.port ?? 0,
    appRoot: options.runtimeRoot ?? runtimeRoot(),
    prefix: `/session/${token}`,
  });
};

export const launchCharDeskOpenSession = async (session: BlackboardServerSession) => {
  await launchBrowser(session.canvasUrl);
};

export const waitForOpenSession = async (session: BlackboardServerSession) => {
  await new Promise<void>((resolveWait) => {
    const close = () => void session.close().finally(resolveWait);
    process.once("SIGINT", close);
    process.once("SIGTERM", close);
  });
};

export const serveManagedOpenSession = async ({
  options,
  sessionFile,
}: {
  options: OpenSessionOptions;
  sessionFile: string;
}) => {
  const input = await resolveOpenInput(options.cwd, options.request.input);
  const running = await startCharDeskOpenSession(options);
  const record: ManagedSessionRecord = {
    version: 1,
    cliVersion: CLI_VERSION,
    pid: process.pid,
    input,
    url: running.url,
    canvasUrl: running.canvasUrl,
    startedAt: Date.now(),
  };
  await mkdir(dirname(sessionFile), { recursive: true });
  await writeFile(sessionFile, JSON.stringify(record), { mode: 0o600 });
  const close = () => void running.close().finally(async () => {
    await rm(sessionFile, { force: true });
  });
  process.once("SIGINT", close);
  process.once("SIGTERM", close);
  await running.closed;
  await rm(sessionFile, { force: true });
  return 0;
};

export const openManagedSession = async ({
  options,
  cliEntry,
  browser = true,
}: {
  options: OpenSessionOptions;
  cliEntry: string;
  browser?: boolean;
}): Promise<ManagedOpenResult> => {
  if (options.request.input === "-") {
    throw new CharDeskCliCommandError("invalid-live-input", "open requires a file or directory path.");
  }
  await validateSource(options);
  const input = await resolveOpenInput(options.cwd, options.request.input);
  const sessionFile = sessionFileForInput(input);
  const existing = await readSession(sessionFile);
  const existingHealth = existing ? await health(existing) : null;
  if (existing && existingHealth) {
    if (!browser) return { ...existing, status: "reused", runtimeReady: existingHealth.runtimeReady };
    try {
      await launchBrowser(existing.canvasUrl);
      const ready = existingHealth.runtimeReady
        ? existingHealth
        : await waitFor(async () => {
          const current = await health(existing);
          return current?.runtimeReady ? current : null;
        });
      if (ready) return { ...existing, status: "reused", runtimeReady: true };
    } catch {
      // The PNG fallback below keeps the user-visible result available.
    }
    return {
      ...existing,
      status: "fallback",
      runtimeReady: false,
      fallbackOutput: await renderFallback(options, input),
      message: "The browser Canvas was unavailable; generated a PNG fallback.",
    };
  }
  await rm(sessionFile, { force: true });
  const args = [cliEntry, "__serve", input, "--session-file", sessionFile];
  if (options.port) args.push("--port", String(options.port));
  const child = spawn(process.execPath, args, {
    cwd: options.cwd,
    detached: true,
    stdio: "ignore",
  });
  child.unref();
  const session = await waitFor(() => readSession(sessionFile));
  if (!session) {
    throw new CharDeskCliCommandError("open-start-failed", "CharDesk local Canvas did not start.");
  }
  if (!browser) return { ...session, status: "opened", runtimeReady: false };
  try {
    await launchBrowser(session.canvasUrl);
    const runtime = await waitFor(async () => {
      const current = await health(session);
      return current?.runtimeReady ? current : null;
    });
    if (runtime) return { ...session, status: "opened", runtimeReady: true };
  } catch {
    // The PNG fallback below keeps the user-visible result available.
  }
  return {
    ...session,
    status: "fallback",
    runtimeReady: false,
    fallbackOutput: await renderFallback(options, input),
    message: "The browser Canvas was unavailable; generated a PNG fallback.",
  };
};

export const listManagedSessions = async (input?: string, cwd = process.cwd()) => {
  if (input) {
    const resolved = await resolveOpenInput(cwd, input);
    const session = await readSession(sessionFileForInput(resolved));
    const current = session ? await health(session) : null;
    return session && current ? [{ ...session, runtimeReady: current.runtimeReady }] : [];
  }
  let names: string[];
  try {
    names = await readdir(SESSION_ROOT);
  } catch {
    return [];
  }
  const sessions = await Promise.all(names.filter((name) => name.endsWith(".json")).map((name) =>
    readSession(join(SESSION_ROOT, name))
  ));
  const healthy = await Promise.all(sessions.map(async (session) => {
    const current = session ? await health(session) : null;
    return session && current ? { ...session, runtimeReady: current.runtimeReady } : null;
  }));
  return healthy.filter((session): session is ManagedSessionRecord & { runtimeReady: boolean } => !!session);
};

export const closeManagedSessions = async (input?: string, cwd = process.cwd()) => {
  const sessions = await listManagedSessions(input, cwd);
  await Promise.all(sessions.map(async (session) => {
    const response = await fetch(new URL("close", `${session.url}/`), {
      method: "POST",
      signal: AbortSignal.timeout(1_000),
    });
    if (!response.ok) {
      throw new CharDeskCliCommandError("close-failed", `Could not close ${session.input}.`);
    }
    await waitFor(async () => await health(session) ? null : true, 3_000);
    await rm(sessionFileForInput(session.input), { force: true });
  }));
  return sessions.length;
};
