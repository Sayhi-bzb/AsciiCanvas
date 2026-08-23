/* eslint-disable react-refresh/only-export-components */
import { use } from "react";
import { useFumadocsLoader } from "fumadocs-core/source/client";
import { DocsLayout } from "fumadocs-ui/layouts/docs";
import {
  DocsBody,
  DocsDescription,
  DocsPage,
  DocsTitle,
} from "fumadocs-ui/layouts/docs/page";
import type { Route } from "./+types/docs";
import { useMDXComponents } from "@/components/mdx";
import { DocsShellContainer } from "@/components/docs-shell";
import {
  DOCS_HEAD,
  DOCS_HEAD_SHORT,
  DOCS_HEAD_URL,
} from "@/lib/docs-head";
import { baseOptions } from "@/lib/layout";
import { docs, source } from "@/lib/source";

export async function loader({ params }: Route.LoaderArgs) {
  const slugs = (params["*"] ?? "").split("/").filter(Boolean);
  const page = source.getPage(slugs);
  if (!page) throw new Response("Not found", { status: 404 });

  return {
    path: page.path,
    pageTree: await source.serializePageTree(source.getPageTree()),
  };
}

function Content({ path }: { path: string }) {
  const page = docs.getPage(path);
  if (!page) throw new Error(`Unknown documentation page: ${path}`);

  const { toc } = use(page.load());
  const Mdx = page.body;

  return (
    <DocsPage toc={toc}>
      <title>{`${page.title} | CharDesk Docs`}</title>
      <meta name="description" content={page.description} />
      <meta name="chardesk-docs-head" content={DOCS_HEAD} />
      <DocsTitle>{page.title}</DocsTitle>
      <DocsDescription>{page.description}</DocsDescription>
      <a
        data-docs-head={DOCS_HEAD}
        href={DOCS_HEAD_URL}
        target="_blank"
        rel="noreferrer"
        aria-label={`Documentation reviewed at commit ${DOCS_HEAD}`}
        className="mt-3 inline-flex w-fit items-center rounded-full border bg-fd-muted px-2 py-0.5 font-mono text-xs text-fd-muted-foreground transition-colors hover:text-fd-foreground"
      >
        HEAD {DOCS_HEAD_SHORT}
      </a>
      <DocsBody>
        <Mdx components={useMDXComponents()} />
      </DocsBody>
    </DocsPage>
  );
}

export default function DocsRoute({ loaderData }: Route.ComponentProps) {
  const { pageTree, path } = useFumadocsLoader(loaderData);

  return (
    <DocsLayout
      {...baseOptions()}
      tree={pageTree}
      slots={{ container: DocsShellContainer }}
    >
      <Content path={path} />
    </DocsLayout>
  );
}
