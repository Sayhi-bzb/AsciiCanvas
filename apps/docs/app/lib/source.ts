import { loader } from "fumadocs-core/source";
import { defineDocs } from "fumadocs-mdx/macro";
import { docsHeadMarkdown } from "@/lib/docs-head";

export const docs = defineDocs({
  dir: "content/docs",
  docs: {
    async: true,
    postprocess: {
      includeProcessedMarkdown: true,
    },
  },
});

const docsSource = docs.toFumadocsSource();
const developmentDocsSource = {
  ...docsSource,
  files: docsSource.files.filter((file) =>
    file.path.startsWith("development/")
  ),
};

export const source = loader({
  source: docsSource,
  baseUrl: "/",
});

export const developmentSource = loader({
  source: developmentDocsSource,
  baseUrl: "/",
});

export const publicDevelopmentSource = loader({
  source: developmentDocsSource,
  baseUrl: "/docs",
});

export async function getLLMText(
  page: (typeof publicDevelopmentSource)["$inferPage"]
) {
  const processed = await page.data.getText("processed");

  return `# ${page.data.title} (${page.url})\n\n${docsHeadMarkdown()}\n\n${processed}`;
}
