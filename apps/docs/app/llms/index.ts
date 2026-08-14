import { llms } from "fumadocs-core/source";
import { docsHeadMarkdown } from "@/lib/docs-head";
import { publicDevelopmentSource } from "@/lib/source";

export function loader() {
  const index = llms(publicDevelopmentSource)
    .index()
    .replace(/^# Docs/, "# CharDesk Development Documentation")
    .replace(
      /^# CharDesk Development Documentation$/m,
      `$&\n\n${docsHeadMarkdown()}`
    );

  return new Response(index, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
    },
  });
}
