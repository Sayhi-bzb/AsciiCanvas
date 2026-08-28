import { mkdtemp, mkdir, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { resolveWorkspaceBoardPath } from "./paths.js";
import { startBlackboardServer } from "./server.js";

const roots: string[] = [];
const close: Array<() => Promise<void>> = [];

afterEach(async () => {
  await Promise.all(close.splice(0).map((stop) => stop()));
  await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

const fixture = async () => {
  const root = await mkdtemp(join(tmpdir(), "chardesk-blackboard-server-"));
  const client = join(root, "app");
  roots.push(root);
  await mkdir(client);
  await writeFile(join(client, "index.html"), "<!doctype html><title>Blackboard</title>");
  const board = await resolveWorkspaceBoardPath(root, "blackboard.chardesk");
  const running = await startBlackboardServer({ board, port: 0, appRoot: client });
  close.push(running.close);
  return { root, board, running };
};

describe("Blackboard Reader", () => {
  it("serves a missing board, revisions, and unchanged responses", async () => {
    const { board, running } = await fixture();
    expect((await fetch(`${running.url}/board`)).status).toBe(404);

    const source = "[1;32m登录[0m 👩‍💻";
    await writeFile(board.path, source);
    const current = await fetch(`${running.url}/board`);
    expect(current.status).toBe(200);
    expect(current.headers.get("content-type")).toBe("text/plain; charset=utf-8");
    expect(current.headers.get("etag")).toMatch(/^"[0-9a-f]{64}"$/);
    expect(current.headers.get("x-chardesk-source-name")).toBe("blackboard.chardesk");
    expect(await current.text()).toBe(source);

    const unchanged = await fetch(`${running.url}/board`, {
      headers: { "If-None-Match": current.headers.get("etag")! },
    });
    expect(unchanged.status).toBe(304);

    await writeFile(board.path, "[999mcurrent source[0m");
    const diagnostic = await fetch(`${running.url}/board`, {
      headers: { "If-None-Match": current.headers.get("etag")! },
    });
    expect(diagnostic.status).toBe(200);
    expect(diagnostic.headers.get("etag")).not.toBe(current.headers.get("etag"));
    expect(await diagnostic.text()).toBe("[999mcurrent source[0m");
  });

  it("serves only the body of a canonical freeform document", async () => {
    const { board, running } = await fixture();
    await writeFile(board.path, [
      "---",
      "chardesk: document/v1",
      "mode: freeform",
      "title: Board",
      "---",
      "[32mBody[0m",
    ].join("\n"));

    const response = await fetch(`${running.url}/board`);
    expect(response.status).toBe(200);
    expect(await response.text()).toBe("[32mBody[0m");

    await writeFile(board.path, [
      "---",
      "chardesk: document/v1",
      "mode: slide",
      "---",
      "## Slide",
    ].join("\n"));
    expect((await fetch(`${running.url}/board`)).status).toBe(422);
  });

  it("serves the page and rejects writes and static traversal", async () => {
    const { running } = await fixture();
    const rootResponse = await fetch(running.url, { redirect: "manual" });
    expect(rootResponse.status).toBe(307);
    expect(rootResponse.headers.get("location")).toBe("/blackboard");
    expect(await (await fetch(`${running.url}/blackboard`)).text()).toContain("Blackboard");
    expect((await fetch(`${running.url}/board`, { method: "POST" })).status).toBe(405);
    expect((await fetch(`${running.url}/%2e%2e/package.json`)).status).toBe(404);
  });

  it("rejects a board symlink that escapes after startup", async () => {
    const { root, board, running } = await fixture();
    const outside = await mkdtemp(join(tmpdir(), "chardesk-blackboard-outside-"));
    roots.push(outside);
    const target = join(outside, "outside.chardesk");
    await writeFile(target, "outside");
    await symlink(target, board.path);
    expect((await fetch(`${running.url}/board`)).status).toBe(403);
    expect(root).not.toBe(outside);
  });

  it("serves a package as one canonical freeform projection and tracks panel revisions", async () => {
    const root = await mkdtemp(join(tmpdir(), "chardesk-blackboard-package-server-"));
    const client = join(root, "app");
    const boardRoot = join(root, "gpu");
    roots.push(root);
    await mkdir(client);
    await mkdir(join(boardRoot, "panels"), { recursive: true });
    await writeFile(join(client, "index.html"), "<!doctype html><title>Blackboard</title>");
    await writeFile(join(boardRoot, "blackboard.yaml"), `
chardesk: blackboard/v1
title: GPU
panels:
  left: { source: panels/left.panel }
  right: { source: panels/right.panel }
layout:
  areas: [[left, right]]
  gap: { column: 1, row: 0 }
`);
    await writeFile(join(boardRoot, "panels/left.panel"), "L");
    await writeFile(join(boardRoot, "panels/right.panel"), "R");
    const board = await resolveWorkspaceBoardPath(root, "gpu");
    const running = await startBlackboardServer({ board, port: 0, appRoot: client });
    close.push(running.close);

    const first = await fetch(`${running.url}/board`);
    expect(first.status).toBe(200);
    expect(first.headers.get("x-chardesk-source-name")).toBe("blackboard.chardesk");
    expect(await first.text()).toBe([
      "---",
      "chardesk: document/v1",
      "mode: freeform",
      "title: GPU",
      "---",
      "L R",
    ].join("\n"));

    await writeFile(join(boardRoot, "panels/right.panel"), "RR");
    const revised = await fetch(`${running.url}/board`, {
      headers: { "If-None-Match": first.headers.get("etag")! },
    });
    expect(revised.status).toBe(200);
    expect(revised.headers.get("etag")).not.toBe(first.headers.get("etag"));
    expect(await revised.text()).toContain("L RR");
  });
});
