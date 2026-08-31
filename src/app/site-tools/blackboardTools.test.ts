// @vitest-environment jsdom
import "fake-indexeddb/auto";
import { afterEach, describe, expect, it } from "vitest";
import {
  BlackboardRuntime,
  IndexedDbBlackboardRepository,
} from "@/domains/blackboard/public";
import {
  BLACKBOARD_AGENT_TOOL_NAMES,
  createBlackboardAgentTools,
} from "./blackboardTools";

describe("Blackboard agent tools", () => {
  const disposals: Array<() => Promise<void>> = [];
  afterEach(async () => Promise.all(disposals.splice(0).map((dispose) => dispose())));

  const createTools = (databaseName: string) => {
    const repository = new IndexedDbBlackboardRepository({ databaseName });
    disposals.push(async () => repository.close());
    const tools = createBlackboardAgentTools({
      blackboard: new BlackboardRuntime(repository),
    });
    return { repository, tools, byName: new Map(tools.map((tool) => [tool.name, tool])) };
  };

  it("uses one namespaced public contract with human-readable titles", () => {
    const { tools } = createTools(`agent-tools-contract-${crypto.randomUUID()}`);

    expect(tools.map(({ name }) => name)).toEqual(Object.values(BLACKBOARD_AGENT_TOOL_NAMES));
    expect(tools.every(({ title }) => Boolean(title))).toBe(true);
    expect(tools.some(({ name }) => name === "apply_patch")).toBe(false);
  });

  it("requires an explicit workspace for workspace-scoped commands", async () => {
    const { byName } = createTools(`agent-tools-target-${crypto.randomUUID()}`);

    await expect(byName.get(BLACKBOARD_AGENT_TOOL_NAMES.listFiles)!.execute({}))
      .rejects.toThrow("workspaceId must be a string");
  });

  it("isolates explicitly selected workspaces", async () => {
    const { repository, byName } = createTools(`agent-tools-${crypto.randomUUID()}`);
    await repository.createWorkspace({ id: "first", title: "First" });
    await repository.createWorkspace({ id: "second", title: "Second" });
    const write = byName.get(BLACKBOARD_AGENT_TOOL_NAMES.writeFile)!;
    const read = byName.get(BLACKBOARD_AGENT_TOOL_NAMES.readFile)!;

    await write.execute({
      workspaceId: "first",
      path: "panels/active.panel",
      content: "First content",
    });
    await write.execute({
      workspaceId: "second",
      path: "panels/active.panel",
      content: "Second content",
    });

    await expect(read.execute({ workspaceId: "first", path: "panels/active.panel" }))
      .resolves.toMatchObject({ workspaceId: "first", content: "First content" });
    await expect(read.execute({ workspaceId: "second", path: "panels/active.panel" }))
      .resolves.toMatchObject({ workspaceId: "second", content: "Second content" });
  });

  it("creates, lists, edits, and checks a workspace without an active canvas", async () => {
    const { byName } = createTools(`agent-tools-origin-${crypto.randomUUID()}`);

    const created = await byName.get(BLACKBOARD_AGENT_TOOL_NAMES.createWorkspace)!
      .execute({ title: "Agent board" });
    expect(created).toMatchObject({
      title: "Agent board",
      revision: 1,
      url: expect.stringMatching(/^\/blackboard\?workspace=/),
    });
    const workspaceId = (created as { workspaceId: string }).workspaceId;

    await expect(byName.get(BLACKBOARD_AGENT_TOOL_NAMES.listWorkspaces)!.execute({}))
      .resolves.toMatchObject({
        workspaces: [expect.objectContaining({
          id: workspaceId,
          title: "Agent board",
          url: `/blackboard?workspace=${encodeURIComponent(workspaceId)}`,
        })],
      });
    await byName.get(BLACKBOARD_AGENT_TOOL_NAMES.writeFile)!.execute({
      workspaceId,
      path: "panels/agent.panel",
      content: "Created from the origin",
    });
    await expect(byName.get(BLACKBOARD_AGENT_TOOL_NAMES.readFile)!.execute({
      workspaceId,
      path: "panels/agent.panel",
    })).resolves.toMatchObject({ workspaceId, content: "Created from the origin" });
    await expect(byName.get(BLACKBOARD_AGENT_TOOL_NAMES.check)!.execute({ workspaceId }))
      .resolves.toMatchObject({ ok: true, workspaceId });
  });

  it("returns a structured error when the explicit workspace does not exist", async () => {
    const { byName } = createTools(`agent-tools-missing-${crypto.randomUUID()}`);

    await expect(byName.get(BLACKBOARD_AGENT_TOOL_NAMES.listFiles)!.execute({
      workspaceId: "missing",
    })).resolves.toEqual({
      ok: false,
      code: "workspace_not_found",
      workspaceId: "missing",
      message: "Blackboard workspace not found: missing",
    });
  });

  it("returns revision conflicts without changing the workspace", async () => {
    const { repository, byName } = createTools(`agent-tools-conflict-${crypto.randomUUID()}`);
    const source = await repository.createWorkspace({ id: "board" });
    const write = byName.get(BLACKBOARD_AGENT_TOOL_NAMES.writeFile)!;

    await expect(write.execute({
      workspaceId: "board",
      path: "panels/conflict.panel",
      content: "Stale",
      baseRevision: source.workspace.revision - 1,
    })).resolves.toEqual({
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
