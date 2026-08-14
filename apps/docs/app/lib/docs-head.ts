import metadata from "../../content/docs-head.json";

const commitPattern = /^[0-9a-f]{40}$/;

if (!commitPattern.test(metadata.head)) {
  throw new Error(
    "apps/docs/content/docs-head.json must contain a full lowercase Git commit SHA"
  );
}

export const DOCS_HEAD = metadata.head;
export const DOCS_HEAD_SHORT = DOCS_HEAD.slice(0, 7);
export const DOCS_HEAD_URL = `https://github.com/Sayhi-bzb/CharDesk/commit/${DOCS_HEAD}`;

export const docsHeadMarkdown = () =>
  `Docs HEAD: [${DOCS_HEAD}](${DOCS_HEAD_URL})`;
