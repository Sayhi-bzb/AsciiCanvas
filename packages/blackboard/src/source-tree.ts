import {
  BlackboardPackageError,
  compileBlackboard,
  type CompiledBlackboard,
} from "./compiler.js";

export type BlackboardSourceTreeEntry = {
  path: string;
  content: string;
};

export type BlackboardSourceTree =
  | ReadonlyMap<string, string>
  | readonly BlackboardSourceTreeEntry[];

const ROOT_MANIFEST = "blackboard.yaml";

export const normalizeBlackboardPath = (path: string) => {
  const normalized = path.replace(/^\.\//u, "");
  const segments = normalized.split("/");
  if (
    normalized.length === 0 ||
    normalized.startsWith("/") ||
    normalized.includes("\\") ||
    /^[a-z]:/iu.test(normalized) ||
    segments.some((segment) => segment === "" || segment === "." || segment === "..")
  ) {
    throw new BlackboardPackageError(
      "invalid-panel-path",
      `Blackboard path must be package-relative POSIX text: ${JSON.stringify(path)}.`,
    );
  }
  return segments.join("/");
};

const toEntries = (tree: BlackboardSourceTree) => {
  const entries = new Map<string, string>();
  const sourceEntries: Iterable<readonly [string, string]> = Array.isArray(tree)
    ? tree.map(({ path, content }) => [path, content] as const)
    : (tree as ReadonlyMap<string, string>).entries();
  for (const [path, content] of sourceEntries) {
    const normalized = normalizeBlackboardPath(path);
    if (entries.has(normalized)) {
      throw new BlackboardPackageError(
        "invalid-manifest",
        `Blackboard source tree contains duplicate path ${JSON.stringify(normalized)}.`,
      );
    }
    entries.set(normalized, content);
  }
  return entries;
};

export const compileBlackboardSourceTree = async (
  tree: BlackboardSourceTree,
  fallbackTitle = "Blackboard",
): Promise<CompiledBlackboard> => {
  const entries = toEntries(tree);
  const manifestSource = entries.get(ROOT_MANIFEST);
  if (manifestSource === undefined) {
    throw new BlackboardPackageError(
      "invalid-manifest",
      `Blackboard source tree must contain ${ROOT_MANIFEST} at its root.`,
    );
  }
  return compileBlackboard({
    manifestSource,
    fallbackTitle,
    readPanel: async ({ id, source }) => {
      const normalized = normalizeBlackboardPath(source);
      const panel = entries.get(normalized);
      if (panel === undefined) {
        throw new BlackboardPackageError(
          "missing-panel",
          `Panel ${JSON.stringify(id)} source does not exist: ${normalized}`,
          id,
        );
      }
      return panel;
    },
  });
};
