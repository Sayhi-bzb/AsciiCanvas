import { compileBlackboardSourceTree } from "@chardesk/blackboard";
import { parseDocumentSessionSource } from "@/domains/document/public";
import type { CanvasImportSnapshot } from "@/domains/sessions/public";
import type { BlackboardWorkspaceRepository } from "./repository";

export type BlackboardCompilation = Readonly<{
  workspaceId: string;
  revision: number;
  title: string;
  warnings: readonly string[];
  snapshot: Extract<CanvasImportSnapshot, { mode: "freeform" }>;
}>;

export class BlackboardRuntime {
  readonly repository: BlackboardWorkspaceRepository;

  constructor(repository: BlackboardWorkspaceRepository) {
    this.repository = repository;
  }

  async compile(workspaceId: string): Promise<BlackboardCompilation> {
    const source = await this.repository.readWorkspace(workspaceId);
    if (!source) throw new Error(`Blackboard workspace not found: ${workspaceId}`);
    const compiled = await compileBlackboardSourceTree(
      source.files.map(({ path, content }) => ({ path, content })),
      source.workspace.title,
    );
    const snapshot = await parseDocumentSessionSource(compiled.source, {
      sourceName: "blackboard.chardesk",
    });
    if (snapshot.mode !== "freeform") {
      throw new Error(`Blackboard compiler produced ${snapshot.mode} content.`);
    }
    return {
      workspaceId,
      revision: source.workspace.revision,
      title: compiled.title,
      warnings: compiled.warnings.map(({ message }) => message),
      snapshot,
    };
  }
}
