import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { feedback } from "@/shared/services/effects";
import { useCanvasImport } from "./useCanvasImport";

const {
  applyWorkspace,
  createCanvasSession,
  createWorkspace,
  importCanvasSession,
  readBlackboardDirectory,
} = vi.hoisted(() => ({
  applyWorkspace: vi.fn(),
  createCanvasSession: vi.fn(),
  createWorkspace: vi.fn(),
  importCanvasSession: vi.fn(),
  readBlackboardDirectory: vi.fn(),
}));

vi.mock("@/domains/canvas/public", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/domains/canvas/public")>()),
  useCanvasRuntime: () => ({
    commands: { sessions: { create: createCanvasSession, import: importCanvasSession } },
  }),
}));

vi.mock("@/domains/blackboard/public", () => ({
  useBlackboardRuntimeOptional: () => ({
    repository: { apply: applyWorkspace, createWorkspace },
  }),
}));

vi.mock("./blackboard-directory", () => ({ readBlackboardDirectory }));

const createFileEvent = (text: () => Promise<string>) =>
  ({
    target: {
      files: [{ name: "demo.chardesk", text }],
      value: "/demo.chardesk",
    },
  }) as unknown as React.ChangeEvent<HTMLInputElement>;

const createDirectoryEvent = () => {
  const selectedFile = {
    webkitRelativePath: "gpu/blackboard.yaml",
  } as File;
  let value = "/gpu";
  const files = {
    get length() {
      return value ? 1 : 0;
    },
    item(index: number) {
      return value && index === 0 ? selectedFile : null;
    },
    *[Symbol.iterator]() {
      if (value) yield selectedFile;
    },
  } as FileList;
  const target = {
    get files() {
      return files;
    },
    get value() {
      return value;
    },
    set value(next: string) {
      value = next;
    },
  } as HTMLInputElement;

  return { target } as React.ChangeEvent<HTMLInputElement>;
};

describe("useCanvasImport", () => {
  beforeEach(() => {
    importCanvasSession.mockReset();
    readBlackboardDirectory.mockReset();
    createCanvasSession.mockReset();
    createWorkspace.mockReset();
    applyWorkspace.mockReset();
    vi.spyOn(feedback, "success").mockImplementation(() => undefined);
    vi.spyOn(feedback, "error").mockImplementation(() => undefined);
  });

  it("uses the created session as success feedback without opening a toast", async () => {
    importCanvasSession.mockReturnValue({ name: "demo" });
    const { result } = renderHook(() => useCanvasImport());

    await act(async () => {
      await result.current.handleFileChange(createFileEvent(async () => "hello"));
    });

    expect(importCanvasSession).toHaveBeenCalledWith("hello", {
      name: "demo",
      sourceName: "demo.chardesk",
    });
    expect(feedback.success).not.toHaveBeenCalled();
  });

  it("keeps import failures as global feedback", async () => {
    importCanvasSession.mockImplementation(() => {
      throw new Error("Invalid document");
    });
    const { result } = renderHook(() => useCanvasImport());

    await act(async () => {
      await result.current.handleFileChange(createFileEvent(async () => "invalid"));
    });

    expect(feedback.error).toHaveBeenCalledWith("Import failed", {
      description: "Invalid document",
    });
  });

  it("imports a Blackboard directory as a source-authoritative mode", async () => {
    readBlackboardDirectory.mockResolvedValue({
      compiled: { title: "GPU", source: "L R", warnings: [] },
      sourceTree: new Map([
        ["blackboard.yaml", "manifest"],
        ["panels/main.panel", "L R"],
      ]),
    });
    createWorkspace.mockResolvedValue({
      workspace: { id: "workspace-1", title: "GPU", revision: 1 },
      files: [{ path: "blackboard.yaml", content: "starter" }],
    });
    const { result } = renderHook(() => useCanvasImport());

    await act(async () => {
      await result.current.handleBlackboardDirectoryChange(createDirectoryEvent());
    });

    expect(readBlackboardDirectory).toHaveBeenCalledWith([
      expect.objectContaining({ webkitRelativePath: "gpu/blackboard.yaml" }),
    ]);
    expect(applyWorkspace).toHaveBeenCalledWith(
      "workspace-1",
      [
        { op: "delete", path: "blackboard.yaml" },
        { op: "write", path: "blackboard.yaml", content: "manifest" },
        { op: "write", path: "panels/main.panel", content: "L R" },
      ],
      1,
    );
    expect(createCanvasSession).toHaveBeenCalledWith("blackboard", {
      blackboardWorkspaceId: "workspace-1",
      name: "GPU",
    });
  });

  it("reports Blackboard directory failures through existing import feedback", async () => {
    readBlackboardDirectory.mockRejectedValue(new Error("Missing blackboard.yaml"));
    const { result } = renderHook(() => useCanvasImport());

    await act(async () => {
      await result.current.handleBlackboardDirectoryChange(createDirectoryEvent());
    });

    expect(feedback.error).toHaveBeenCalledWith("Import failed", {
      description: "Missing blackboard.yaml",
    });
    expect(importCanvasSession).not.toHaveBeenCalled();
  });
});
