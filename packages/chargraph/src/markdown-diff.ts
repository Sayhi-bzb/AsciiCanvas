import { createCharGraphFragment } from "./fragments.js";
import type { MarkdownSyntaxExtension } from "./markdown-extension.js";
import type { CharGraphFragment } from "./model.js";

type DiffLineRole =
  | "diff-added"
  | "diff-deleted"
  | "diff-hunk"
  | "diff-metadata"
  | "diff-context";

const metadataLine = /^(?:diff --git |index |--- |\+\+\+ |(?:new|deleted) file mode |(?:old|new) mode |similarity index |rename (?:from|to) |Binary files |GIT binary patch|\\ No newline at end of file)/;

const lineRole = (line: string): DiffLineRole => {
  if (metadataLine.test(line)) return "diff-metadata";
  if (line.startsWith("@@")) return "diff-hunk";
  if (line.startsWith("+")) return "diff-added";
  if (line.startsWith("-")) return "diff-deleted";
  return "diff-context";
};

export const markdownDiffExtension: MarkdownSyntaxExtension = {
  id: "diff",
  fencedLanguages: ["diff", "patch"],
  render(request, context) {
    if (request.kind !== "fenced-code" || !context.enabled("diff")) return null;
    const fragments: CharGraphFragment[] = [];
    let offset = 0;
    const lines = request.source.split("\n");
    lines.forEach((line, index) => {
      const origin = {
        from: request.sourceOrigin.from + offset,
        to: request.sourceOrigin.from + offset + line.length,
      };
      if (line) {
        fragments.push(createCharGraphFragment(line, context.style(lineRole(line)), origin));
      }
      offset += line.length;
      if (index < lines.length - 1) {
        fragments.push(createCharGraphFragment("\n", {}, {
          from: request.sourceOrigin.from + offset,
          to: request.sourceOrigin.from + offset + 1,
        }));
        offset += 1;
      }
    });
    return { fragments, recognized: true, diagnostics: [] };
  },
};
