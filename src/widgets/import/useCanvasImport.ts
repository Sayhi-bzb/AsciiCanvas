import { useRef, useState, type ChangeEvent } from "react";
import { useCanvasRuntime } from "@/domains/canvas/public";
import { useBlackboardRuntimeOptional } from "@/domains/blackboard/public";
import { feedback } from "@/shared/services/effects";
import { useUiI18n } from "@/shared/i18n";
import { readBlackboardDirectory } from "./blackboard-directory";

export function useCanvasImport() {
  const canvas = useCanvasRuntime();
  const blackboard = useBlackboardRuntimeOptional();
  const { t } = useUiI18n();
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const directoryInputRef = useRef<HTMLInputElement | null>(null);
  const importCanvasSession = canvas.commands.sessions.import;
  const [isImporting, setIsImporting] = useState(false);

  const openFilePicker = () => {
    if (isImporting) return;
    fileInputRef.current?.click();
  };

  const openBlackboardPicker = () => {
    if (isImporting) return;
    directoryInputRef.current?.click();
  };

  const reportFailure = (error: unknown) => {
    feedback.error(t("import.failed"), {
      description:
        error instanceof Error
          ? error.message
          : t("import.failedDescription"),
    });
  };

  const handleFileChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";

    if (!file) return;

    setIsImporting(true);
    try {
      const raw = await file.text();
      await importCanvasSession(raw, {
        name: file.name.replace(/\.(?:slides\.md|chardesk|ans|txt|md)$/i, ""),
        sourceName: file.name,
      });
    } catch (error) {
      reportFailure(error);
    } finally {
      setIsImporting(false);
    }
  };

  const handleBlackboardDirectoryChange = async (
    event: ChangeEvent<HTMLInputElement>,
  ) => {
    const files = Array.from(event.target.files ?? []);
    event.target.value = "";
    if (files.length === 0) return;

    setIsImporting(true);
    try {
      if (!blackboard) throw new Error("Blackboard runtime is unavailable.");
      const imported = await readBlackboardDirectory(files);
      const workspace = await blackboard.repository.createWorkspace({
        title: imported.compiled.title,
      });
      await blackboard.repository.apply(
        workspace.workspace.id,
        [
          ...workspace.files.map(({ path }) => ({ op: "delete" as const, path })),
          ...[...imported.sourceTree].map(([path, content]) => ({
            op: "write" as const,
            path,
            content,
          })),
        ],
        workspace.workspace.revision,
      );
      canvas.commands.sessions.create("blackboard", {
        blackboardWorkspaceId: workspace.workspace.id,
        name: imported.compiled.title,
      });
    } catch (error) {
      reportFailure(error);
    } finally {
      setIsImporting(false);
    }
  };

  return {
    directoryInputRef,
    fileInputRef,
    handleBlackboardDirectoryChange,
    handleFileChange,
    isImporting,
    openBlackboardPicker,
    openFilePicker,
  };
}
