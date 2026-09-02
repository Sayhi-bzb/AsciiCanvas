import { Writable } from "node:stream";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { openManagedSession, listManagedSessions } = vi.hoisted(() => ({
  openManagedSession: vi.fn(),
  listManagedSessions: vi.fn(),
}));

vi.mock("./open.js", () => ({
  closeManagedSessions: vi.fn(),
  launchCharDeskOpenSession: vi.fn(),
  listManagedSessions,
  openManagedSession,
  serveManagedOpenSession: vi.fn(),
  startCharDeskOpenSession: vi.fn(),
  waitForOpenSession: vi.fn(),
}));

import { runCli } from "./command.js";

const capture = () => {
  let text = "";
  const stream = new Writable({
    write(chunk, _encoding, callback) {
      text += chunk.toString();
      callback();
    },
  });
  return { stream, text: () => text };
};

const streams = () => {
  const stdout = capture();
  const stderr = capture();
  return {
    value: {
      stdin: (async function* () { yield ""; })(),
      stdout: stdout.stream,
      stderr: stderr.stream,
    },
    stdout: stdout.text,
    stderr: stderr.text,
  };
};

const session = {
  version: 4,
  runtimeVersion: 2,
  cliVersion: "0.3.4",
  sessionId: "session-id",
  pid: 42,
  input: "/workspace/blackboard.yaml",
  url: "http://127.0.0.1:61491/s/0123456789abcdefABCDEF/",
  startedAt: 1,
  lastActivityAt: 2,
  idleExpiresAt: 3,
  status: "opened",
  runtimeReady: true,
};

describe("chardesk open output", () => {
  beforeEach(() => {
    openManagedSession.mockReset().mockResolvedValue(session);
    listManagedSessions.mockReset().mockResolvedValue([session]);
  });

  it("keeps the capability URL out of a successful browser launch", async () => {
    const io = streams();
    expect(await runCli(["open", "board"], io.value)).toBe(0);
    expect(io.stdout()).toBe("Opened CharDesk. Source updates are live.\n");
    expect(io.stderr()).toBe("");
  });

  it("returns the short URL when browser launch is disabled", async () => {
    const io = streams();
    expect(await runCli(["open", "board", "--no-browser"], io.value)).toBe(0);
    expect(io.stdout()).toBe(`${session.url}\n`);
  });

  it("projects internal session records to the public JSON contract", async () => {
    const opened = streams();
    expect(await runCli(["open", "board", "--json"], opened.value)).toBe(0);
    expect(JSON.parse(opened.stdout())).toEqual({
      status: "opened",
      input: session.input,
      url: session.url,
      runtimeReady: true,
      watching: true,
    });

    const status = streams();
    expect(await runCli(["status", "--json"], status.value)).toBe(0);
    expect(JSON.parse(status.stdout())).toEqual({
      status: "ok",
      sessions: [{
        input: session.input,
        url: session.url,
        runtimeReady: true,
        startedAt: 1,
        idleExpiresAt: 3,
      }],
    });
  });
});
