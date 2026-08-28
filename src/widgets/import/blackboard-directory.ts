import {
  BlackboardPackageError,
  compileBlackboard,
  type CompiledBlackboard,
} from "@chardesk/blackboard";

const ROOT_MANIFEST = "blackboard.yaml";

type DirectoryFile = Pick<File, "text" | "webkitRelativePath">;

export const compileBlackboardDirectory = async (
  selected: Iterable<DirectoryFile>,
): Promise<CompiledBlackboard> => {
  const files = [...selected];
  if (files.length === 0) {
    throw new BlackboardPackageError("invalid-manifest", "Choose a Blackboard directory.");
  }
  const entries = new Map<string, DirectoryFile>();
  let rootName: string | undefined;
  files.forEach((file) => {
    const segments = file.webkitRelativePath.split("/");
    if (segments.length < 2 || segments.some((segment) => segment.length === 0)) {
      throw new BlackboardPackageError(
        "invalid-manifest",
        "Choose the Blackboard directory instead of individual files.",
      );
    }
    const [currentRoot, ...relativeSegments] = segments;
    if (rootName !== undefined && currentRoot !== rootName) {
      throw new BlackboardPackageError(
        "invalid-manifest",
        "A Blackboard import must come from one directory.",
      );
    }
    rootName = currentRoot;
    const relativePath = relativeSegments.join("/");
    if (entries.has(relativePath)) {
      throw new BlackboardPackageError(
        "invalid-manifest",
        `Blackboard directory contains duplicate path ${JSON.stringify(relativePath)}.`,
      );
    }
    entries.set(relativePath, file);
  });

  const manifest = entries.get(ROOT_MANIFEST);
  if (!manifest) {
    throw new BlackboardPackageError(
      "invalid-manifest",
      `Selected directory must contain ${ROOT_MANIFEST} at its root.`,
    );
  }
  return compileBlackboard({
    manifestSource: await manifest.text(),
    fallbackTitle: rootName!,
    readPanel: async ({ id, source }) => {
      const panel = entries.get(source);
      if (!panel) {
        throw new BlackboardPackageError(
          "missing-panel",
          `Panel ${JSON.stringify(id)} source does not exist: ${source}`,
          id,
        );
      }
      return panel.text();
    },
  });
};
