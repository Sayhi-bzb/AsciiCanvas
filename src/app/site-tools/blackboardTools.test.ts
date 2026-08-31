// @vitest-environment jsdom
import "fake-indexeddb/auto";
import { afterEach, describe, expect, it } from "vitest";
import {
  BlackboardRuntime,
  IndexedDbBlackboardRepository,
} from "@/domains/blackboard/public";
import {
  BLACKBOARD_UNAVAILABLE_RESULT,
  createBlackboardAgentTools,
} from "./blackboardTools";

describe("Blackboard agent tools", () => {
  const disposals: Array<() => Promise<void>> = [];
  afterEach(async () => Promise.all(disposals.splice(0).map((dispose) => dispose())));

  it("uses the workspace that is active at execution time", async () => {
    const repository = new IndexedDbBlackboardRepository({
      databaseName: `agent-tools-${crypto.randomUUID()}`,
    });
    await repository.createWorkspace({ id: "first", title: "First" });
    await repository.createWorkspace({ id: "second", title: "Second" });
    disposals.push(async () => repository.close());
    let activeWorkspaceId: string | null = "first";
    const tools = createBlackboardAgentTools({
      blackboard: new BlackboardRuntime(repository),
      resolveActiveWorkspaceId: () => activeWorkspaceId,
    });
    const byName = new Map(tools.map((tool) => [tool.name, tool]));

    await byName.get("write_file")!.execute({
      path: "panels/active.panel",
      content: "First content",
    });
    activeWorkspaceId = "second";
    await byName.get("write_file")!.execute({
      path: "panels/active.panel",
      content: "Second content",
    });

    expect(await byName.get("read_file")!.execute({ path: "panels/active.panel" }))
      .toMatchObject({ content: "Second content" });
    activeWorkspaceId = "first";
    expect(await byName.get("read_file")!.execute({ path: "panels/active.panel" }))
      .toMatchObject({ content: "First content" });
  });

  it("keeps tools discoverable when no browser workspace is editable", async () => {
    const repository = new IndexedDbBlackboardRepository({
      databaseName: `agent-tools-unavailable-${crypto.randomUUID()}`,
    });
    disposals.push(async () => repository.close());
    const tools = createBlackboardAgentTools({
      blackboard: new BlackboardRuntime(repository),
      resolveActiveWorkspaceId: () => null,
    });

    for (const tool of tools.filter(({ name }) => ![
      "list_workspaces",
      "create_workspace",
    ].includes(name))) {
      const input = tool.name === "read_file" || tool.name === "delete_file"
        ? { path: "panels/example.panel" }
        : tool.name === "write_file"
          ? { path: "panels/example.panel", content: "Example" }
          : tool.name === "apply_patch"
            ? { operations: [{ op: "write", path: "panels/example.panel", content: "Example" }] }
            : {};
      expect(await tool.execute(input)).toEqual(BLACKBOARD_UNAVAILABLE_RESULT);
    }
  });

  it("creates, lists, and edits an explicit workspace without an active canvas", async () => {
    const repository = new IndexedDbBlackboardRepository({
      databaseName: `agent-tools-origin-${crypto.randomUUID()}`,
    });
    disposals.push(async () => repository.close());
    const tools = createBlackboardAgentTools({
      blackboard: new BlackboardRuntime(repository),
      resolveActiveWorkspaceId: () => null,
    });
    const byName = new Map(tools.map((tool) => [tool.name, tool]));

    const created = await byName.get("create_workspace")!.execute({ title: "Agent board" });
    expect(created).toMatchObject({
      title: "Agent board",
      revision: 1,
      url: expect.stringMatching(/^\/blackboard\?workspace=/),
    });
    const workspaceId = (created as { workspaceId: string }).workspaceId;

    expect(await byName.get("list_workspaces")!.execute({})).toMatchObject({
      workspaces: [expect.objectContaining({
        id: workspaceId,
        title: "Agent board",
        url: `/blackboard?workspace=${encodeURIComponent(workspaceId)}`,
      })],
    });
    await byName.get("write_file")!.execute({
      workspaceId,
      path: "panels/agent.panel",
      content: "Created from the origin",
    });
    expect(await byName.get("read_file")!.execute({
      workspaceId,
      path: "panels/agent.panel",
    })).toMatchObject({
      workspaceId,
      content: "Created from the origin",
    });
    expect(await byName.get("check")!.execute({ workspaceId }))
      .toMatchObject({ ok: true, workspaceId });
  });

  it("does not fall back when an explicit workspace does not exist", async () => {
    const repository = new IndexedDbBlackboardRepository({
      databaseName: `agent-tools-missing-${crypto.randomUUID()}`,
    });
    await repository.createWorkspace({ id: "active" });
    disposals.push(async () => repository.close());
    const tools = createBlackboardAgentTools({
      blackboard: new BlackboardRuntime(repository),
      resolveActiveWorkspaceId: () => "active",
    });
    const listFiles = tools.find(({ name }) => name === "list_files")!;

    expect(await listFiles.execute({ workspaceId: "missing" })).toEqual({
      ok: false,
      code: "workspace_not_found",
      workspaceId: "missing",
      message: "Blackboard workspace not found: missing",
    });
  });

  it("returns revision conflicts without changing the workspace", async () => {
    const repository = new IndexedDbBlackboardRepository({
      databaseName: `agent-tools-conflict-${crypto.randomUUID()}`,
    });
    const source = await repository.createWorkspace({ id: "board" });
    disposals.push(async () => repository.close());
    const tools = createBlackboardAgentTools({
      blackboard: new BlackboardRuntime(repository),
      resolveActiveWorkspaceId: () => "board",
    });
    const write = tools.find(({ name }) => name === "write_file")!;

    expect(await write.execute({
      path: "panels/conflict.panel",
      content: "Stale",
      baseRevision: source.workspace.revision - 1,
    })).toEqual({
      ok: false,
      code: "revision_conflict",
      currentRevision: source.workspace.revision,
    });
    expect(await repository.readWorkspace("board"))
      .not.toMatchObject({ files: expect.arrayContaining([
        expect.objectContaining({ path: "panels/conflict.panel" }),
      ]) });
  });
});
