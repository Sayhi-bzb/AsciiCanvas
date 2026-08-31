import { normalizeBlackboardPath } from "@chardesk/blackboard";
import {
  BlackboardRevisionConflictError,
  type BlackboardRuntime,
  type BlackboardWorkspaceOperation,
  type BlackboardWorkspaceSnapshot,
} from "@/domains/blackboard/public";
import type { AgentToolDefinition } from "./contracts";

type BlackboardAgentToolDependencies = Readonly<{
  blackboard: BlackboardRuntime;
}>;

export const BLACKBOARD_AGENT_TOOL_NAMES = {
  listWorkspaces: "chardesk_blackboard_list_workspaces",
  createWorkspace: "chardesk_blackboard_create_workspace",
  listFiles: "chardesk_blackboard_list_files",
  readFile: "chardesk_blackboard_read_file",
  writeFile: "chardesk_blackboard_write_file",
  applyPatch: "chardesk_blackboard_apply_patch",
  deleteFile: "chardesk_blackboard_delete_file",
  check: "chardesk_blackboard_check",
} as const;

const workspaceNotFound = (workspaceId: string) => ({
  ok: false as const,
  code: "workspace_not_found" as const,
  workspaceId,
  message: `Blackboard workspace not found: ${workspaceId}`,
});

const workspaceNotFoundOutputSchema = {
  type: "object",
  properties: {
    ok: { const: false },
    code: { const: "workspace_not_found" },
    workspaceId: { type: "string" },
    message: { type: "string" },
  },
  required: ["ok", "code", "workspaceId", "message"],
  additionalProperties: false,
} as const;

const mutationOutputSchema = {
  oneOf: [
    {
      type: "object",
      properties: {
        ok: { const: true },
        workspaceId: { type: "string" },
        revision: { type: "integer", minimum: 0 },
        changed: { type: "array", items: { type: "string" } },
      },
      required: ["ok", "workspaceId", "revision", "changed"],
      additionalProperties: false,
    },
    {
      type: "object",
      properties: {
        ok: { const: false },
        code: { const: "revision_conflict" },
        currentRevision: { type: "integer", minimum: 0 },
      },
      required: ["ok", "code", "currentRevision"],
      additionalProperties: false,
    },
    workspaceNotFoundOutputSchema,
  ],
} as const;

const withWorkspaceNotFound = (success: Readonly<Record<string, unknown>>) => ({
  oneOf: [success, workspaceNotFoundOutputSchema],
});

const workspaceInputProperty = {
  workspaceId: { type: "string", minLength: 1 },
} as const;

const requireString = (input: Record<string, unknown>, key: string) => {
  const value = input[key];
  if (typeof value !== "string") throw new Error(`${key} must be a string.`);
  return value;
};

const requirePath = (input: Record<string, unknown>) =>
  normalizeBlackboardPath(requireString(input, "path"));

const optionalRevision = (input: Record<string, unknown>) => {
  const value = input.baseRevision;
  if (value === undefined) return undefined;
  if (typeof value !== "number" || !Number.isInteger(value) || value < 0) {
    throw new Error("baseRevision must be a non-negative integer.");
  }
  return value;
};

const requireWorkspaceId = (input: Record<string, unknown>) => {
  const value = requireString(input, "workspaceId");
  if (!value.trim()) {
    throw new Error("workspaceId must be a non-empty string.");
  }
  return value.trim();
};

const optionalTitle = (input: Record<string, unknown>) => {
  const value = input.title;
  if (value === undefined) return undefined;
  if (typeof value !== "string" || !value.trim()) {
    throw new Error("title must be a non-empty string.");
  }
  return value.trim();
};

const workspaceUrl = (workspaceId: string) =>
  `/blackboard?workspace=${encodeURIComponent(workspaceId)}`;

type SelectedWorkspace = Readonly<{
  workspaceId: string;
  source: BlackboardWorkspaceSnapshot;
}>;

const isSelectedWorkspace = (
  value: SelectedWorkspace | ReturnType<typeof workspaceNotFound>,
): value is SelectedWorkspace => "source" in value;

export const createBlackboardAgentTools = ({
  blackboard,
}: BlackboardAgentToolDependencies): readonly AgentToolDefinition[] => {
  const selected = async (input: Record<string, unknown>): Promise<
    SelectedWorkspace | ReturnType<typeof workspaceNotFound>
  > => {
    const workspaceId = requireWorkspaceId(input);
    const source = await blackboard.repository.readWorkspace(workspaceId);
    if (!source) return workspaceNotFound(workspaceId);
    return { workspaceId, source };
  };

  const apply = async (
    workspaceId: string,
    operations: readonly BlackboardWorkspaceOperation[],
    baseRevision?: number,
  ) => {
    try {
      const next = await blackboard.repository.apply(
        workspaceId,
        operations,
        baseRevision,
      );
      return {
        ok: true,
        workspaceId,
        revision: next.workspace.revision,
        changed: operations.map(({ path }) => path),
      };
    } catch (error) {
      if (error instanceof BlackboardRevisionConflictError) {
        return {
          ok: false,
          code: "revision_conflict",
          currentRevision: error.currentRevision,
        };
      }
      throw error;
    }
  };

  return [
    {
      name: BLACKBOARD_AGENT_TOOL_NAMES.listWorkspaces,
      title: "List workspaces",
      description: "List CharDesk Blackboard workspaces stored in this browser origin.",
      inputSchema: { type: "object", properties: {}, additionalProperties: false },
      outputSchema: {
        type: "object",
        properties: {
          workspaces: {
            type: "array",
            items: {
              type: "object",
              properties: {
                id: { type: "string" },
                title: { type: "string" },
                revision: { type: "integer", minimum: 0 },
                createdAt: { type: "integer", minimum: 0 },
                updatedAt: { type: "integer", minimum: 0 },
                url: { type: "string" },
              },
              required: ["id", "title", "revision", "createdAt", "updatedAt", "url"],
              additionalProperties: false,
            },
          },
        },
        required: ["workspaces"],
        additionalProperties: false,
      },
      readOnly: true,
      execute: async () => ({
        workspaces: (await blackboard.repository.listWorkspaces()).map((workspace) => ({
          ...workspace,
          url: workspaceUrl(workspace.id),
        })),
      }),
    },
    {
      name: BLACKBOARD_AGENT_TOOL_NAMES.createWorkspace,
      title: "Create workspace",
      description: "Create a CharDesk Blackboard workspace in this browser origin.",
      inputSchema: {
        type: "object",
        properties: { title: { type: "string", minLength: 1 } },
        additionalProperties: false,
      },
      outputSchema: {
        type: "object",
        properties: {
          workspaceId: { type: "string" },
          title: { type: "string" },
          revision: { type: "integer", minimum: 0 },
          createdAt: { type: "integer", minimum: 0 },
          updatedAt: { type: "integer", minimum: 0 },
          url: { type: "string" },
        },
        required: ["workspaceId", "title", "revision", "createdAt", "updatedAt", "url"],
        additionalProperties: false,
      },
      execute: async (input) => {
        const { workspace } = await blackboard.repository.createWorkspace({
          title: optionalTitle(input),
        });
        return {
          workspaceId: workspace.id,
          title: workspace.title,
          revision: workspace.revision,
          createdAt: workspace.createdAt,
          updatedAt: workspace.updatedAt,
          url: workspaceUrl(workspace.id),
        };
      },
    },
    {
      name: BLACKBOARD_AGENT_TOOL_NAMES.listFiles,
      title: "List files",
      description: "List UTF-8 source files in a selected CharDesk Blackboard workspace.",
      inputSchema: {
        type: "object",
        properties: workspaceInputProperty,
        required: ["workspaceId"],
        additionalProperties: false,
      },
      outputSchema: withWorkspaceNotFound({
        type: "object",
        properties: {
          workspaceId: { type: "string" },
          revision: { type: "integer", minimum: 0 },
          files: { type: "array", items: { type: "string" } },
        },
        required: ["workspaceId", "revision", "files"],
        additionalProperties: false,
      }),
      readOnly: true,
      execute: async (input) => {
        const current = await selected(input);
        if (!isSelectedWorkspace(current)) return current;
        return {
          workspaceId: current.workspaceId,
          revision: current.source.workspace.revision,
          files: current.source.files.map(({ path }) => path),
        };
      },
    },
    {
      name: BLACKBOARD_AGENT_TOOL_NAMES.readFile,
      title: "Read file",
      description: "Read one UTF-8 source file from a selected CharDesk Blackboard workspace.",
      inputSchema: {
        type: "object",
        properties: { ...workspaceInputProperty, path: { type: "string" } },
        required: ["workspaceId", "path"],
        additionalProperties: false,
      },
      outputSchema: withWorkspaceNotFound({
        type: "object",
        properties: {
          path: { type: "string" },
          content: { type: "string" },
          revision: { type: "integer", minimum: 0 },
          workspaceId: { type: "string" },
        },
        required: ["path", "content", "revision", "workspaceId"],
        additionalProperties: false,
      }),
      readOnly: true,
      execute: async (input) => {
        const path = requirePath(input);
        const current = await selected(input);
        if (!isSelectedWorkspace(current)) return current;
        const file = current.source.files.find((candidate) => candidate.path === path);
        if (!file) throw new Error(`Blackboard file not found: ${path}`);
        return {
          path: file.path,
          content: file.content,
          revision: current.source.workspace.revision,
          workspaceId: current.workspaceId,
        };
      },
    },
    {
      name: BLACKBOARD_AGENT_TOOL_NAMES.writeFile,
      title: "Write file",
      description: "Create or replace one UTF-8 source file in a selected Blackboard workspace.",
      inputSchema: {
        type: "object",
        properties: {
          ...workspaceInputProperty,
          path: { type: "string" },
          content: { type: "string" },
          baseRevision: { type: "integer", minimum: 0 },
        },
        required: ["workspaceId", "path", "content"],
        additionalProperties: false,
      },
      outputSchema: mutationOutputSchema,
      execute: async (input) => {
        const path = requirePath(input);
        const content = requireString(input, "content");
        const current = await selected(input);
        if (!isSelectedWorkspace(current)) return current;
        return apply(current.workspaceId, [{ op: "write", path, content }], optionalRevision(input));
      },
    },
    {
      name: BLACKBOARD_AGENT_TOOL_NAMES.applyPatch,
      title: "Apply patch",
      description: "Atomically write, replace text in, or delete multiple Blackboard source files.",
      inputSchema: {
        type: "object",
        properties: {
          ...workspaceInputProperty,
          baseRevision: { type: "integer", minimum: 0 },
          operations: {
            type: "array",
            minItems: 1,
            items: {
              type: "object",
              properties: {
                op: { enum: ["write", "replace", "delete"] },
                path: { type: "string" },
                content: { type: "string" },
                oldText: { type: "string" },
                newText: { type: "string" },
              },
              required: ["op", "path"],
              additionalProperties: false,
            },
          },
        },
        required: ["workspaceId", "operations"],
        additionalProperties: false,
      },
      outputSchema: mutationOutputSchema,
      execute: async (input) => {
        if (!Array.isArray(input.operations) || input.operations.length === 0) {
          throw new Error("operations must be a non-empty array.");
        }
        const current = await selected(input);
        if (!isSelectedWorkspace(current)) return current;
        const byPath = new Map(
          current.source.files.map((file) => [file.path, file.content]),
        );
        const operations: BlackboardWorkspaceOperation[] = input.operations.map((raw) => {
          if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
            throw new Error("Each patch operation must be an object.");
          }
          const operation = raw as Record<string, unknown>;
          const op = requireString(operation, "op");
          const path = requirePath(operation);
          if (op === "delete") {
            byPath.delete(path);
            return { op, path };
          }
          if (op === "write") {
            const content = requireString(operation, "content");
            byPath.set(path, content);
            return { op, path, content };
          }
          if (op !== "replace") throw new Error(`Unsupported patch operation: ${op}`);
          const content = byPath.get(path);
          if (content === undefined) throw new Error(`Blackboard file not found: ${path}`);
          const oldText = requireString(operation, "oldText");
          const index = content.indexOf(oldText);
          if (index < 0 || content.indexOf(oldText, index + oldText.length) >= 0) {
            throw new Error(`oldText must match exactly once in ${path}.`);
          }
          const next = content.slice(0, index) +
            requireString(operation, "newText") +
            content.slice(index + oldText.length);
          byPath.set(path, next);
          return { op: "write", path, content: next };
        });
        return apply(current.workspaceId, operations, optionalRevision(input));
      },
    },
    {
      name: BLACKBOARD_AGENT_TOOL_NAMES.deleteFile,
      title: "Delete file",
      description: "Delete one source file from a selected CharDesk Blackboard workspace.",
      inputSchema: {
        type: "object",
        properties: {
          ...workspaceInputProperty,
          path: { type: "string" },
          baseRevision: { type: "integer", minimum: 0 },
        },
        required: ["workspaceId", "path"],
        additionalProperties: false,
      },
      outputSchema: mutationOutputSchema,
      execute: async (input) => {
        const path = requirePath(input);
        const current = await selected(input);
        if (!isSelectedWorkspace(current)) return current;
        return apply(current.workspaceId, [{ op: "delete", path }], optionalRevision(input));
      },
    },
    {
      name: BLACKBOARD_AGENT_TOOL_NAMES.check,
      title: "Check workspace",
      description: "Compile and validate a selected Blackboard workspace without changing it.",
      inputSchema: {
        type: "object",
        properties: workspaceInputProperty,
        required: ["workspaceId"],
        additionalProperties: false,
      },
      outputSchema: withWorkspaceNotFound({
        type: "object",
        properties: {
          ok: { const: true },
          workspaceId: { type: "string" },
          revision: { type: "integer", minimum: 0 },
          title: { type: "string" },
          warnings: { type: "array" },
        },
        required: ["ok", "workspaceId", "revision", "title", "warnings"],
        additionalProperties: false,
      }),
      readOnly: true,
      execute: async (input) => {
        const current = await selected(input);
        if (!isSelectedWorkspace(current)) return current;
        const compiled = await blackboard.compile(current.workspaceId);
        return {
          ok: true,
          workspaceId: current.workspaceId,
          revision: compiled.revision,
          title: compiled.title,
          warnings: compiled.warnings,
        };
      },
    },
  ];
};
