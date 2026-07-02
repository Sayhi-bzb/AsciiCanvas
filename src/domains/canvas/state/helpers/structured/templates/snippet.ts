import type { StructuredComponentDefinition } from "../components/types";

export const SNIPPET_TEMPLATE: StructuredComponentDefinition = {
  id: "snippet",
  label: "Snippet",
  build: ({ createText }) => [
    createText("npm  pnpm  yarn  bun        ", { x: 0, y: 0 }, 0, undefined, undefined, "header"),
    createText("▔▔▔", { x: 0, y: 1 }, 1, undefined, undefined, "activeTab"),
    createText("npm install @xx/xx", { x: 0, y: 2 }, 2, undefined, undefined, "command"),
  ],
};
