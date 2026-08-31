// @vitest-environment jsdom
import "fake-indexeddb/auto";
import { renderHook, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import type { ReactNode } from "react";
import {
  BlackboardRuntimeProvider,
  IndexedDbBlackboardRepository,
} from "@/domains/blackboard/public";
import { CanvasRuntimeProvider } from "@/domains/canvas/public";
import { createApplicationEditorHost } from "./compositionRoot";
import { useBlackboardWorkspace } from "./useBlackboardWorkspace";

const manifest = `chardesk: blackboard/v1
title: Agent Board
panels:
  main:
    source: panels/main.panel
layout:
  areas:
    - [main]
`;

describe("Blackboard workspace projection", () => {
  const disposals: Array<() => Promise<void>> = [];
  afterEach(async () => Promise.all(disposals.splice(0).map((dispose) => dispose())));

  it("projects source revisions and keeps the last valid surface on failure", async () => {
    const repository = new IndexedDbBlackboardRepository({
      databaseName: `workspace-hook-${crypto.randomUUID()}`,
    });
    const created = await repository.createWorkspace({ id: "board" });
    await repository.apply("board", [
      ...created.files.map(({ path }) => ({ op: "delete" as const, path })),
      { op: "write", path: "blackboard.yaml", content: manifest },
      { op: "write", path: "panels/main.panel", content: "A" },
    ], created.workspace.revision);
    const host = createApplicationEditorHost({
      blackboardRepository: repository,
      initialSessions: [{
        id: "canvas-board",
        name: "Board",
        mode: "blackboard",
        workspaceId: "board",
        scene: [],
        components: [],
        grid: [],
      }],
    });
    disposals.push(async () => {
      await host.dispose();
      await repository.close();
    });
    const wrapper = ({ children }: { children: ReactNode }) => (
      <BlackboardRuntimeProvider runtime={host.blackboard}>
        <CanvasRuntimeProvider runtime={host.canvas}>{children}</CanvasRuntimeProvider>
      </BlackboardRuntimeProvider>
    );
    const { result } = renderHook(() => useBlackboardWorkspace(), { wrapper });

    await waitFor(() => expect(result.current.status.state).toBe("current"));
    expect(host.canvas.getState().canvasMode).toBe("blackboard");
    expect(host.canvas.getState().grid.get("0,0")?.char).toBe("A");
    expect(host.canvas.getState().canvasSessions[0]).toMatchObject({
      mode: "blackboard",
      workspaceId: "board",
      grid: [],
    });
    const validGrid = host.canvas.getState().grid;

    await repository.apply("board", [
      { op: "write", path: "blackboard.yaml", content: "invalid" },
    ]);
    await waitFor(() => expect(result.current.status.state).toBe("warning"));
    expect(host.canvas.getState().grid).toBe(validGrid);
  });
});
